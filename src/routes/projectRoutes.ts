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
  getProjectStatistics
} from '../controllers/projectController';
import { verifyTokenMiddleware } from '../middleware/authMiddleware';
const router = express.Router();
router.use(verifyTokenMiddleware);

router.get('/', getAllProjects);
router.get('/stats', getProjectStatistics);
router.get('/:id', getProjectById);
router.get('/code/:code', getProjectByCode);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.delete('/:id/force', forceDeleteProject);

// Special operations
router.patch('/:id/status', updateProjectStatus);
router.patch('/:id/financials', updateProjectFinancials);
export default router;