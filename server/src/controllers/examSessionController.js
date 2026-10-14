// server/src/controllers/examSessionController.js

import crypto from "crypto";
import { dbPromise } from "../db.js";


// ============================================================
// REMOVE CORRECT ANSWER BEFORE SENDING QUESTIONS TO STUDENT
// ============================================================

function publicQuestion(row) {
  return {
    qid: row.qid,
    test_id: row.test_id,
    department_id: row.department_id,
    pattern_id: row.pattern_id,
    question_type: row.question_type,

    word: row.word,

    optA: row.optA,
    optB: row.optB,
    optC: row.optC,
    optD: row.optD,

    points: row.points,
    difficulty: row.difficulty,

    options:
      row.question_type === "MCQ"
        ? [row.optA, row.optB, row.optC, row.optD].filter(Boolean)
        : [],
  };
}


// ============================================================
// START / RESUME EXAM SESSION
// ============================================================

export async function startExamSession(req, res) {
  let connection = null;

  try {
    // --------------------------------------------------------
    // 1. STUDENT AUTHENTICATION
    // --------------------------------------------------------

    if (!req.user || req.user.role !== "student") {
      return res.status(403).json({
        ok: false,
        error: "Student access required",
      });
    }

    const userId = String(
      req.user.id || req.user.user_id || ""
    ).trim();

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "Invalid student account",
      });
    }

    const db = await dbPromise;

    // --------------------------------------------------------
    // 2. GET A DATABASE CONNECTION
    // --------------------------------------------------------

    connection = await db.getConnection();

    await connection.beginTransaction();

    // --------------------------------------------------------
    // IMPORTANT:
    //
    // LOCK THE STUDENT ROW.
    //
    // This prevents two simultaneous requests from creating
    // two exam sessions for the same student.
    //
    // This is especially important when React StrictMode causes
    // the component effect to execute more than once in development.
    // --------------------------------------------------------

    const [userRows] = await connection.query(
      `
      SELECT
        user_id,
        name,
        department_id,
        pattern_id,
        test_id,
        is_active
      FROM users
      WHERE user_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (!userRows.length) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        error: "Student account not found",
      });
    }

    const student = userRows[0];

    // --------------------------------------------------------
    // 3. CHECK STUDENT ACTIVE
    // --------------------------------------------------------

    if (Number(student.is_active) !== 1) {
      await connection.rollback();

      return res.status(403).json({
        ok: false,
        error: "Your student account is inactive",
      });
    }

    // --------------------------------------------------------
    // 4. GET STUDENT ASSIGNMENT
    // --------------------------------------------------------

    const departmentId = Number(
      student.department_id
    );

    const patternId = Number(
      student.pattern_id
    );

    const testId = String(
      student.test_id || "default_test"
    );

    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        error:
          "You are not assigned to a department",
      });
    }

    if (!Number.isInteger(patternId) || patternId <= 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        error:
          "You are not assigned to an exam pattern",
      });
    }

    // --------------------------------------------------------
    // 5. CHECK DEPARTMENT
    // --------------------------------------------------------

    const [departmentRows] = await connection.query(
      `
      SELECT
        id,
        name,
        is_active
      FROM departments
      WHERE id = ?
      LIMIT 1
      `,
      [departmentId]
    );

    if (!departmentRows.length) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        error: "Assigned department does not exist",
      });
    }

    if (Number(departmentRows[0].is_active) !== 1) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        error: "Assigned department is inactive",
      });
    }

    // --------------------------------------------------------
    // 6. GET PATTERN
    // --------------------------------------------------------

    const [patternRows] = await connection.query(
      `
      SELECT
        id,
        pattern_no,
        department_id,
        description,
        total_questions,
        time_limit_minutes,
        passing_percentage,
        is_active
      FROM question_patterns
      WHERE id = ?
      LIMIT 1
      `,
      [patternId]
    );

    if (!patternRows.length) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        error:
          "Assigned exam pattern does not exist",
      });
    }

    const pattern = patternRows[0];

    // --------------------------------------------------------
    // 7. PATTERN ACTIVE CHECK
    // --------------------------------------------------------

    if (Number(pattern.is_active) !== 1) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        error:
          "Assigned exam pattern is inactive",
      });
    }

    // --------------------------------------------------------
    // 8. PATTERN MUST BELONG TO STUDENT DEPARTMENT
    // --------------------------------------------------------

    if (
      Number(pattern.department_id) !==
      departmentId
    ) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        error:
          "Exam pattern does not belong to your department",
      });
    }

    // --------------------------------------------------------
    // 9. EXAM CONFIGURATION
    // --------------------------------------------------------

    const questionCount = Number(
      pattern.total_questions
    );

    const timeLimitMinutes = Number(
      pattern.time_limit_minutes
    );

    if (
      !Number.isInteger(questionCount) ||
      questionCount <= 0
    ) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        error:
          "Invalid question count configured for this exam pattern",
      });
    }

    if (
      !Number.isInteger(timeLimitMinutes) ||
      timeLimitMinutes <= 0
    ) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        error:
          "Invalid exam time configured for this exam pattern",
      });
    }

    // --------------------------------------------------------
    // 10. CURRENT TIME
    // --------------------------------------------------------

    const now = new Date();

    // --------------------------------------------------------
    // 11. FIND ACTIVE SESSION
    // --------------------------------------------------------

    const [activeSessions] =
      await connection.query(
        `
        SELECT
          session_id,
          user_id,
          test_id,
          department_id,
          pattern_id,
          question_ids,
          started_at,
          expires_at,
          submitted_at,
          status
        FROM exam_sessions
        WHERE user_id = ?
          AND status = 'active'
        ORDER BY started_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [userId]
      );

    // ========================================================
    // 12. ACTIVE SESSION FOUND
    // ========================================================

    if (activeSessions.length > 0) {
      const existing =
        activeSessions[0];

      // ------------------------------------------------------
      // CHECK EXPIRY
      // ------------------------------------------------------

      const expiresTime =
        new Date(
          existing.expires_at
        ).getTime();

      const nowTime =
        now.getTime();

      if (
        Number.isFinite(expiresTime) &&
        expiresTime <= nowTime
      ) {
        // ----------------------------------------------------
        // OLD SESSION EXPIRED
        // ----------------------------------------------------

        await connection.query(
          `
          UPDATE exam_sessions
          SET status = 'expired'
          WHERE session_id = ?
          `,
          [existing.session_id]
        );
      } else {
        // ----------------------------------------------------
        // SESSION STILL ACTIVE
        // ----------------------------------------------------

        let questionIds = [];

        try {
          if (
            Array.isArray(
              existing.question_ids
            )
          ) {
            questionIds =
              existing.question_ids;
          } else if (
            typeof existing.question_ids ===
            "string"
          ) {
            questionIds =
              JSON.parse(
                existing.question_ids
              );
          }
        } catch (parseError) {
          console.error(
            "Question ID JSON parse error:",
            parseError
          );

          questionIds = [];
        }

        if (!Array.isArray(questionIds)) {
          questionIds = [];
        }

        questionIds =
          questionIds
            .map((id) =>
              String(id).trim()
            )
            .filter(Boolean);

        // ----------------------------------------------------
        // CHECK SESSION QUESTION COUNT
        // ----------------------------------------------------

        if (
          questionIds.length ===
          questionCount
        ) {
          // --------------------------------------------------
          // LOAD QUESTIONS
          // --------------------------------------------------

          const placeholders =
            questionIds
              .map(() => "?")
              .join(",");

          const [
            sessionQuestions,
          ] =
            await connection.query(
              `
              SELECT
                qid,
                test_id,
                department_id,
                pattern_id,
                question_type,
                word,
                optA,
                optB,
                optC,
                optD,
                points,
                difficulty
              FROM questions
              WHERE qid IN (${placeholders})
                AND test_id = ?
                AND department_id = ?
                AND pattern_id = ?
              `,
              [
                ...questionIds,
                testId,
                departmentId,
                patternId,
              ]
            );

          // --------------------------------------------------
          // CHECK EVERY QUESTION EXISTS
          // --------------------------------------------------

          const questionMap =
            new Map(
              sessionQuestions.map(
                (q) => [
                  String(q.qid),
                  q,
                ]
              )
            );

          const missingQuestionIds =
            questionIds.filter(
              (id) =>
                !questionMap.has(
                  String(id)
                )
            );

          // --------------------------------------------------
          // ALL QUESTIONS STILL AVAILABLE
          // --------------------------------------------------

          if (
            missingQuestionIds.length ===
            0
          ) {
            const orderedQuestions =
              questionIds
                .map((id) =>
                  questionMap.get(
                    String(id)
                  )
                )
                .filter(Boolean)
                .map(publicQuestion);

            await connection.commit();

            return res.json({
              ok: true,
              message:
                "Existing exam session resumed",

              data: {
                session_id:
                  existing.session_id,

                test_id:
                  existing.test_id,

                department_id:
                  existing.department_id,

                pattern_id:
                  existing.pattern_id,

                started_at:
                  existing.started_at,

                expires_at:
                  existing.expires_at,

                server_now:
                  new Date().toISOString(),

                total_questions:
                  orderedQuestions.length,

                time_limit_minutes:
                  timeLimitMinutes,

                questions:
                  orderedQuestions,
              },
            });
          }

          // --------------------------------------------------
          // SOME QUESTIONS WERE DELETED
          // --------------------------------------------------

          console.warn(
            "Existing session contains missing questions:",
            {
              session_id:
                existing.session_id,

              user_id:
                userId,

              missingQuestionIds,
            }
          );
        }

        // ----------------------------------------------------
        // SESSION IS INVALID
        // ABANDON IT
        // ----------------------------------------------------

        await connection.query(
          `
          UPDATE exam_sessions
          SET status = 'abandoned'
          WHERE session_id = ?
          `,
          [existing.session_id]
        );
      }
    }

    // ========================================================
    // 13. GET FRESH QUESTIONS
    // ========================================================

    const [questions] =
      await connection.query(
        `
        SELECT
          qid,
          test_id,
          department_id,
          pattern_id,
          question_type,
          word,
          optA,
          optB,
          optC,
          optD,
          points,
          difficulty
        FROM questions
        WHERE test_id = ?
          AND department_id = ?
          AND pattern_id = ?
        ORDER BY RAND()
        LIMIT ?
        `,
        [
          testId,
          departmentId,
          patternId,
          questionCount,
        ]
      );

    // --------------------------------------------------------
    // 14. NOT ENOUGH QUESTIONS
    // --------------------------------------------------------

    if (
      questions.length <
      questionCount
    ) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,

        error:
          `Not enough questions available for your exam. ` +
          `Required: ${questionCount}, ` +
          `Available: ${questions.length}.`,

        required_questions:
          questionCount,

        available_questions:
          questions.length,
      });
    }

    // --------------------------------------------------------
    // 15. GENERATE SESSION ID
    // --------------------------------------------------------

    const sessionId =
      crypto.randomUUID();

    const startedAt =
      new Date();

    const expiresAt =
      new Date(
        startedAt.getTime() +
          timeLimitMinutes *
            60 *
            1000
      );

    const questionIds =
      questions.map((q) =>
        String(q.qid)
      );

    // --------------------------------------------------------
    // 16. INSERT SESSION
    // --------------------------------------------------------

    await connection.query(
      `
      INSERT INTO exam_sessions
      (
        session_id,
        user_id,
        test_id,
        department_id,
        pattern_id,
        question_ids,
        started_at,
        expires_at,
        status
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        'active'
      )
      `,
      [
        sessionId,
        userId,
        testId,
        departmentId,
        patternId,
        JSON.stringify(
          questionIds
        ),
        startedAt,
        expiresAt,
      ]
    );

    // --------------------------------------------------------
    // 17. COMMIT
    // --------------------------------------------------------

    await connection.commit();

    // --------------------------------------------------------
    // 18. RETURN SESSION
    // --------------------------------------------------------

    return res.json({
      ok: true,

      message:
        "New exam session started",

      data: {
        session_id:
          sessionId,

        test_id:
          testId,

        department_id:
          departmentId,

        pattern_id:
          patternId,

        started_at:
          startedAt.toISOString(),

        expires_at:
          expiresAt.toISOString(),

        server_now:
          new Date().toISOString(),

        total_questions:
          questions.length,

        time_limit_minutes:
          timeLimitMinutes,

        questions:
          questions.map(
            publicQuestion
          ),
      },
    });
  } catch (error) {
    // --------------------------------------------------------
    // ROLLBACK ON ERROR
    // --------------------------------------------------------

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Rollback error:",
          rollbackError
        );
      }
    }

    console.error(
      "Start exam session error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        "Could not start exam session",
    });
  } finally {
    // --------------------------------------------------------
    // RELEASE CONNECTION
    // --------------------------------------------------------

    if (connection) {
      connection.release();
    }
  }
}


// ============================================================
// GET EXISTING EXAM SESSION
// ============================================================

export async function getExamSession(
  req,
  res
) {
  try {
    // --------------------------------------------------------
    // AUTH
    // --------------------------------------------------------

    if (
      !req.user ||
      req.user.role !== "student"
    ) {
      return res.status(403).json({
        ok: false,
        error:
          "Student access required",
      });
    }

    const userId =
      String(
        req.user.id ||
        req.user.user_id ||
        ""
      ).trim();

    const { sessionId } =
      req.params;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error:
          "Invalid student account",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        ok: false,
        error:
          "Session ID is required",
      });
    }

    const db =
      await dbPromise;

    // --------------------------------------------------------
    // GET SESSION
    // --------------------------------------------------------

    const [rows] =
      await db.query(
        `
        SELECT
          session_id,
          user_id,
          test_id,
          department_id,
          pattern_id,
          question_ids,
          started_at,
          expires_at,
          submitted_at,
          status
        FROM exam_sessions
        WHERE session_id = ?
          AND user_id = ?
        LIMIT 1
        `,
        [
          sessionId,
          userId,
        ]
      );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        error:
          "Exam session not found",
      });
    }

    const session =
      rows[0];

    const now =
      new Date();

    // --------------------------------------------------------
    // EXPIRE SESSION IF TIME IS OVER
    // --------------------------------------------------------

    if (
      session.status ===
        "active" &&
      new Date(
        session.expires_at
      ).getTime() <=
        now.getTime()
    ) {
      await db.query(
        `
        UPDATE exam_sessions
        SET status = 'expired'
        WHERE session_id = ?
          AND status = 'active'
        `,
        [sessionId]
      );

      return res.status(400).json({
        ok: false,
        error:
          "Exam time has expired",
        status:
          "expired",
      });
    }

    // --------------------------------------------------------
    // SESSION MUST BE ACTIVE
    // --------------------------------------------------------

    if (
      session.status !==
      "active"
    ) {
      return res.status(400).json({
        ok: false,
        error:
          `Exam session is ${session.status}`,
        status:
          session.status,
      });
    }

    // --------------------------------------------------------
    // REMAINING TIME
    // --------------------------------------------------------

    const remainingSeconds =
      Math.max(
        0,
        Math.ceil(
          (
            new Date(
              session.expires_at
            ).getTime() -
            now.getTime()
          ) / 1000
        )
      );

    return res.json({
      ok: true,

      data: {
        session_id:
          session.session_id,

        test_id:
          session.test_id,

        department_id:
          session.department_id,

        pattern_id:
          session.pattern_id,

        started_at:
          session.started_at,

        expires_at:
          session.expires_at,

        server_now:
          now.toISOString(),

        remaining_seconds:
          remainingSeconds,

        status:
          session.status,
      },
    });
  } catch (error) {
    console.error(
      "Get exam session error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        "Could not get exam session",
    });
  }
}