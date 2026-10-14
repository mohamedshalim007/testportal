// server/src/routes/departmentRoutes.js
import express from 'express';
import { 
  getDepartments, getDepartmentById, createDepartment, 
  updateDepartment, deleteDepartment
} from '../controllers/departmentController.js';
import { authenticateToken, isAdmin, isSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// ========== PUBLIC ROUTES (No authentication) ==========
// These are accessible without a token
router.get('/', getDepartments);
router.get('/public', getDepartments); // Alias for public access
router.get('/:id', getDepartmentById);

// ========== PROTECTED ROUTES (Require authentication) ==========
// These require a valid token
router.post('/', authenticateToken, isAdmin, createDepartment);
router.put('/:id', authenticateToken, isAdmin, updateDepartment);
router.delete('/:id', authenticateToken, isAdmin, deleteDepartment);

export default router;