import { db } from "../db.js";
import { cascadeDeleteUser } from "../utils/cascade.js";
import bcrypt from "bcrypt";

const DEFAULT_TEST_ID = "default_test";

function validId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function resolvePatternForDepartment(departmentId, requestedPatternId) {
  const dept = validId(departmentId);
  if (!dept) throw new Error("A valid department is required");

  if (requestedPatternId !== undefined && requestedPatternId !== null && String(requestedPatternId).trim() !== "") {
    const pattern = validId(requestedPatternId);
    if (!pattern) throw new Error("Invalid pattern ID");
    return pattern;
  }

  const [rows] = await db.promise().query(
    `SELECT id FROM question_patterns WHERE department_id = ? AND is_active = 1 ORDER BY id`,
    [dept]
  );
  if (rows.length === 1) return rows[0].id;
  if (!rows.length) throw new Error("No active question pattern exists for this department");
  throw new Error("Pattern is required because this department has multiple active patterns");
}

async function validateAssignment(departmentId, patternId) {
  const dept = validId(departmentId);
  const pattern = validId(patternId);
  if (!dept || !pattern) throw new Error("Valid department and pattern are required");

  const [rows] = await db.promise().query(
    `SELECT p.id
     FROM question_patterns p
     INNER JOIN departments d ON d.id = p.department_id
     WHERE p.id = ? AND p.department_id = ? AND p.is_active = 1 AND d.is_active = 1
     LIMIT 1`,
    [pattern, dept]
  );
  if (!rows.length) throw new Error("Pattern does not belong to the selected department or is inactive");
}

export function getUsers(req, res) {
  db.query(
    `SELECT u.*, d.name AS department_name, d.code AS department_code, p.pattern_no
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN question_patterns p ON u.pattern_id = p.id
     ORDER BY u.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, data: rows.map((u) => { delete u.password; delete u.face_descriptor; return u; }) });
    }
  );
}

export async function createUser(req, res) {
  const userId = typeof req.body.user_id === "string" ? req.body.user_id.trim() : "";
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const regNo = typeof req.body.reg_no === "string" ? req.body.reg_no.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const departmentId = validId(req.body.department_id);

  if (!name || !email || !regNo || !password || !departmentId) {
    return res.status(400).json({ ok: false, error: "Name, email, registration number, password, and department are required" });
  }

  try {
    const patternId = await resolvePatternForDepartment(departmentId, req.body.pattern_id);
    await validateAssignment(departmentId, patternId);
    const [existing] = await db.promise().query("SELECT user_id FROM users WHERE email = ? OR reg_no = ? LIMIT 1", [email, regNo]);
    if (existing.length) return res.status(409).json({ ok: false, error: "User with this email or registration number already exists" });

    const finalUserId = userId || `U${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const hash = await bcrypt.hash(password, 12);
    await db.promise().query(
      `INSERT INTO users (user_id, name, email, reg_no, password, department_id, pattern_id, test_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [finalUserId, name, email, regNo, hash, departmentId, patternId, DEFAULT_TEST_ID]
    );
    return res.json({ ok: true, data: { user_id: finalUserId, name, email, reg_no: regNo, department_id: departmentId, pattern_id: patternId } });
  } catch (err) {
    console.error("Create user error:", err);
    return res.status(400).json({ ok: false, error: err.message });
  }
}

export async function bulkCreateUsers(req, res) {
  const { users } = req.body;
  if (!Array.isArray(users) || users.length === 0) return res.status(400).json({ ok: false, error: "No users provided for bulk import" });

  const results = { success: [], failed: [] };
  for (const userData of users) {
    try {
      const name = typeof userData.name === "string" ? userData.name.trim() : "";
      const email = typeof userData.email === "string" ? userData.email.trim().toLowerCase() : "";
      const regNo = typeof userData.reg_no === "string" ? userData.reg_no.trim() : "";
      const password = typeof userData.password === "string" ? userData.password : "";
      const departmentId = validId(userData.department_id);

      if (!name || !email || !regNo || !password || !departmentId) {
        results.failed.push({ data: userData, error: "Name, email, reg_no, password and department_id are required" });
        continue;
      }

      const patternId = await resolvePatternForDepartment(departmentId, userData.pattern_id);
      await validateAssignment(departmentId, patternId);

      const [existing] = await db.promise().query("SELECT user_id FROM users WHERE email = ? OR reg_no = ? LIMIT 1", [email, regNo]);
      if (existing.length) {
        results.failed.push({ data: userData, error: "User with this email or registration number already exists" });
        continue;
      }

      const hash = await bcrypt.hash(password, 12);
      const userId = `U${Date.now()}${Math.floor(Math.random() * 100000)}${results.success.length}`;
      await db.promise().query(
        `INSERT INTO users (user_id, name, email, reg_no, password, department_id, pattern_id, test_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, email, regNo, hash, departmentId, patternId, DEFAULT_TEST_ID]
      );
      results.success.push({ user_id: userId, name, email, reg_no: regNo, department_id: departmentId, pattern_id: patternId });
    } catch (err) {
      results.failed.push({ data: userData, error: err.message });
    }
  }

  return res.json({
    ok: true,
    data: {
      total: users.length,
      success: results.success.length,
      failed: results.failed.length,
      successData: results.success,
      failedData: results.failed,
      errors: results.failed.map((f) => f.error),
    },
  });
}

export function getUserById(req, res) {
  db.query(
    `SELECT u.*, d.name AS department_name, d.code AS department_code, p.pattern_no
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN question_patterns p ON u.pattern_id = p.id
     WHERE u.user_id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      if (!rows.length) return res.status(404).json({ ok: false, error: "User not found" });
      const user = rows[0]; delete user.password; delete user.face_descriptor;
      res.json({ ok: true, data: user });
    }
  );
}

export async function updateUser(req, res) {
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const regNo = typeof req.body.reg_no === "string" ? req.body.reg_no.trim() : "";
  const departmentId = validId(req.body.department_id);
  if (!id || !name || !email || !regNo || !departmentId) return res.status(400).json({ ok: false, error: "User ID, name, email, registration number, and department are required" });

  try {
    const patternId = await resolvePatternForDepartment(departmentId, req.body.pattern_id);
    await validateAssignment(departmentId, patternId);
    const [duplicates] = await db.promise().query(`SELECT user_id FROM users WHERE (email = ? OR reg_no = ?) AND user_id <> ? LIMIT 1`, [email, regNo, id]);
    if (duplicates.length) return res.status(409).json({ ok: false, error: "Another user already uses this email or registration number" });
    const [result] = await db.promise().query(
      `UPDATE users SET name = ?, email = ?, reg_no = ?, department_id = ?, pattern_id = ? WHERE user_id = ?`,
      [name, email, regNo, departmentId, patternId, id]
    );
    if (!result.affectedRows) return res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, message: "User updated successfully" });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

export async function deleteUser(req, res) {
  try {
    const out = await cascadeDeleteUser(req.params.id);
    if (!out.users) return res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, message: `Student deleted (with ${out.submissions} submissions, ${out.snapshots} snapshots)`, data: out });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

export function getUsersByDepartment(req, res) {
  db.query(
    `SELECT u.*, p.pattern_no FROM users u LEFT JOIN question_patterns p ON u.pattern_id = p.id WHERE u.department_id = ? ORDER BY u.name`,
    [req.params.departmentId],
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, data: rows.map((u) => { delete u.password; delete u.face_descriptor; return u; }) });
    }
  );
}

export function getUsersWithoutFace(req, res) {
  db.query(
    `SELECT u.user_id, u.name, u.email, u.reg_no, d.name AS department_name
     FROM users u LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.face_descriptor IS NULL OR u.face_descriptor = '' ORDER BY u.name`,
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, data: rows });
    }
  );
}

export function updateLoginCount(req, res) {
  db.query("UPDATE users SET login_count = login_count + 1 WHERE user_id = ?", [req.params.userId], (err, result) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!result.affectedRows) return res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, message: "Login count updated" });
  });
}
