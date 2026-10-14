// server/src/routes/questionRoutes.js
import express from 'express';
import { 
  getQuestions, getQuestionsForStudent, getQuestionsByDepartment, getQuestionsByPattern,
  createQuestion, updateQuestion, deleteQuestion, deleteAllQuestions
} from '../controllers/questionController.js';
import { authenticateToken, isAdmin, isSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getQuestions);
router.get('/student/:user_id', authenticateToken, getQuestionsForStudent);
router.get('/department/:departmentId', authenticateToken, isAdmin, getQuestionsByDepartment);
router.get('/pattern/:patternId', authenticateToken, isAdmin, getQuestionsByPattern);
router.post('/', authenticateToken, isAdmin, createQuestion);
router.put('/', authenticateToken, isAdmin, updateQuestion);
router.delete('/all', authenticateToken, isAdmin, deleteAllQuestions); // must be before /:qid
router.delete('/:qid', authenticateToken, isAdmin, deleteQuestion);

export default router;