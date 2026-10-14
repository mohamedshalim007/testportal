import express from "express";

import {
  startExamSession,
  getExamSession,
} from "../controllers/examSessionController.js";

import {
  authenticateToken,
  isStudent,
} from "../middleware/auth.js";

const router = express.Router();


// ============================================================
// START / RESUME EXAM
// ============================================================

router.post(
  "/start",
  authenticateToken,
  isStudent,
  startExamSession
);


// ============================================================
// GET EXAM SESSION
// ============================================================

router.get(
  "/:sessionId",
  authenticateToken,
  isStudent,
  getExamSession
);


export default router;