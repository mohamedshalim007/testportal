import { db, dbPromise } from "../db.js";
import { evaluateAnswers } from "../utils/scoreUtils.js";

const SUBMIT_GRACE_SECONDS = Math.max(0, Number(process.env.EXAM_SUBMIT_GRACE_SECONDS || 30));

function parseAnswers(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function loadSessionForStudent(sessionId, userId, connection = dbPromise) {
  const [rows] = await connection.query(
    `SELECT session_id, user_id, test_id, department_id, pattern_id,
            question_ids, started_at, expires_at, submitted_at, status
     FROM exam_sessions
     WHERE session_id = ? AND user_id = ?
     LIMIT 1`,
    [sessionId, userId]
  );
  return rows[0] || null;
}

async function loadQuestionsByIds(questionIds, testId, departmentId, patternId, connection = dbPromise) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) return [];
  const placeholders = questionIds.map(() => "?").join(",");
  const [rows] = await connection.query(
    `SELECT qid, word, question_type, optA, optB, optC, optD, correct, points
     FROM questions
     WHERE qid IN (${placeholders}) AND test_id = ? AND department_id = ? AND pattern_id = ?`,
    [...questionIds, testId, departmentId, patternId]
  );
  const byId = new Map(rows.map((q) => [q.qid, q]));
  return questionIds.map((id) => byId.get(id)).filter(Boolean);
}

export function getSubmissions(req, res) {
  db.query(
    `SELECT s.*, u.name AS user_name, u.reg_no, d.name AS department_name, p.pattern_no
     FROM submissions s
     LEFT JOIN users u ON s.user_id=u.user_id
     LEFT JOIN departments d ON s.department_id=d.id
     LEFT JOIN question_patterns p ON s.pattern_id=p.id
     ORDER BY s.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, data: rows });
    }
  );
}

export async function createSubmission(req, res) {
  const isStudent = req.user?.role === "student";
  if (!isStudent && req.user?.role !== "admin") return res.status(403).json({ ok: false, error: "Authentication required" });

  const sessionId = typeof req.body.session_id === "string" ? req.body.session_id.trim() : "";
  const answers = parseAnswers(req.body.answers_json);
  const reason = typeof req.body.malpractice_reason === "string" && req.body.malpractice_reason.trim()
    ? req.body.malpractice_reason.trim()
    : "Manual Submit";

  if (isStudent && !sessionId) return res.status(400).json({ ok: false, error: "session_id is required" });

  let connection;
  try {
    connection = await dbPromise.getConnection();
    await connection.beginTransaction();

    let session = null;
    let userId;
    let testId;
    let departmentId;
    let patternId;
    let questions;
    let startedAt;

    if (isStudent) {
      const [sessionRows] = await connection.query(
        `SELECT session_id, user_id, test_id, department_id, pattern_id,
                question_ids, started_at, expires_at, submitted_at, status
         FROM exam_sessions
         WHERE session_id = ? AND user_id = ?
         LIMIT 1
         FOR UPDATE`,
        [sessionId, req.user.id]
      );
      if (!sessionRows.length) {
        await connection.rollback();
        return res.status(404).json({ ok: false, error: "Exam session not found" });
      }
      session = sessionRows[0];
      if (session.status === "submitted") {
        await connection.rollback();
        return res.status(409).json({ ok: false, error: "This exam has already been submitted." });
      }

      const expiresAt = new Date(session.expires_at).getTime();
      if (Date.now() > expiresAt + SUBMIT_GRACE_SECONDS * 1000) {
        await connection.query(`UPDATE exam_sessions SET status='expired' WHERE session_id=? AND status='active'`, [sessionId]);
        await connection.commit();
        return res.status(408).json({ ok: false, error: "The exam submission window has expired." });
      }

      userId = req.user.id;
      testId = session.test_id;
      departmentId = session.department_id;
      patternId = session.pattern_id;
      startedAt = new Date(session.started_at);

      let questionIds;
      try { questionIds = Array.isArray(session.question_ids) ? session.question_ids : JSON.parse(session.question_ids || "[]"); } catch { questionIds = []; }
      questions = await loadQuestionsByIds(questionIds, testId, departmentId, patternId, connection);
      if (questions.length !== questionIds.length) {
        await connection.rollback();
        return res.status(409).json({ ok: false, error: "Some exam questions are no longer available." });
      }

      if (process.env.ALLOW_RETAKE !== "true") {
        const [duplicates] = await connection.query(
          `SELECT id FROM submissions WHERE user_id=? AND test_id=? LIMIT 1 FOR UPDATE`,
          [userId, testId]
        );
        if (duplicates.length) {
          await connection.rollback();
          return res.status(409).json({ ok: false, error: "You have already submitted this exam." });
        }
      }
    } else {
      userId = req.body.user_id;
      testId = req.body.test_id || "default_test";
      departmentId = req.body.department_id || null;
      patternId = req.body.pattern_id || null;
      startedAt = req.body.started_at ? new Date(req.body.started_at) : new Date();
      if (!userId || !testId) {
        await connection.rollback();
        return res.status(400).json({ ok: false, error: "User ID and Test ID are required" });
      }
      const [rows] = await connection.query(
        `SELECT qid, word, question_type, optA, optB, optC, optD, correct, points
         FROM questions WHERE test_id=? ${departmentId ? "AND department_id=?" : ""} ${patternId ? "AND pattern_id=?" : ""}
         ORDER BY qid`,
        [testId, ...(departmentId ? [departmentId] : []), ...(patternId ? [patternId] : [])]
      );
      questions = rows;
    }

    const allowedIds = new Set(questions.map((q) => q.qid));
    const safeAnswers = {};
    for (const [qid, answer] of Object.entries(answers)) {
      if (!allowedIds.has(qid)) continue;
      if (answer === null || answer === undefined) continue;
      safeAnswers[qid] = String(answer).trim();
    }

    const { score, max, percentage, evaluated } = evaluateAnswers(questions, safeAnswers);
    const finishedAt = new Date();

    const [result] = await connection.query(
      `INSERT INTO submissions
       (session_id, user_id, test_id, department_id, pattern_id, answers_json,
        started_at, finished_at, score, max_score, percentage, malpractice_reason, is_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        isStudent ? sessionId : null,
        userId,
        testId,
        departmentId || null,
        patternId || null,
        JSON.stringify(safeAnswers),
        startedAt,
        finishedAt,
        score,
        max,
        percentage,
        reason,
      ]
    );

    if (isStudent) {
      await connection.query(
        `UPDATE exam_sessions SET status='submitted', submitted_at=?, updated_at=CURRENT_TIMESTAMP WHERE session_id=? AND status='active'`,
        [finishedAt, sessionId]
      );
    }

    await connection.commit();

    return res.json({
      ok: true,
      data: {
        id: result.insertId,
        user_id: userId,
        score,
        max_score: max,
        percentage,
        answers: evaluated,
        totalQuestions: questions.length,
        answeredQuestions: Object.values(safeAnswers).filter((v) => String(v).trim() !== "").length,
        started_at: startedAt,
        finished_at: finishedAt,
      },
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ ok: false, error: "You have already submitted this exam." });
    console.error("Create submission error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Could not save submission" });
  } finally {
    if (connection) connection.release();
  }
}

export function updateSubmission(req, res) {
  const sets = [];
  const params = [];
  if (req.body.malpractice_reason !== undefined) { sets.push("malpractice_reason=?"); params.push(req.body.malpractice_reason); }
  if (req.body.finished_at !== undefined) { sets.push("finished_at=?"); params.push(new Date(req.body.finished_at)); }
  if (req.body.answers_json !== undefined) { sets.push("answers_json=?"); params.push(JSON.stringify(parseAnswers(req.body.answers_json))); }
  if (!sets.length) return res.status(400).json({ ok: false, error: "Nothing to update" });
  db.query(`UPDATE submissions SET ${sets.join(", ")} WHERE id=?`, [...params, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!result.affectedRows) return res.status(404).json({ ok: false, error: "Submission not found" });
    res.json({ ok: true, message: "Submission updated successfully" });
  });
}

export async function getSubmissionById(req, res) {
  try {
    const [rows] = await dbPromise.query(
      `SELECT s.*, u.name AS user_name, u.reg_no, d.name AS department_name, p.pattern_no
       FROM submissions s
       LEFT JOIN users u ON s.user_id=u.user_id
       LEFT JOIN departments d ON s.department_id=d.id
       LEFT JOIN question_patterns p ON s.pattern_id=p.id
       WHERE s.id=?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: "Submission not found" });
    const sub = rows[0];
    const answers = parseAnswers(sub.answers_json);
    let questionIds = null;
    if (sub.session_id) {
      const [sessions] = await dbPromise.query(`SELECT question_ids FROM exam_sessions WHERE session_id=? LIMIT 1`, [sub.session_id]);
      if (sessions.length) {
        try { questionIds = Array.isArray(sessions[0].question_ids) ? sessions[0].question_ids : JSON.parse(sessions[0].question_ids || "[]"); } catch { questionIds = null; }
      }
    }
    const questions = questionIds?.length
      ? await loadQuestionsByIds(questionIds, sub.test_id, sub.department_id, sub.pattern_id)
      : [];
    const { evaluated } = evaluateAnswers(questions, answers);
    res.json({ ok: true, data: { ...sub, details: evaluated } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export function getSubmissionsByUser(req, res) {
  db.query(`SELECT s.*, d.name AS department_name, p.pattern_no FROM submissions s LEFT JOIN departments d ON s.department_id=d.id LEFT JOIN question_patterns p ON s.pattern_id=p.id WHERE s.user_id=? ORDER BY s.created_at DESC`, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, data: rows });
  });
}

export async function deleteSubmission(req, res) {
  let connection;
  try {
    connection = await dbPromise.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(`SELECT user_id, test_id, session_id FROM submissions WHERE id=? LIMIT 1`, [req.params.id]);
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ ok: false, error: "Submission not found" }); }
    await connection.query(`DELETE FROM submissions WHERE id=?`, [req.params.id]);
    if (rows[0].session_id) await connection.query(`DELETE FROM exam_sessions WHERE session_id=?`, [rows[0].session_id]);
    await connection.commit();
    res.json({ ok: true, message: "Submission deleted successfully" });
  } catch (err) {
    if (connection) try { await connection.rollback(); } catch {}
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (connection) connection.release();
  }
}

export function getSubmissionStats(req, res) {
  db.query(`SELECT COUNT(*) AS total_submissions, AVG(percentage) AS avg_percentage, MAX(percentage) AS highest_score, MIN(percentage) AS lowest_score, SUM(CASE WHEN malpractice_reason IS NOT NULL AND malpractice_reason <> 'Manual Submit' THEN 1 ELSE 0 END) AS malpractice_count FROM submissions`, (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, data: rows[0] });
  });
}
