import { Request, Response, NextFunction } from "express";
import { uploadFileToCloudinary } from "../utils/uploadUtils";
// import { createNotification } from './notificationController';
import { Types } from 'mongoose';

// ✅ Image Upload Controller
export const uploadSngImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user.id; // Get user ID from middleware

    // ✅ Check if a file is uploaded
    if (!req.file) {
      res.status(400).json({ msg: "No image uploaded" });
      return;
    }

    // ✅ Upload the file to Cloudinary
    const { url } = await uploadFileToCloudinary(req.file.buffer, "images");

    // ✅ Create success notification for the user
    // await createNotification(
    //   new Types.ObjectId(userId),
    //   "Your profile image has been updated successfully!",
    //   "success"
    // );

    res.json({ 
      msg: "File uploaded successfully", 
      url,
      success: true 
    });
  } catch (err) {
    console.error("File Upload Error:", err);
    
    // ✅ Create error notification for the user
    // await createNotification(
    //   new Types.ObjectId((req as any).user.id),
    //   "Failed to update profile image. Please try again.",
    //   "error"
    // );

    next(err);
  }
};

