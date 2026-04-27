
// src/routes/userRoutes.ts
import express from 'express';
import { getAdSettings } from '../controllers/adSettingsController';


const router = express.Router();

router.get('/settings', getAdSettings);
export default router;


