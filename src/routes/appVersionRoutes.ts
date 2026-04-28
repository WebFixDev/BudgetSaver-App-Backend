
// src/routes/appVersion.routes.ts
import express from 'express';
import { checkAppVersion } from '../controllers/appVersionController';

const router = express.Router();

// GET request k liye route define kiya hai
// Note: Is API par authentication (protect middleware) mat lagayein, 
// taake user login karne se pehle hi update ka popup dekh sake!
router.get('/', checkAppVersion);

export default router;