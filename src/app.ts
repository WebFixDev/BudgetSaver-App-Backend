import express, { Application, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import userRoutes from "./routes";
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app: Application = express();

// ✅ Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: "*", // ya specific frontend URL
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(cookieParser());
app.use(morgan("dev"));

// ✅ Test Route
app.get("/", (req: Request, res: Response) => {
  res.send("Budget Expense Planner Backend is Running 🚀");
});

// ✅ API Routes
app.use("/api", userRoutes);

app.use(errorHandler);

export default app;
