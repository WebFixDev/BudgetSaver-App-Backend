// cloudinary.ts
import { v2 as cloudinary } from "cloudinary";
import { config } from "./config";

// ✅ Configure Cloudinary using env variables
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME as string,
  api_key: config.CLOUDINARY_API_KEY as string,
  api_secret: config.CLOUDINARY_API_SECRET as string,
});

export default cloudinary;
