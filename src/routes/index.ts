import express from "express";
import authRoutes from "./authRoute";
import ProjectRoutes from "./projectRoutes";
import assetRoutes from "./assetRoutes";
import partyRoutes from "./partyRoutes";
import userRoutes from "./userRoutes";
import transactionRoutes from "./transactionRoutes";


const router = express.Router();

router.use("/auth", authRoutes);
router.use("/projects", ProjectRoutes);
router.use("/assets", assetRoutes);
router.use("/projects", partyRoutes);
router.use('/users', userRoutes);
router.use('/transactions', transactionRoutes);

export default router;