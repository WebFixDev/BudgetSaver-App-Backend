import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import User, { IUser, IUserDocument } from "../models/user.model";
import Auth, { IAuth } from "../models/auth.model";
import { createOTP, hashOTP, verifyOTP } from "../utils/createOTP";
import { sendEmail } from "../utils/sendEmail";
import { generateToken } from "../utils/authToken";
import {verifyGoogleToken} from "../utils/GoogleOAuth";

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
    profileImage?: string;
  };
}

interface IGoogleAuthRequest extends Request {
  body: {
    idToken: string;
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

interface IGoogleSocialData {
  idToken: string;
  photo?: string;
}

const OTP_EXPIRY_MINUTES = 10;

export const createSocialUserAndAuth = async (
  data: IGoogleSocialData,
  userId?: Types.ObjectId
): Promise<{ user: IUserDocument; auth: IAuth | null }> => {
  try {
    // Use your verifyGoogleToken function
    const { email, name = "Google User", picture = "", googleId } = await verifyGoogleToken(data.idToken);

    if (!email || !googleId) {
      throw new Error("Invalid Google ID Token: email or googleId missing");
    }

    // 1️⃣ Find or create user
    let user: IUserDocument | null = null;

    if (userId) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: name || "Google User",
          email,
          role: "agent",
          profileImage: data.photo || picture,
        });
      }
    }

    if (!user) throw new Error("User profile creation failed unexpectedly.");

    // 2️⃣ Check if auth record already exists for this user
    let existingAuth = await Auth.findOne({ user: user._id });

    if (existingAuth) {
      // If user has existing auth
      if (existingAuth.provider === "google") {
        // Already a Google auth, update providerId if needed
        if (existingAuth.providerId !== googleId) {
          existingAuth.providerId = googleId;
          await existingAuth.save();
        }
      } else {
        // User has email auth, check if we should allow Google login
        // For security, you might want to prevent this or merge accounts
        throw new Error("Email already registered with different login method");
      }
      return { user, auth: existingAuth };
    } else {
      // Create new Google auth record
      const auth = await Auth.create({
        user: user._id,
        provider: "google",
        providerId: googleId,
        isVerified: true,
      });
      return { user, auth };
    }
  } catch (error: any) {
    console.error("createSocialUserAndAuth error:", error);
    
    // Handle duplicate key error
    if (error.code === 11000 || error.codeName === 'DuplicateKey') {
      console.log("Duplicate key error detected, finding existing record...");
      
      // Try to find existing auth record
      try {
        const { email } = await verifyGoogleToken(data.idToken);
        const user = await User.findOne({ email });
        if (user) {
          const existingAuth = await Auth.findOne({ user: user._id });
          if (existingAuth) {
            console.log("Found existing auth record:", existingAuth._id);
            return { user, auth: existingAuth };
          }
        }
      } catch (findError) {
        console.error("Error finding existing record:", findError);
      }
    }
    
    throw error;
  }
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

    if (password !== confirmPassword) {
      res.status(400).json({ message: "Passwords do not match" });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "Email already exists" });
      return;
    }
    
    const newUser = await User.create({ name, email, role: "agent" }); // Added role
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
    
    // Send OTP email
    try {
      await sendEmail({
        to: email,
        subject: "Your OTP Verification Code",
        html: `<h3>Your OTP is: <b>${otp}</b>. It expires in ${OTP_EXPIRY_MINUTES} minutes.</h3>`,
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Continue even if email fails, but log it
    }

    res.status(201).json({
      message: "User registered successfully. Please verify OTP.",
      success: true,
      userId: newUser._id,
      email: newUser.email
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
): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ message: "Email and OTP are required" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const auth = await Auth.findOne({ user: user._id, provider: "email" });
    if (!auth) {
      res.status(404).json({ message: "Authentication record not found." });
      return;
    }

    if (auth.isVerified) {
      res.status(400).json({ message: "Email already verified" });
      return;
    }

    if (
      !auth.otp ||
      !auth.otpExpiresAt ||
      auth.otpExpiresAt.getTime() < Date.now()
    ) {
      // Generate new OTP if expired
      const newOtp = createOTP();
      const hashedOTP = hashOTP(newOtp);
      auth.otp = hashedOTP;
      auth.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      await auth.save();
      
      // Send new OTP
      try {
        await sendEmail({
          to: email,
          subject: "New OTP Verification Code",
          html: `<h3>Your new OTP is: <b>${newOtp}</b>. It expires in ${OTP_EXPIRY_MINUTES} minutes.</h3>`,
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }
      
      res.status(400).json({ 
        message: "OTP expired. A new OTP has been sent to your email.",
        success: false 
      });
      return;
    }

    const isValid = verifyOTP(otp, auth.otp);
    if (!isValid) {
      res.status(400).json({ message: "Invalid OTP" });
      return;
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
  } catch (err: any) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const loginUser = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // Select password field explicitly
    const auth = await Auth.findOne({
      user: user._id,
      provider: "email",
    }).select("+password");

    if (!auth) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }
    
    if (!auth.isVerified) {
      res.status(403).json({ message: "Please verify your email first" });
      return;
    }

    const match = await auth.comparePassword(password);
    if (!match) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

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
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const forgotPassword = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const user = await User.findOne({ email });
    const auth = user
      ? await Auth.findOne({ user: user._id, provider: "email" })
      : null;

    // Always return the same message for security (prevent email enumeration)
    if (!user || !auth) {
      res.json({
        message: "If the email is registered, an OTP has been sent.",
        success: true,
      });
      return;
    }
    
    const otp = createOTP();
    const hashedOTP = hashOTP(otp);
    auth.otp = hashedOTP;
    auth.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await auth.save();
    
    try {
      await sendEmail({
        to: email,
        subject: "Password Reset OTP",
        html: `<p>Your password reset OTP is <b>${otp}</b>. It expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`,
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.json({ message: "OTP sent for password reset", success: true });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const resetPassword = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !otp || !password || !confirmPassword) {
      res.status(400).json({ message: "Email, OTP, and passwords are required" });
      return;
    }
    
    if (password !== confirmPassword) {
      res.status(400).json({ message: "Passwords do not match" });
      return;
    }
    
    const user = await User.findOne({ email });
    const auth = user
      ? await Auth.findOne({ user: user._id, provider: "email" }).select("+password")
      : null;
      
    if (!user || !auth) {
      res.status(404).json({ message: "User not found." });
      return;
    }
    
    if (
      !auth.otp ||
      !auth.otpExpiresAt ||
      auth.otpExpiresAt.getTime() < Date.now()
    ) {
      res.status(400).json({ message: "Invalid or expired OTP." });
      return;
    }
    
    const isValid = verifyOTP(otp, auth.otp);
    if (!isValid) {
      res.status(400).json({ message: "Invalid OTP" });
      return;
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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
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

export const createOrUpdateGoogleAuth = async (
  data: IGoogleSocialData,
  userId?: Types.ObjectId
): Promise<{ user: IUserDocument; auth: IAuth }> => {
  const { email, name = "Google User", picture = "", googleId } = await verifyGoogleToken(data.idToken);

  if (!email || !googleId) {
    throw new Error("Invalid Google ID Token: email or googleId missing");
  }

  // Find or create user
  let user: IUserDocument | null = null;

  if (userId) {
    user = await User.findById(userId);
  } else {
    user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: name || "Google User",
        email,
        role: "agent",
        profileImage: data.photo || picture,
      });
    }
  }

  if (!user) throw new Error("User profile creation failed unexpectedly.");

  // Use findOneAndUpdate with upsert to avoid duplicate key errors
  const auth = await Auth.findOneAndUpdate(
    { 
      user: user._id,
      provider: "google"
    },
    {
      providerId: googleId,
      isVerified: true
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  return { user, auth };
};

export const googleAuthCallback = async (
  req: IGoogleAuthRequest, 
  res: Response
): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ success: false, message: "Missing Google ID token." });
      return;
    }

    // First verify the token to get user info
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(idToken);
      console.log("Google user verified:", {
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.googleId
      });
    } catch (verifyError) {
      console.error("Token verification failed:", verifyError);
      res.status(401).json({ 
        success: false, 
        message: "Invalid Google token. Please try again." 
      });
      return;
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: googleUser.email });
    console.log("Existing User found:", existingUser?._id);

    if (existingUser) {
      // Check if auth record exists for this user
      const existingAuth = await Auth.findOne({ user: existingUser._id });
      console.log("Existing Auth found:", existingAuth);
      
      if (existingAuth) {
        // User has existing auth record
        if (existingAuth.provider !== "google") {
          // User registered with email, not Google
          res.status(409).json({ 
            success: false, 
            message: "Email already registered with email/password. Please login with email or use forgot password." 
          });
          return;
        }
        
        // User already has Google auth, generate token
        const token = generateToken({ id: existingUser._id, role: existingUser.role });
        
        res.status(200).json({
          success: true,
          message: "Login successful via Google",
          token,
          user: {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
            photo: existingUser.profileImage,
            provider: "google"
          }
        });
        return;
      }
    }

    // Create or update Google auth (use the safer version)
    const { user, auth } = await createOrUpdateGoogleAuth({ idToken });
    
    if (!user) {
      res.status(500).json({ success: false, message: "User creation failed." });
      return;
    }

    const token = generateToken({ id: user._id, role: user.role });

    res.status(200).json({
      success: true,
      message: "Login successful via Google",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: user.profileImage,
        provider: auth?.provider || "google"
      }
    });
  } catch (error: any) {
    console.error("Google Auth Error Details:", {
      message: error.message,
      code: error.code,
      codeName: error.codeName,
      stack: error.stack
    });
    
    // Handle specific errors
    if (error.message === "Email already registered with different login method") {
      res.status(409).json({ 
        success: false, 
        message: "Email already registered with email/password. Please login with email instead." 
      });
      return;
    }
    
    if (error.message.includes("Invalid Google token") || error.message.includes("Invalid Google ID Token")) {
      res.status(401).json({ success: false, message: "Invalid Google token." });
      return;
    }
    
    // Handle duplicate key error
    if (error.code === 11000 || error.codeName === 'DuplicateKey') {
      console.log("Attempting to recover from duplicate key error...");
      
      // Try recovery - verify token and find existing user
      try {
        const googleUser = await verifyGoogleToken(req.body.idToken);
        const user = await User.findOne({ email: googleUser.email });
        
        if (user) {
          const auth = await Auth.findOne({ user: user._id });
          const token = generateToken({ id: user._id, role: user.role });
          
          res.status(200).json({
            success: true,
            message: "Login successful (account recovered)",
            token,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              photo: user.profileImage,
              provider: auth?.provider || "google"
            }
          });
          return;
        }
      } catch (recoveryError) {
        console.error("Recovery failed:", recoveryError);
      }
      
      res.status(409).json({ 
        success: false, 
        message: "Account already exists. Please try logging in again." 
      });
      return;
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to authenticate with Google. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const verifyUserAuth = async (
  req: Request, 
  res: Response
): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        message: "Unauthorized: Invalid token payload.",
        logout: true,
      });
      return;
    }

    const user = await User.findById(req.user.id);
    const auth = await Auth.findOne({ user: req.user.id });

    if (!user || !auth) {
      res.status(401).json({
        message: "User profile or authentication record missing.",
        logout: true,
      });
      return;
    }

    res.json({
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
    res.status(401).json({ message: "Token verification failed.", logout: true });
  }
};

// Additional helper function for resending OTP
export const resendOTP = async (
  req: IAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const auth = await Auth.findOne({ user: user._id, provider: "email" });
    if (!auth) {
      res.status(404).json({ message: "Authentication record not found" });
      return;
    }

    if (auth.isVerified) {
      res.status(400).json({ message: "Email already verified" });
      return;
    }

    const otp = createOTP();
    const hashedOTP = hashOTP(otp);
    auth.otp = hashedOTP;
    auth.otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await auth.save();

    try {
      await sendEmail({
        to: email,
        subject: "Your New OTP Verification Code",
        html: `<h3>Your new OTP is: <b>${otp}</b>. It expires in ${OTP_EXPIRY_MINUTES} minutes.</h3>`,
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.json({
      message: "New OTP sent successfully",
      success: true,
    });
  } catch (err: any) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};