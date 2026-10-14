// server/src/routes/submissionRoutes.js
import express from 'express';
import { 
  getSubmissions, getSubmissionById, getSubmissionsByUser,
  createSubmission, updateSubmission, deleteSubmission, getSubmissionStats
} from '../controllers/submissionController.js';
import { authenticateToken, isAdmin, isSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, isAdmin, getSubmissions);
router.get('/stats', authenticateToken, isAdmin, getSubmissionStats);
router.get('/:id', authenticateToken, isAdmin, getSubmissionById);
router.get('/user/:userId', authenticateToken, isSelfOrAdmin('userId'), getSubmissionsByUser);
router.post('/', authenticateToken, createSubmission);
router.put('/:id', authenticateToken, isAdmin, updateSubmission);
router.delete('/:id', authenticateToken, isAdmin, deleteSubmission);

export default router;