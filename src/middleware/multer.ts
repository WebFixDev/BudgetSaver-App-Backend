import multer from "multer";

// ✅ Storage: Store File in Memory (Buffer)
const storage = multer.memoryStorage();



const imageFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {

  console.log(_req.file, "req.file in multer");
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only images (PNG, JPG, JPEG) are allowed"));
  }
};



export const uploadSingleImage = multer({
  storage,
  fileFilter: imageFileFilter,
}); // "image" is the field name


