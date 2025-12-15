import mongoose, { Document, Schema, Types } from "mongoose";
import bcrypt from "bcrypt";

export interface IAuth extends Document {
  user: Types.ObjectId;
  provider: 'email' | 'google' | 'facebook';
  providerId?: string; 
  password?: string;
  isVerified: boolean;
  otp?: string;
  otpExpiresAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  _confirmPassword?: string; 
}

const authSchema = new Schema<IAuth>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    provider: {
      type: String,
      enum: ['email', 'google', 'facebook'],
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      sparse: true, 
    },

    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpiresAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

authSchema.virtual("confirmPassword").set(function (value: string) {
  (this as any)._confirmPassword = value;
});

authSchema.pre<IAuth>("validate", function () {
  if (this.provider === "email" && this.isModified("password")) {
    if (this.password && (this as any)._confirmPassword !== this.password) {

      const error = new mongoose.Error.ValidationError(this as any);

      error.addError(
        "confirmPassword",
        new mongoose.Error.ValidatorError({
          message: "Passwords do not match",
          path: "confirmPassword",
          value: (this as any)._confirmPassword,
        })
      );

      throw error;
    }
  }
});

authSchema.pre<IAuth>("save", async function () {
  if (this.provider === "email" && this.isModified("password") && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});




authSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (this.provider !== 'email' || !this.password) return false; 
  return bcrypt.compare(candidatePassword, this.password);
};

const Auth = mongoose.model<IAuth>("Auth", authSchema);
export default Auth;