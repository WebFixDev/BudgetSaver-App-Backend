// src/routes/partyRoutes.ts
import express from 'express';
import {
  createParty,
  getProjectParties,
  getPartyById,
  updateParty,
  deleteParty,
  getPartyStatistics
} from '../controllers/partyController';
import { verifyTokenMiddleware } from '../middleware/authMiddleware';
const router = express.Router();
router.use(verifyTokenMiddleware);
// All routes are nested under /projects/:projectId/parties
router.post('/:projectId/parties', createParty);
router.get('/:projectId/parties', getProjectParties);
router.get('/:projectId/parties/:partyId', getPartyById);
router.put('/:projectId/parties/:partyId', updateParty);
router.delete('/:projectId/parties/:partyId', deleteParty);
router.get('/:projectId/parties-stats', getPartyStatistics);

export default router;