 // server/src/routes/faceRoutes.js
import express from 'express';
import { uploadFaceImage, clearFace, verifyFace } from '../controllers/faceController.js';
import { authenticateToken, isAdmin, isSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// All face routes require authentication
router.post('/upload-image', authenticateToken, isAdmin, uploadFaceImage);
router.post('/clear', authenticateToken, isAdmin, clearFace);
router.post('/verify', authenticateToken, verifyFace);

export default router;