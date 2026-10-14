// server/src/routes/snapshotRoutes.js
import express from 'express';
import { 
  getSnapshots, getSnapshotsByUser, createSnapshot, deleteSnapshot
} from '../controllers/snapshotController.js';
import { authenticateToken, isAdmin, isSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, isAdmin, getSnapshots);
router.get('/user/:userId', authenticateToken, isAdmin, getSnapshotsByUser);
router.post('/', authenticateToken, createSnapshot);
router.delete('/:id', authenticateToken, isAdmin, deleteSnapshot);

export default router;