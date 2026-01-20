// src/routes/transaction.routes.ts
import express from "express";
import {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  getTransactionsByProject,
  updateTransaction,
  deleteTransaction,
} from "../controllers/transactionController";
import { verifyTokenMiddleware } from '../middleware/authMiddleware';

const router = express.Router();
router.use(verifyTokenMiddleware);

router.post("/", createTransaction);
router.get("/", getAllTransactions);
// router.get("/stats", getTransactionStats);
router.get("/project/:projectId", getTransactionsByProject);
router.get("/:id", getTransactionById);
router.put("/:id", updateTransaction);
router.delete("/:id", deleteTransaction);

export default router;