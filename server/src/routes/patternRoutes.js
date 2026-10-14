// server/src/routes/patternRoutes.js
import express from 'express';
import { 
  getPatterns, getPatternsByDepartment, getPatternById, 
  createPattern, updatePattern, deletePattern
} from '../controllers/patternController.js';
import { authenticateToken, isAdmin, isSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// ========== PUBLIC ROUTES (No authentication) ==========
router.get('/', getPatterns);
router.get('/department/:departmentId', getPatternsByDepartment);
router.get('/:id', getPatternById);

// ========== PROTECTED ROUTES (Require authentication) ==========
router.post('/', authenticateToken, isAdmin, createPattern);
router.put('/:id', authenticateToken, isAdmin, updatePattern);
router.delete('/:id', authenticateToken, isAdmin, deletePattern);

export default router;