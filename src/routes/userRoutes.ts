// src/routes/userRoutes.ts
import express from 'express';
import {
  getAllUsers,
  getUserById,
  getCurrentUser,
  createUser,
  updateUser,
  updateCurrentUser,
  deleteUser,
  toggleUserStatus,
  getUserStatistics
} from '../controllers/userController';
import { verifyTokenMiddleware, authorize } from '../middleware/authMiddleware';

const router = express.Router();


router.use(verifyTokenMiddleware);

router.get('/me', getCurrentUser);
router.put('/me', updateCurrentUser);

router.get('/', authorize(['admin']), getAllUsers);
router.get('/stats', authorize(['admin']), getUserStatistics);
router.post('/', authorize(['admin']), createUser);
router.get('/:id', authorize(['admin']), getUserById);
router.put('/:id', authorize(['admin']), updateUser);
router.delete('/:id', authorize(['admin']), deleteUser);
router.patch('/:id/toggle-status', authorize(['admin']), toggleUserStatus);

export default router;