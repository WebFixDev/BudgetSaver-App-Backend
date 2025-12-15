import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import User, { IUser, IUserDocument } from "../models/user.model";
import Auth, { IAuth } from "../models/auth.model";
import { createOTP, hashOTP, verifyOTP } from "../utils/createOTP";
import { sendEmail } from "../utils/sendEmail";
import { generateToken } from "../utils/authToken";

interface IAuthRequest extends Request {
  body: {
    name?: string;
    email: string;
    password?: string;
    confirmPassword?: string;
    otp?: string;
    provider?: "email" | "google" | "facebook";
    providerId?: string;
    phone?: string;
  };
}

interface ISocialAuthRequest extends Request {
  body: {
    email: string;
    name: string;
    provider: "google" | "facebook";
    providerId: string;
  };
}

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: Types.ObjectId;
      role: string;
    };
  }
}

const OTP_EXPIRY_MINUTES = 10;
const createSocialUserAndAuth = async (
  data: ISocialAuthRequest["body"],
  userId?: Types.ObjectId
): Promise<{ user: IUserDocument; auth: IAuth }> => {
  const { email, name, providerId, provider } = data;

  let user: IUserDocument | null = null;
  if (!userId) {
    user = await User.create({ name, email, role: "agent" });
  } else {
    user = await User.findById(userId);
  }

  if (!user) {
    throw new Error("User profile creation failed unexpectedly.");
  }
  const auth = await Auth.create({
    user: user._id,
    provider: provider,
    providerId: providerId,
    isVerified: true,
  });
  return { user, auth };
};

export const registerUser = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "Email already exists" });
      return;
    }
    const newUser = await User.create({ name, email });
    const otp = createOTP();
    const hashedOTP = hashOTP(otp);

    const newAuth: IAuth = new Auth({
      user: newUser._id,
      provider: "email",
      password: password,
      otp: hashedOTP,
      otpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    });

    (newAuth as any).confirmPassword = confirmPassword;
    await newAuth.save();
    await sendEmail({
      to: email,
      subject: "Your OTP Verification Code",
      html: `<h3>Your OTP is: <b>${otp}</b>. It expires in ${OTP_EXPIRY_MINUTES} minutes.</h3>`,
    });

    res.status(201).json({
      message: "User registered successfully. Please verify OTP.",
      success: true,
    });
  } catch (error: any) {
    console.error("Register error:", error);

    if (error.name === "ValidationError" || error.code === 11000) {
      const errors =
        error.name === "ValidationError"
          ? Object.values(error.errors)
              .map((err: any) => err.message)
              .join(", ")
          : "Email already exists or constraint failed.";
      res.status(400).json({ message: errors });
      return;
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const verifyUserOTP = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const auth = await Auth.findOne({ user: user._id, provider: "email" });
    if (!auth)
      return res
        .status(404)
        .json({ message: "Authentication record not found." });

    if (
      !auth.otp ||
      !auth.otpExpiresAt ||
      auth.otpExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    const isValid = verifyOTP(otp as string, auth.otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    auth.isVerified = true;
    auth.otp = undefined;
    auth.otpExpiresAt = undefined;
    await auth.save();

    const token = generateToken({ id: user._id, role: user.role });

    res.json({
      message: "Email verified successfully",
      token,
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const loginUser = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    // Select password field explicitly
    const auth = await Auth.findOne({
      user: user._id,
      provider: "email",
    }).select("+password");

    if (!auth)
      return res.status(401).json({ message: "Invalid email or password" });
    if (!auth.isVerified)
      return res
        .status(403)
        .json({ message: "Please verify your email first" });

    const match = await auth.comparePassword(password as string);
    if (!match)
      return res.status(401).json({ message: "Invalid email or password" });

    const token = generateToken({ id: user._id, role: user.role });

    res.json({
      message: "Login successful",
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const forgotPassword = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    const auth = user
      ? await Auth.findOne({ user: user._id, provider: "email" })
      : null;

    if (!user || !auth) {
      return res.json({
        message: "If the email is registered, an OTP has been sent.",
        success: true,
      });
    }
    const otp = createOTP();
    const hashedOTP = hashOTP(otp);
    auth.otp = hashedOTP;
    auth.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await auth.save();
    await sendEmail({
      to: email as string,
      subject: "Password Reset OTP",
      html: `<p>Your password reset OTP is <b>${otp}</b>. It expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`,
    });

    res.json({ message: "OTP sent for password reset", success: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const resetPassword = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !otp || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "Email, OTP, and passwords are required" });
    }
    const user = await User.findOne({ email });
    const auth = user
      ? await Auth.findOne({ user: user._id, provider: "email" }).select(
          "+password"
        )
      : null;
    if (!user || !auth)
      return res.status(404).json({ message: "User not found." });
    if (
      !auth.otp ||
      !auth.otpExpiresAt ||
      auth.otpExpiresAt.getTime() < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }
    const isValid = verifyOTP(otp as string, auth.otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    auth.password = password;
    (auth as any).confirmPassword = confirmPassword;
    auth.otp = undefined;
    auth.otpExpiresAt = undefined;
    await auth.save();
    const token = generateToken({ id: user._id, role: user.role });

    res.json({
      message: "Password reset successful. You are now logged in.",
      success: true,
      token,
    });
  } catch (err: any) {
    console.error("Reset password error:", err);

    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map(
        (error: any) => error.message
      );
      res.status(400).json({ message: errors.join(", ") });
      return;
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const socialAuthCallback = async (
  req: ISocialAuthRequest,
  res: Response
) => {
  const { email, name, provider, providerId } = req.body;

  if (!email || !provider || !providerId) {
    return res
      .status(400)
      .json({ message: "Missing essential provider data." });
  }

  try {
    let user: IUserDocument | null = await User.findOne({ email });
    let auth: IAuth | null = null;

    if (user) {
      auth = await Auth.findOne({ user: user._id, provider: provider });
      if (!auth) {
        ({ user, auth } = await createSocialUserAndAuth(req.body, user._id));
      }
    } else {
      ({ user, auth } = await createSocialUserAndAuth(req.body));
    }

    let finalUser: IUserDocument | null = user;
    if (!finalUser && auth) {
      finalUser = await User.findById(auth.user);
    }
    if (!finalUser) {
      console.error(
        "Critical: finalUser not found after successful auth/creation."
      );
      return res
        .status(500)
        .json({ message: "Internal error: User profile retrieval failed." });
    }
    const token = generateToken({ id: finalUser._id, role: finalUser.role });

    res.status(200).json({
      message: `Login successful via ${provider}.`,
      success: true,
      token,
      user: {
        id: finalUser._id,
        name: finalUser.name,
        email: finalUser.email,
        role: finalUser.role,
      },
    });
  } catch (error) {
    console.error("Social Auth Error:", error);
    res
      .status(500)
      .json({ message: "Server error during social login/signup." });
  }
};

export const verifyUserAuth = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({
          message: "Unauthorized: Invalid token payload.",
          logout: true,
        });
    }

    const user = await User.findById(req.user.id);
    const auth = await Auth.findOne({ user: req.user.id });

    if (!user || !auth) {
      return res
        .status(401)
        .json({
          message: "User profile or authentication record missing.",
          logout: true,
        });
    }

    return res.json({
      success: true,
      message: "User verified",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: auth.isVerified,
        provider: auth.provider,
      },
    });
  } catch (error: any) {
    console.error("verifyUserAuth error:", error);
    return res
      .status(401)
      .json({ message: "Token verification failed.", logout: true });
  }
};
