import cloudinary from "../config/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { Readable } from "stream";

// ✅ Interface for Upload Response
interface UploadResult {
  url: string;
  publicId: string;
}


const bufferToStream = (buffer: Buffer): Readable => {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
};

// ✅ Function to Upload File to Cloudinary from Buffer
const uploadFileToCloudinary = (
  buffer: Buffer,
  folder: string
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto", // Treat as raw file
        type: "upload", // Ensure public access
        // format: "pdf", // Force PDF format
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          return reject(
            new Error(`Cloudinary upload failed: ${error?.message}`)
          );
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer); // Properly send buffer data to Cloudinary
  });
};

// ✅ Function to Delete File from Cloudinary
const deleteFileFromCloudinary = async (publicId: string): Promise<string> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result;
  } catch (err) {
    throw new Error(
      `Error deleting file from Cloudinary: ${(err as Error).message}`
    );
  }
};


const uploadAdsToCloudinary = (
  buffer: Buffer,
  folder: string,
  resource_type: 'image' | 'video'
): Promise<{ url: string, publicId: string }> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type, // 👈 important: 'image' or 'video'
      },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id, // ✅ Add this
        });
      }
    );

    bufferToStream(buffer).pipe(stream);
  });
};


export { uploadFileToCloudinary, deleteFileFromCloudinary, uploadAdsToCloudinary };
