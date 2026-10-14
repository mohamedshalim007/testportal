 // server/src/controllers/patternController.js
import { db } from "../db.js";
import { cascadeDeleteUser, cascadeDeletePattern, cascadeDeleteDepartment } from "../utils/cascade.js";

// Get all patterns
export function getPatterns(req, res) {
  db.query(
    `SELECT p.*, d.name as department_name, d.code as department_code,
       (SELECT COUNT(*) FROM questions WHERE pattern_id = p.id) as question_count
     FROM question_patterns p
     LEFT JOIN departments d ON p.department_id = d.id
     ORDER BY d.name, p.pattern_no`,
    (err, rows) => {
      if (err) {
        console.error("Get patterns error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      res.json({ ok: true, data: rows });
    }
  );
}

// Get patterns by department
export function getPatternsByDepartment(req, res) {
  const { departmentId } = req.params;

  // Validate departmentId
  if (!departmentId || isNaN(departmentId)) {
    return res.status(400).json({ 
      ok: false, 
      error: "Valid department ID is required" 
    });
  }

  db.query(
    `SELECT p.*, d.name as department_name, d.code as department_code
     FROM question_patterns p
     LEFT JOIN departments d ON p.department_id = d.id
     WHERE p.department_id = ? AND p.is_active = TRUE
     ORDER BY p.pattern_no`,
    [departmentId],
    (err, rows) => {
      if (err) {
        console.error("Get patterns by department error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      res.json({ ok: true, data: rows });
    }
  );
}

// Get pattern by ID
export function getPatternById(req, res) {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ 
      ok: false, 
      error: "Valid pattern ID is required" 
    });
  }

  db.query(
    `SELECT p.*, d.name as department_name, d.code as department_code,
       (SELECT COUNT(*) FROM questions WHERE pattern_id = p.id) as question_count
     FROM question_patterns p
     LEFT JOIN departments d ON p.department_id = d.id
     WHERE p.id = ?`,
    [id],
    (err, rows) => {
      if (err) {
        console.error("Get pattern error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      if (!rows.length) {
        return res.status(404).json({ ok: false, error: "Pattern not found" });
      }

      res.json({ ok: true, data: rows[0] });
    }
  );
}

// Create pattern
export function createPattern(req, res) {
  const { 
    pattern_no, department_id, description, 
    total_questions, time_limit_minutes, passing_percentage, is_active 
  } = req.body;

  // Validate required fields
  if (!pattern_no || !department_id) {
    return res.status(400).json({ 
      ok: false, 
      error: "Pattern number and department are required" 
    });
  }

  // Validate department exists
  db.query(
    "SELECT id FROM departments WHERE id = ?",
    [department_id],
    (err, rows) => {
      if (err) {
        console.error("Check department error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      if (!rows.length) {
        return res.status(404).json({ 
          ok: false, 
          error: "Department not found" 
        });
      }

      // Check if pattern already exists
      db.query(
        "SELECT * FROM question_patterns WHERE department_id = ? AND pattern_no = ?",
        [department_id, pattern_no],
        (err, rows) => {
          if (err) {
            console.error("Check pattern error:", err);
            return res.status(500).json({ ok: false, error: err.message });
          }

          if (rows.length > 0) {
            return res.status(409).json({ 
              ok: false, 
              error: "Pattern already exists for this department" 
            });
          }

          // Insert new pattern
          db.query(
            `INSERT INTO question_patterns 
             (pattern_no, department_id, description, total_questions, 
              time_limit_minutes, passing_percentage, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              pattern_no, 
              department_id, 
              description || '', 
              total_questions || 10, 
              time_limit_minutes || 30,
              passing_percentage || 40,
              is_active !== undefined ? is_active : true
            ],
            (err, result) => {
              if (err) {
                console.error("Create pattern error:", err);
                return res.status(500).json({ ok: false, error: err.message });
              }

              res.json({ 
                ok: true, 
                data: { 
                  id: result.insertId, 
                  pattern_no,
                  department_id
                },
                message: "Pattern created successfully"
              });
            }
          );
        }
      );
    }
  );
}

// Update pattern
export function updatePattern(req, res) {
  const { id } = req.params;
  const { 
    pattern_no, department_id, description, 
    total_questions, time_limit_minutes, passing_percentage, is_active 
  } = req.body;

  if (!id || isNaN(id)) {
    return res.status(400).json({ 
      ok: false, 
      error: "Valid pattern ID is required" 
    });
  }

  // Check if pattern exists
  db.query(
    "SELECT id FROM question_patterns WHERE id = ?",
    [id],
    (err, rows) => {
      if (err) {
        console.error("Check pattern error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      if (!rows.length) {
        return res.status(404).json({ 
          ok: false, 
          error: "Pattern not found" 
        });
      }

      // If department_id is changing, validate new department
      if (department_id) {
        db.query(
          "SELECT id FROM departments WHERE id = ?",
          [department_id],
          (err, rows) => {
            if (err) {
              console.error("Check department error:", err);
              return res.status(500).json({ ok: false, error: err.message });
            }

            if (!rows.length) {
              return res.status(404).json({ 
                ok: false, 
                error: "Department not found" 
              });
            }

            updatePatternData(id, department_id, pattern_no, description, 
              total_questions, time_limit_minutes, passing_percentage, is_active, res);
          }
        );
      } else {
        updatePatternData(id, department_id, pattern_no, description, 
          total_questions, time_limit_minutes, passing_percentage, is_active, res);
      }
    }
  );
}

// Helper function for updating pattern
function updatePatternData(id, department_id, pattern_no, description, 
  total_questions, time_limit_minutes, passing_percentage, is_active, res) {
  
  db.query(
    `UPDATE question_patterns 
     SET pattern_no = ?, 
         department_id = COALESCE(?, department_id), 
         description = ?, 
         total_questions = ?, 
         time_limit_minutes = ?, 
         passing_percentage = ?,
         is_active = ?
     WHERE id = ?`,
    [
      pattern_no, 
      department_id, 
      description || '', 
      total_questions || 10, 
      time_limit_minutes || 30,
      passing_percentage || 40,
      is_active !== undefined ? is_active : true,
      id
    ],
    (err, result) => {
      if (err) {
        console.error("Update pattern error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ ok: false, error: "Pattern not found" });
      }

      res.json({ 
        ok: true, 
        message: "Pattern updated successfully" 
      });
    }
  );
}

// Delete pattern + its questions and submissions (students are un-assigned, not deleted)
export async function deletePattern(req, res) {
  const { id } = req.params;
  if (!id || isNaN(id)) return res.status(400).json({ ok: false, error: "Valid pattern ID is required" });
  try {
    const out = await cascadeDeletePattern(id);
    if (!out) return res.status(404).json({ ok: false, error: "Pattern not found" });
    res.json({ ok: true, message: `Pattern deleted (${out.questions} questions, ${out.submissions} submissions removed)`, data: out });
  } catch (err) {
    console.error("Delete pattern error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// Get pattern statistics
export function getPatternStats(req, res) {
  db.query(
    `SELECT 
       COUNT(*) as total_patterns,
       SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_patterns,
       AVG(total_questions) as avg_questions,
       AVG(time_limit_minutes) as avg_time_limit
     FROM question_patterns`,
    (err, rows) => {
      if (err) {
        console.error("Get pattern stats error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      res.json({ ok: true, data: rows[0] });
    }
  );
}

// Get patterns with question count
export function getPatternsWithQuestionCount(req, res) {
  db.query(
    `SELECT 
       p.*, 
       d.name as department_name,
       d.code as department_code,
       COUNT(q.qid) as actual_question_count
     FROM question_patterns p
     LEFT JOIN departments d ON p.department_id = d.id
     LEFT JOIN questions q ON q.pattern_id = p.id
     GROUP BY p.id
     ORDER BY d.name, p.pattern_no`,
    (err, rows) => {
      if (err) {
        console.error("Get patterns with count error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      res.json({ ok: true, data: rows });
    }
  );
}