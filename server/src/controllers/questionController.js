// server/src/controllers/questionController.js

import { db } from "../db.js";

/*
|--------------------------------------------------------------------------
| GET ALL QUESTIONS
|--------------------------------------------------------------------------
| Admin:
|   Can filter by department / pattern / test.
|
| Student:
|   Can only access questions belonging to their assigned
|   department and pattern.
|
| IMPORTANT:
|   Correct answer is NEVER returned to students.
|--------------------------------------------------------------------------
*/
export function getQuestions(req, res) {
  const isStudent = req.user?.role === "student";

  const testId =
    String(req.query.test_id || "default_test").trim();

  if (!testId) {
    return res.status(400).json({
      ok: false,
      error: "Test ID is required",
    });
  }

  let query = `
    SELECT
      q.qid,
      q.test_id,
      q.department_id,
      q.pattern_id,
      q.question_type,
      q.word,
      q.optA,
      q.optB,
      q.optC,
      q.optD,
      q.correct,
      q.points,
      q.difficulty,
      q.created_at,
      q.updated_at,

      d.name AS department_name,
      d.code AS department_code,

      p.pattern_no,
      p.description AS pattern_description

    FROM questions q

    LEFT JOIN departments d
      ON q.department_id = d.id

    LEFT JOIN question_patterns p
      ON q.pattern_id = p.id

    WHERE q.test_id = ?
  `;

  const params = [testId];

  /*
  |--------------------------------------------------------------------------
  | STUDENT FILTER
  |--------------------------------------------------------------------------
  */

  if (isStudent) {
    const departmentId = Number(req.user?.department_id);
    const patternId = Number(req.user?.pattern_id);

    if (
      !Number.isInteger(departmentId) ||
      departmentId <= 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "Student is not assigned to a department",
      });
    }

    if (
      !Number.isInteger(patternId) ||
      patternId <= 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "Student is not assigned to a question pattern",
      });
    }

    query += `
      AND q.department_id = ?
      AND q.pattern_id = ?
    `;

    params.push(departmentId);
    params.push(patternId);
  } else {
    /*
    |--------------------------------------------------------------------------
    | ADMIN FILTER
    |--------------------------------------------------------------------------
    */

    if (req.query.department_id) {
      const departmentId = Number(req.query.department_id);

      if (
        !Number.isInteger(departmentId) ||
        departmentId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          error: "Invalid department ID",
        });
      }

      query += `
        AND q.department_id = ?
      `;

      params.push(departmentId);
    }

    if (req.query.pattern_id) {
      const patternId = Number(req.query.pattern_id);

      if (
        !Number.isInteger(patternId) ||
        patternId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          error: "Invalid pattern ID",
        });
      }

      query += `
        AND q.pattern_id = ?
      `;

      params.push(patternId);
    }
  }

  query += `
    ORDER BY q.created_at DESC, q.qid DESC
  `;

  db.query(query, params, (err, rows) => {
    if (err) {
      console.error("Get questions error:", err);

      return res.status(500).json({
        ok: false,
        error: "Failed to load questions",
        details: err.message,
      });
    }

    const questions = rows.map((row) => {
      const question = {
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
        department_name: row.department_name,
        department_code: row.department_code,
        pattern_no: row.pattern_no,
        pattern_description: row.pattern_description,
        options:
          row.question_type === "MCQ"
            ? [
                row.optA,
                row.optB,
                row.optC,
                row.optD,
              ].filter(
                (value) =>
                  value !== null &&
                  value !== undefined &&
                  String(value).trim() !== ""
              )
            : [],
      };

      /*
      |--------------------------------------------------------------------------
      | NEVER SEND CORRECT ANSWER TO STUDENT
      |--------------------------------------------------------------------------
      */

      if (!isStudent) {
        question.correct = row.correct;
      }

      return question;
    });

    return res.json({
      ok: true,
      data: questions,
      count: questions.length,
    });
  });
}


/*
|--------------------------------------------------------------------------
| GET QUESTIONS FOR ONE STUDENT
|--------------------------------------------------------------------------
*/

export function getQuestionsForStudent(req, res) {
  const requestedUserId = String(
    req.params.user_id || ""
  ).trim();

  const loggedInUserId = String(
    req.user?.user_id ||
      req.user?.id ||
      ""
  ).trim();

  const isAdmin = req.user?.role === "admin";

  if (!requestedUserId) {
    return res.status(400).json({
      ok: false,
      error: "User ID is required",
    });
  }

  if (!isAdmin && requestedUserId !== loggedInUserId) {
    return res.status(403).json({
      ok: false,
      error: "Not allowed",
    });
  }

  db.query(
    `
      SELECT
        user_id,
        department_id,
        pattern_id,
        test_id,
        is_active
      FROM users
      WHERE user_id = ?
      LIMIT 1
    `,
    [requestedUserId],
    (err, users) => {
      if (err) {
        console.error(
          "Get student information error:",
          err
        );

        return res.status(500).json({
          ok: false,
          error: "Failed to load student",
        });
      }

      if (!users.length) {
        return res.status(404).json({
          ok: false,
          error: "Student not found",
        });
      }

      const student = users[0];

      if (Number(student.is_active) !== 1) {
        return res.status(403).json({
          ok: false,
          error: "Student account is inactive",
        });
      }

      if (
        !student.department_id ||
        !student.pattern_id
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Student is not assigned to a department or pattern",
        });
      }

      const testId =
        String(
          student.test_id || "default_test"
        ).trim();

      const hideAnswers =
        !isAdmin;

      db.query(
        `
          SELECT
            q.qid,
            q.test_id,
            q.department_id,
            q.pattern_id,
            q.question_type,
            q.word,
            q.optA,
            q.optB,
            q.optC,
            q.optD,
            q.correct,
            q.points,
            q.difficulty

          FROM questions q

          WHERE q.test_id = ?
            AND q.department_id = ?
            AND q.pattern_id = ?

          ORDER BY q.created_at ASC, q.qid ASC
        `,
        [
          testId,
          student.department_id,
          student.pattern_id,
        ],
        (questionErr, questions) => {
          if (questionErr) {
            console.error(
              "Get student questions error:",
              questionErr
            );

            return res.status(500).json({
              ok: false,
              error:
                "Failed to load student questions",
            });
          }

          const safeQuestions =
            questions.map((q) => {
              const result = {
                qid: q.qid,
                test_id: q.test_id,
                department_id: q.department_id,
                pattern_id: q.pattern_id,
                question_type: q.question_type,
                word: q.word,
                optA: q.optA,
                optB: q.optB,
                optC: q.optC,
                optD: q.optD,
                points: q.points,
                difficulty: q.difficulty,
                options:
                  q.question_type === "MCQ"
                    ? [
                        q.optA,
                        q.optB,
                        q.optC,
                        q.optD,
                      ].filter(
                        (value) =>
                          value !== null &&
                          value !== undefined &&
                          String(value).trim() !== ""
                      )
                    : [],
              };

              if (!hideAnswers) {
                result.correct = q.correct;
              }

              return result;
            });

          return res.json({
            ok: true,
            data: safeQuestions,
            count: safeQuestions.length,
            meta: {
              user_id: student.user_id,
              department_id:
                student.department_id,
              pattern_id:
                student.pattern_id,
              test_id: testId,
            },
          });
        }
      );
    }
  );
}


/*
|--------------------------------------------------------------------------
| CREATE QUESTION
|--------------------------------------------------------------------------
*/

export function createQuestion(req, res) {
  const body = req.body || {};

  const testId = String(
    body.test_id || "default_test"
  ).trim();

  const word = String(
    body.word || ""
  ).trim();

  const questionType = String(
    body.question_type ||
      body.type ||
      "MCQ"
  )
    .trim()
    .toUpperCase();

  const optA = String(
    body.optA || body.A || ""
  ).trim();

  const optB = String(
    body.optB || body.B || ""
  ).trim();

  const optC = String(
    body.optC || body.C || ""
  ).trim();

  const optD = String(
    body.optD || body.D || ""
  ).trim();

  const correct = String(
    body.correct || ""
  ).trim();

  const departmentId = Number(
    body.department_id
  );

  const patternId = Number(
    body.pattern_id
  );

  const points = Number(
    body.points ?? 1
  );

  /*
  |--------------------------------------------------------------------------
  | BASIC VALIDATION
  |--------------------------------------------------------------------------
  */

  if (!word) {
    return res.status(400).json({
      ok: false,
      error: "Question text is required",
    });
  }

  if (
    ![
      "MCQ",
      "FILL",
      "TRUE_FALSE",
    ].includes(questionType)
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Invalid question type. Use MCQ, FILL or TRUE_FALSE",
    });
  }

  if (
    !Number.isInteger(departmentId) ||
    departmentId <= 0
  ) {
    return res.status(400).json({
      ok: false,
      error: "Valid department is required",
    });
  }

  if (
    !Number.isInteger(patternId) ||
    patternId <= 0
  ) {
    return res.status(400).json({
      ok: false,
      error: "Valid pattern is required",
    });
  }

  if (!correct) {
    return res.status(400).json({
      ok: false,
      error: "Correct answer is required",
    });
  }

  if (
    !Number.isInteger(points) ||
    points <= 0
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Points must be a positive integer",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | VALIDATE DEPARTMENT
  |--------------------------------------------------------------------------
  */

  db.query(
    `
      SELECT
        id,
        name,
        code,
        is_active
      FROM departments
      WHERE id = ?
      LIMIT 1
    `,
    [departmentId],
    (departmentErr, departments) => {
      if (departmentErr) {
        console.error(
          "Department validation error:",
          departmentErr
        );

        return res.status(500).json({
          ok: false,
          error:
            "Failed to validate department",
          details: departmentErr.message,
        });
      }

      if (!departments.length) {
        return res.status(400).json({
          ok: false,
          error:
            "Selected department does not exist",
        });
      }

      const department =
        departments[0];

      if (
        Number(department.is_active) !== 1
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Selected department is inactive",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | VALIDATE PATTERN
      |--------------------------------------------------------------------------
      */

      db.query(
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
        [patternId],
        (patternErr, patterns) => {
          if (patternErr) {
            console.error(
              "Pattern validation error:",
              patternErr
            );

            return res.status(500).json({
              ok: false,
              error:
                "Failed to validate pattern",
              details: patternErr.message,
            });
          }

          if (!patterns.length) {
            return res.status(400).json({
              ok: false,
              error:
                "Selected pattern does not exist",
            });
          }

          const pattern =
            patterns[0];

          if (
            Number(pattern.is_active) !== 1
          ) {
            return res.status(400).json({
              ok: false,
              error:
                "Selected pattern is inactive",
            });
          }

          /*
          |--------------------------------------------------------------------------
          | CRITICAL RELATIONSHIP CHECK
          |--------------------------------------------------------------------------
          */

          if (
            Number(
              pattern.department_id
            ) !== departmentId
          ) {
            return res.status(400).json({
              ok: false,
              error:
                "Selected pattern does not belong to the selected department",
            });
          }

          /*
          |--------------------------------------------------------------------------
          | QUESTION TYPE VALIDATION
          |--------------------------------------------------------------------------
          */

          if (
            questionType === "MCQ"
          ) {
            if (
              !optA ||
              !optB ||
              !optC ||
              !optD
            ) {
              return res.status(400).json({
                ok: false,
                error:
                  "MCQ requires all four options: A, B, C and D",
              });
            }

            const normalizedCorrect =
              correct.toUpperCase();

            if (
              ![
                "A",
                "B",
                "C",
                "D",
              ].includes(
                normalizedCorrect
              )
            ) {
              return res.status(400).json({
                ok: false,
                error:
                  "For MCQ, correct answer must be A, B, C or D",
              });
            }
          }

          if (
            questionType ===
            "TRUE_FALSE"
          ) {
            const normalized =
              correct.toLowerCase();

            if (
              ![
                "true",
                "false",
              ].includes(normalized)
            ) {
              return res.status(400).json({
                ok: false,
                error:
                  "For TRUE/FALSE, correct answer must be true or false",
              });
            }
          }

          /*
          |--------------------------------------------------------------------------
          | FILL QUESTION
          |--------------------------------------------------------------------------
          */

          const finalA =
            questionType === "MCQ"
              ? optA
              : "";

          const finalB =
            questionType === "MCQ"
              ? optB
              : "";

          const finalC =
            questionType === "MCQ"
              ? optC
              : "";

          const finalD =
            questionType === "MCQ"
              ? optD
              : "";

          const finalCorrect =
            questionType === "MCQ"
              ? correct.toUpperCase()
              : correct;

          /*
          |--------------------------------------------------------------------------
          | UNIQUE QUESTION ID
          |--------------------------------------------------------------------------
          */

          const qid =
            `Q${Date.now()}${Math.floor(
              Math.random() * 100000
            )}`;

          /*
          |--------------------------------------------------------------------------
          | INSERT
          |--------------------------------------------------------------------------
          */

          const insertQuery = `
            INSERT INTO questions (
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
              correct,
              points,
              difficulty
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          const insertParams = [
            qid,
            testId,
            departmentId,
            patternId,
            questionType,
            word,
            finalA,
            finalB,
            finalC,
            finalD,
            finalCorrect,
            points,
            "MEDIUM",
          ];

          db.query(
            insertQuery,
            insertParams,
            (insertErr, result) => {
              if (insertErr) {
                console.error(
                  "Create question database error:",
                  insertErr
                );

                /*
                |----------------------------------------------------------------
                | DUPLICATE / DATABASE ERROR
                |----------------------------------------------------------------
                */

                return res.status(500).json({
                  ok: false,
                  error:
                    "Failed to create question",
                  details:
                    insertErr.message,
                  code:
                    insertErr.code ||
                    null,
                });
              }

              return res.status(201).json({
                ok: true,
                message:
                  "Question added successfully",
                data: {
                  qid,
                  test_id: testId,
                  department_id:
                    departmentId,
                  pattern_id:
                    patternId,
                  question_type:
                    questionType,
                  word,
                  points,
                  affectedRows:
                    result.affectedRows,
                },
              });
            }
          );
        }
      );
    }
  );
}


/*
|--------------------------------------------------------------------------
| UPDATE QUESTION
|--------------------------------------------------------------------------
*/

export function updateQuestion(
  req,
  res
) {
  const body = req.body || {};

  const qid = String(
    body.qid || ""
  ).trim();

  const word = String(
    body.word || ""
  ).trim();

  const questionType =
    String(
      body.question_type ||
        body.type ||
        "MCQ"
    )
      .trim()
      .toUpperCase();

  const optA = String(
    body.optA || body.A || ""
  ).trim();

  const optB = String(
    body.optB || body.B || ""
  ).trim();

  const optC = String(
    body.optC || body.C || ""
  ).trim();

  const optD = String(
    body.optD || body.D || ""
  ).trim();

  const correct = String(
    body.correct || ""
  ).trim();

  const departmentId =
    Number(body.department_id);

  const patternId =
    Number(body.pattern_id);

  const points =
    Number(body.points ?? 1);

  if (!qid) {
    return res.status(400).json({
      ok: false,
      error:
        "Question ID is required",
    });
  }

  if (!word) {
    return res.status(400).json({
      ok: false,
      error:
        "Question text is required",
    });
  }

  if (
    ![
      "MCQ",
      "FILL",
      "TRUE_FALSE",
    ].includes(questionType)
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Invalid question type",
    });
  }

  if (
    !Number.isInteger(departmentId) ||
    departmentId <= 0
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Valid department is required",
    });
  }

  if (
    !Number.isInteger(patternId) ||
    patternId <= 0
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Valid pattern is required",
    });
  }

  if (
    !Number.isInteger(points) ||
    points <= 0
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Points must be a positive integer",
    });
  }

  if (!correct) {
    return res.status(400).json({
      ok: false,
      error:
        "Correct answer is required",
    });
  }

  if (
    questionType === "MCQ"
  ) {
    if (
      !optA ||
      !optB ||
      !optC ||
      !optD
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "MCQ requires all four options",
      });
    }

    if (
      ![
        "A",
        "B",
        "C",
        "D",
      ].includes(
        correct.toUpperCase()
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Correct answer must be A, B, C or D",
      });
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CHECK PATTERN -> DEPARTMENT
  |--------------------------------------------------------------------------
  */

  db.query(
    `
      SELECT
        id,
        department_id,
        is_active
      FROM question_patterns
      WHERE id = ?
      LIMIT 1
    `,
    [patternId],
    (patternErr, patterns) => {
      if (patternErr) {
        return res.status(500).json({
          ok: false,
          error:
            "Failed to validate pattern",
          details:
            patternErr.message,
        });
      }

      if (!patterns.length) {
        return res.status(400).json({
          ok: false,
          error:
            "Selected pattern does not exist",
        });
      }

      if (
        Number(patterns[0].is_active) !== 1
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Selected pattern is inactive",
        });
      }

      if (
        Number(
          patterns[0].department_id
        ) !== departmentId
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Selected pattern does not belong to the selected department",
        });
      }

      const finalCorrect =
        questionType === "MCQ"
          ? correct.toUpperCase()
          : correct;

      db.query(
        `
          UPDATE questions
          SET
            word = ?,
            question_type = ?,
            optA = ?,
            optB = ?,
            optC = ?,
            optD = ?,
            correct = ?,
            points = ?,
            department_id = ?,
            pattern_id = ?
          WHERE qid = ?
        `,
        [
          word,
          questionType,
          questionType === "MCQ"
            ? optA
            : "",
          questionType === "MCQ"
            ? optB
            : "",
          questionType === "MCQ"
            ? optC
            : "",
          questionType === "MCQ"
            ? optD
            : "",
          finalCorrect,
          points,
          departmentId,
          patternId,
          qid,
        ],
        (err, result) => {
          if (err) {
            console.error(
              "Update question error:",
              err
            );

            return res.status(500).json({
              ok: false,
              error:
                "Failed to update question",
              details:
                err.message,
            });
          }

          if (
            result.affectedRows === 0
          ) {
            return res.status(404).json({
              ok: false,
              error:
                "Question not found",
            });
          }

          return res.json({
            ok: true,
            message:
              "Question updated successfully",
          });
        }
      );
    }
  );
}


/*
|--------------------------------------------------------------------------
| DELETE ONE QUESTION
|--------------------------------------------------------------------------
*/

export function deleteQuestion(
  req,
  res
) {
  const qid = String(
    req.params.qid || ""
  ).trim();

  if (!qid) {
    return res.status(400).json({
      ok: false,
      error:
        "Question ID is required",
    });
  }

  db.query(
    `
      DELETE FROM questions
      WHERE qid = ?
    `,
    [qid],
    (err, result) => {
      if (err) {
        console.error(
          "Delete question error:",
          err
        );

        return res.status(500).json({
          ok: false,
          error:
            "Failed to delete question",
          details:
            err.message,
        });
      }

      if (
        result.affectedRows === 0
      ) {
        return res.status(404).json({
          ok: false,
          error:
            "Question not found",
        });
      }

      return res.json({
        ok: true,
        message:
          "Question deleted successfully",
      });
    }
  );
}


/*
|--------------------------------------------------------------------------
| DELETE ALL QUESTIONS
|--------------------------------------------------------------------------
*/

export function deleteAllQuestions(
  req,
  res
) {
  const testId = String(
    req.query.test_id ||
      "default_test"
  ).trim();

  if (!testId) {
    return res.status(400).json({
      ok: false,
      error:
        "Test ID is required",
    });
  }

  db.query(
    `
      DELETE FROM questions
      WHERE test_id = ?
    `,
    [testId],
    (err, result) => {
      if (err) {
        console.error(
          "Delete all questions error:",
          err
        );

        return res.status(500).json({
          ok: false,
          error:
            "Failed to delete questions",
          details:
            err.message,
        });
      }

      return res.json({
        ok: true,
        message:
          `Deleted ${result.affectedRows} questions`,
        deleted:
          result.affectedRows,
      });
    }
  );
}


/*
|--------------------------------------------------------------------------
| GET QUESTIONS BY DEPARTMENT
|--------------------------------------------------------------------------
*/

export function getQuestionsByDepartment(
  req,
  res
) {
  const departmentId =
    Number(req.params.departmentId);

  if (
    !Number.isInteger(departmentId) ||
    departmentId <= 0
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Invalid department ID",
    });
  }

  db.query(
    `
      SELECT
        q.qid,
        q.test_id,
        q.department_id,
        q.pattern_id,
        q.question_type,
        q.word,
        q.optA,
        q.optB,
        q.optC,
        q.optD,
        q.correct,
        q.points,
        q.difficulty,

        p.pattern_no

      FROM questions q

      LEFT JOIN question_patterns p
        ON q.pattern_id = p.id

      WHERE q.department_id = ?

      ORDER BY q.created_at DESC
    `,
    [departmentId],
    (err, rows) => {
      if (err) {
        console.error(
          "Get questions by department error:",
          err
        );

        return res.status(500).json({
          ok: false,
          error:
            "Failed to load questions",
          details:
            err.message,
        });
      }

      return res.json({
        ok: true,
        data: rows,
        count: rows.length,
      });
    }
  );
}


/*
|--------------------------------------------------------------------------
| GET QUESTIONS BY PATTERN
|--------------------------------------------------------------------------
*/

export function getQuestionsByPattern(
  req,
  res
) {
  const patternId =
    Number(req.params.patternId);

  if (
    !Number.isInteger(patternId) ||
    patternId <= 0
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Invalid pattern ID",
    });
  }

  db.query(
    `
      SELECT
        q.qid,
        q.test_id,
        q.department_id,
        q.pattern_id,
        q.question_type,
        q.word,
        q.optA,
        q.optB,
        q.optC,
        q.optD,
        q.correct,
        q.points,
        q.difficulty,

        d.name AS department_name,
        d.code AS department_code,

        p.pattern_no

      FROM questions q

      LEFT JOIN departments d
        ON q.department_id = d.id

      LEFT JOIN question_patterns p
        ON q.pattern_id = p.id

      WHERE q.pattern_id = ?

      ORDER BY q.created_at DESC
    `,
    [patternId],
    (err, rows) => {
      if (err) {
        console.error(
          "Get questions by pattern error:",
          err
        );

        return res.status(500).json({
          ok: false,
          error:
            "Failed to load questions",
          details:
            err.message,
        });
      }

      return res.json({
        ok: true,
        data: rows,
        count: rows.length,
      });
    }
  );
}