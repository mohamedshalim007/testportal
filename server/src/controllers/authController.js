import { dbPromise } from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const DEFAULT_TEST_ID = "default_test";

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret || secret === "SUPER_SECRET_TOKEN" || secret.length < 32) {
    throw new Error("JWT_SECRET is not configured with a secure value (minimum 32 characters)");
  }
  return secret;
}

function validId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function verifyPassword(plainPassword, storedPassword, userId, table, idColumn) {
  if (!storedPassword) return false;
  const looksBcrypt = /^\$2[aby]\$\d{2}\$/.test(storedPassword);

  if (looksBcrypt) return bcrypt.compare(plainPassword, storedPassword);

  // Temporary compatibility for old records. Upgrade immediately after a valid login.
  if (storedPassword !== plainPassword) return false;
  const newHash = await bcrypt.hash(plainPassword, 12);
  await dbPromise.query(`UPDATE ${table} SET password = ? WHERE ${idColumn} = ?`, [newHash, userId]);
  return true;
}

async function loadStudent(userId) {
  const [rows] = await dbPromise.query(
    `SELECT u.user_id, u.name, u.email, u.reg_no, u.password,
            u.department_id, u.pattern_id, u.test_id, u.login_count,
            u.face_image_url, u.face_descriptor, u.created_at, u.is_active,
            d.name AS department_name, d.code AS department_code,
            d.is_active AS department_active,
            p.pattern_no, p.total_questions, p.time_limit_minutes,
            p.passing_percentage, p.is_active AS pattern_active,
            t.title AS test_title, t.is_active AS test_active
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN question_patterns p ON p.id = u.pattern_id
     LEFT JOIN tests t ON t.test_id = COALESCE(u.test_id, ?)
     WHERE u.user_id = ?
     LIMIT 1`,
    [DEFAULT_TEST_ID, userId]
  );
  return rows[0] || null;
}

async function validateAssignment(departmentId, patternId) {
  const dept = validId(departmentId);
  const pattern = validId(patternId);
  if (!dept || !pattern) throw new Error("A valid department and pattern are required");

  const [rows] = await dbPromise.query(
    `SELECT p.id, p.pattern_no, p.total_questions, p.time_limit_minutes,
            p.passing_percentage, p.is_active, d.is_active AS department_active
     FROM question_patterns p
     INNER JOIN departments d ON d.id = p.department_id
     WHERE p.id = ? AND p.department_id = ?
     LIMIT 1`,
    [pattern, dept]
  );

  if (!rows.length) throw new Error("Pattern does not belong to the selected department");
  if (!rows[0].is_active || !rows[0].department_active) throw new Error("Selected department or pattern is inactive");
  return rows[0];
}

export async function studentLogin(req, res) {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const regNo = typeof req.body.reg_no === "string" ? req.body.reg_no.trim() : "";
  const requestedDepartmentId = req.body.department_id;
  const requestedPatternId = req.body.pattern_id;

  if (!email || !password || !regNo) {
    return res.status(400).json({ ok: false, error: "Email, password, and registration number are required" });
  }

  try {
    const [rows] = await dbPromise.query(
      `SELECT user_id, password FROM users WHERE email = ? AND reg_no = ? LIMIT 1`,
      [email, regNo]
    );

    if (!rows.length) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const record = rows[0];
    if (!(await verifyPassword(password, record.password, record.user_id, "users", "user_id"))) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const user = await loadStudent(record.user_id);
    if (!user) return res.status(401).json({ ok: false, error: "Student account not found" });
    if (!user.is_active) return res.status(403).json({ ok: false, error: "Student account is inactive" });

    const departmentId = validId(user.department_id);
    const patternId = validId(user.pattern_id);

    if (!departmentId || !patternId) {
      return res.status(403).json({
        ok: false,
        error: "Your account is not assigned to a department and question pattern. Please contact the administrator.",
      });
    }

    const selectedDepartment = validId(requestedDepartmentId);
    const selectedPattern = validId(requestedPatternId);

    if (!selectedDepartment || selectedDepartment !== departmentId) {
      return res.status(401).json({ ok: false, error: "Department mismatch. Please select the department assigned to your account." });
    }
    if (!selectedPattern || selectedPattern !== patternId) {
      return res.status(401).json({ ok: false, error: "Pattern mismatch. Please select the pattern assigned to your account." });
    }

    const pattern = await validateAssignment(departmentId, patternId);
    const testId = user.test_id || DEFAULT_TEST_ID;

    if (user.test_active === 0) return res.status(403).json({ ok: false, error: "Your assigned test is inactive" });

    const requiredQuestions = Number(pattern.total_questions);
    const timeLimit = Number(pattern.time_limit_minutes);
    if (!Number.isInteger(requiredQuestions) || requiredQuestions <= 0 || !Number.isInteger(timeLimit) || timeLimit <= 0) {
      return res.status(409).json({ ok: false, error: "Invalid question count or time limit configured for this pattern" });
    }

    const [questionCountRows] = await dbPromise.query(
      `SELECT COUNT(*) AS total FROM questions WHERE test_id = ? AND department_id = ? AND pattern_id = ?`,
      [testId, departmentId, patternId]
    );
    const available = Number(questionCountRows[0]?.total || 0);
    if (available < requiredQuestions) {
      return res.status(409).json({
        ok: false,
        error: `This exam is not ready. ${requiredQuestions} questions are required, but only ${available} are available.`,
        meta: { required_questions: requiredQuestions, available_questions: available },
      });
    }

    if (process.env.ALLOW_RETAKE !== "true") {
      const [submitted] = await dbPromise.query(
        `SELECT id FROM submissions WHERE user_id = ? AND test_id = ? LIMIT 1`,
        [user.user_id, testId]
      );
      if (submitted.length) return res.status(409).json({ ok: false, error: "You have already submitted this exam." });
    }

    await dbPromise.query("UPDATE users SET login_count = login_count + 1 WHERE user_id = ?", [user.user_id]);

    const token = jwt.sign(
      {
        id: user.user_id,
        email: user.email,
        role: "student",
        department_id: departmentId,
        pattern_id: patternId,
        test_id: testId,
      },
      getJwtSecret(),
      { expiresIn: "2h" }
    );

    return res.json({
      ok: true,
      data: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        reg_no: user.reg_no,
        test_id: testId,
        login_count: Number(user.login_count || 0) + 1,
        department_id: departmentId,
        pattern_id: patternId,
        department_name: user.department_name,
        department_code: user.department_code,
        pattern_no: pattern.pattern_no,
        total_questions: requiredQuestions,
        time_limit_minutes: timeLimit,
        passing_percentage: Number(pattern.passing_percentage || 40),
        face_image_url: user.face_image_url,
        created_at: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error("Student login error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Student login failed" });
  }
}

export async function adminLogin(req, res) {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!username || !password) return res.status(400).json({ ok: false, error: "Missing admin credentials" });

  try {
    const [rows] = await dbPromise.query("SELECT * FROM admin WHERE username = ? LIMIT 1", [username]);
    if (!rows.length) return res.status(401).json({ ok: false, error: "Invalid admin credentials" });
    const admin = rows[0];
    if (!(await verifyPassword(password, admin.password, admin.username, "admin", "username"))) {
      return res.status(401).json({ ok: false, error: "Invalid admin credentials" });
    }

    const token = jwt.sign({ username: admin.username, role: "admin" }, getJwtSecret(), { expiresIn: "8h" });
    return res.json({ ok: true, token, data: { username: admin.username, role: "admin" } });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Admin login failed" });
  }
}

async function resolvePatternForDepartment(departmentId, requestedPatternId) {
  const dept = validId(departmentId);
  if (!dept) throw new Error("A valid department is required");

  if (requestedPatternId !== undefined && requestedPatternId !== null && String(requestedPatternId).trim() !== "") {
    return validId(requestedPatternId) || (() => { throw new Error("Invalid pattern ID"); })();
  }

  const [rows] = await dbPromise.query(
    `SELECT id FROM question_patterns
     WHERE department_id = ? AND is_active = 1
     ORDER BY id`,
    [dept]
  );
  if (rows.length === 1) return rows[0].id;
  throw new Error(rows.length === 0 ? "No active pattern exists for this department" : "Pattern is required because this department has multiple active patterns");
}

export async function registerStudent(req, res) {
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

    const [existing] = await dbPromise.query("SELECT user_id FROM users WHERE email = ? OR reg_no = ? LIMIT 1", [email, regNo]);
    if (existing.length) return res.status(409).json({ ok: false, error: "User with this email or registration number already exists" });

    const userId = `U${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const hash = await bcrypt.hash(password, 12);
    await dbPromise.query(
      `INSERT INTO users (user_id, name, email, reg_no, password, department_id, pattern_id, test_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, email, regNo, hash, departmentId, patternId, DEFAULT_TEST_ID]
    );

    return res.json({ ok: true, data: { user_id: userId, name, email, reg_no: regNo, department_id: departmentId, pattern_id: patternId } });
  } catch (err) {
    console.error("Register student error:", err);
    return res.status(400).json({ ok: false, error: err.message });
  }
}
