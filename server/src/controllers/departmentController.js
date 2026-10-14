// server/src/controllers/departmentController.js
import { db } from "../db.js";
import { cascadeDeleteUser, cascadeDeletePattern, cascadeDeleteDepartment } from "../utils/cascade.js";

// Get all departments
export function getDepartments(req, res) {
  db.query(
    `SELECT d.*, 
       (SELECT COUNT(*) FROM users WHERE department_id = d.id) as student_count,
       (SELECT COUNT(*) FROM question_patterns WHERE department_id = d.id) as pattern_count
     FROM departments d
     ORDER BY d.name`,
    (err, rows) => {
      if (err) {
        console.error("Get departments error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      res.json({ ok: true, data: rows });
    }
  );
}

// Get department by ID
export function getDepartmentById(req, res) {
  const { id } = req.params;

  db.query(
    `SELECT d.*, 
       (SELECT COUNT(*) FROM users WHERE department_id = d.id) as student_count
     FROM departments d
     WHERE d.id = ?`,
    [id],
    (err, rows) => {
      if (err) {
        console.error("Get department error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      if (!rows.length) {
        return res.status(404).json({ ok: false, error: "Department not found" });
      }

      res.json({ ok: true, data: rows[0] });
    }
  );
}

// Create department
export function createDepartment(req, res) {
  const { name, code, description } = req.body;

  if (!name || !code) {
    return res.status(400).json({ ok: false, error: "Name and code are required" });
  }

  // Check if department exists
  db.query(
    "SELECT * FROM departments WHERE name = ? OR code = ?",
    [name, code.toUpperCase()],
    (err, rows) => {
      if (err) {
        console.error("Check department error:", err);
        return res.status(500).json({ ok: false, error: err.message });
      }

      if (rows.length > 0) {
        return res.status(409).json({ ok: false, error: "Department already exists" });
      }

      db.query(
        "INSERT INTO departments (name, code, description) VALUES (?, ?, ?)",
        [name, code.toUpperCase(), description || ''],
        (err, result) => {
          if (err) {
            console.error("Create department error:", err);
            return res.status(500).json({ ok: false, error: err.message });
          }

          res.json({ ok: true, data: { id: result.insertId, name, code } });
        }
      );
    }
  );
}

// Update department
export async function updateDepartment(req, res) {
  const id = Number(req.params.id);
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const code = typeof req.body.code === "string" ? req.body.code.trim().toUpperCase() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  const isActive = req.body.is_active !== undefined ? Boolean(req.body.is_active) : true;

  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Valid department ID is required" });
  if (!name) return res.status(400).json({ ok: false, error: "Department name is required" });
  if (!code) return res.status(400).json({ ok: false, error: "Department code is required" });

  try {
    const [duplicates] = await db.promise().query(
      `SELECT id FROM departments
       WHERE (name = ? OR code = ?) AND id <> ?
       LIMIT 1`,
      [name, code, id]
    );
    if (duplicates.length) return res.status(409).json({ ok: false, error: "Another department already uses this name or code" });

    const [result] = await db.promise().query(
      `UPDATE departments
       SET name = ?, code = ?, description = ?, is_active = ?
       WHERE id = ?`,
      [name, code, description, isActive ? 1 : 0, id]
    );

    if (!result.affectedRows) return res.status(404).json({ ok: false, error: "Department not found" });
    return res.json({ ok: true, message: "Department updated successfully" });
  } catch (err) {
    console.error("Update department error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// Delete department + everything under it (students, patterns, questions, submissions, snapshots)
export async function deleteDepartment(req, res) {
  try {
    const out = await cascadeDeleteDepartment(req.params.id);
    if (!out) return res.status(404).json({ ok: false, error: "Department not found" });
    res.json({ ok: true, message: "Department deleted with all related data", data: out });
  } catch (err) {
    console.error("Delete department error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}