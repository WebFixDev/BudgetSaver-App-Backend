import express from "express";
import {
  uploadSingleImage,
} from "../middleware/multer";
import {
  uploadSngImage,
} from "../controllers/assetController";
import { verifyTokenMiddleware } from '../middleware/authMiddleware';

const router = express.Router();


router.use(verifyTokenMiddleware);


router.post(
  "/profile-image",
  uploadSingleImage.single("image"),
  uploadSngImage
);

export default router;
