// server/src/routes/authRoutes.js
import express from 'express';
import { studentLogin, adminLogin, registerStudent } from '../controllers/authController.js';
import { authenticateToken, isAdmin, isSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/student', studentLogin);
router.post('/admin', adminLogin);

// Protected routes (Admin only)
router.post('/register', authenticateToken, isAdmin, registerStudent);

export default router;