// src/routes/projectRoutes.ts
import express from 'express';
import {
  getAllProjects,
  getProjectById,
  getProjectByCode,
  createProject,
  updateProject,
  deleteProject,
  forceDeleteProject,
  updateProjectStatus,
  updateProjectFinancials,
  getProjectStatistics,
  getMyProjects,
  getMyProjectStatistics,
   checkMyProjectCodeExists,
  checkGlobalProjectCodeExists
} from '../controllers/projectController';
import { verifyTokenMiddleware } from '../middleware/authMiddleware';

const router = express.Router();
router.use(verifyTokenMiddleware);

// Admin routes (for all projects)
router.get('/all', getAllProjects); 
router.get('/stats', getProjectStatistics);

// User-specific routes
router.get('/', getMyProjects);
router.get('/my-stats', getMyProjectStatistics); 

// Common routes
router.get('/:id', getProjectById);
router.get('/code/:code', getProjectByCode);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.delete('/:id/force', forceDeleteProject);

// Special operations
router.patch('/:id/status', updateProjectStatus);
router.patch('/:id/financials', updateProjectFinancials);

// Check project code routes
router.get('/check-code/:code', checkMyProjectCodeExists); // User-specific check
router.get('/check-code/global/:code', checkGlobalProjectCodeExists); // Global check

export default router;