// server/src/utils/cascade.js
// Cascading deletes done inside ONE transaction (all-or-nothing), children first.
//
// Dependency map (parent -> children):
//   departments  -> users, question_patterns, questions, submissions
//   question_patterns -> questions, submissions, users.pattern_id (students are only un-assigned)
//   users        -> snapshots (+ image files), submissions, face image file
//   questions    -> nothing (submissions keep their stored score)
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dbPromise } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.join(__dirname, "..", "uploads");
const FACES = path.join(UPLOADS, "faces");

// remove files AFTER the DB commit succeeded; never throw
function removeFiles(urls) {
  for (const u of urls) {
    if (!u) continue;
    const name = path.basename(String(u));
    for (const dir of [UPLOADS, FACES]) {
      fs.unlink(path.join(dir, name), () => {});
    }
  }
}

const inClause = (arr) => arr.map(() => "?").join(",");

async function withTx(work) {
  const conn = await dbPromise.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// delete the given students and everything that belongs to them
async function deleteUsersTx(conn, userIds, files) {
  if (!userIds.length) return { users: 0, submissions: 0, snapshots: 0 };
  const ph = inClause(userIds);

  const [snaps] = await conn.query(`SELECT image_url FROM snapshots WHERE user_id IN (${ph})`, userIds);
  const [faces] = await conn.query(`SELECT face_image_url FROM users WHERE user_id IN (${ph})`, userIds);
  snaps.forEach((s) => files.push(s.image_url));
  faces.forEach((f) => files.push(f.face_image_url));

  const [s1] = await conn.query(`DELETE FROM snapshots WHERE user_id IN (${ph})`, userIds);
  const [s2] = await conn.query(`DELETE FROM submissions WHERE user_id IN (${ph})`, userIds);
  const [s3] = await conn.query(`DELETE FROM users WHERE user_id IN (${ph})`, userIds);
  return { users: s3.affectedRows, submissions: s2.affectedRows, snapshots: s1.affectedRows };
}

export async function cascadeDeleteUser(userId) {
  const files = [];
  const out = await withTx((conn) => deleteUsersTx(conn, [userId], files));
  if (out.users) removeFiles(files);
  return out;
}

export async function cascadeDeletePattern(patternId) {
  const [p] = await dbPromise.query("SELECT id FROM question_patterns WHERE id = ?", [patternId]);
  if (!p.length) return null;
  return withTx(async (conn) => {
    const [a] = await conn.query("DELETE FROM submissions WHERE pattern_id = ?", [patternId]);
    const [b] = await conn.query("DELETE FROM questions WHERE pattern_id = ?", [patternId]);
    // students stay in their department, they just lose this pattern
    const [c] = await conn.query("UPDATE users SET pattern_id = NULL WHERE pattern_id = ?", [patternId]);
    await conn.query("DELETE FROM question_patterns WHERE id = ?", [patternId]);
    return { submissions: a.affectedRows, questions: b.affectedRows, students_unassigned: c.affectedRows };
  });
}

export async function cascadeDeleteDepartment(deptId) {
  const [d] = await dbPromise.query("SELECT id FROM departments WHERE id = ?", [deptId]);
  if (!d.length) return null;
  const files = [];
  const out = await withTx(async (conn) => {
    const [us] = await conn.query("SELECT user_id FROM users WHERE department_id = ?", [deptId]);
    const u = await deleteUsersTx(conn, us.map((r) => r.user_id), files);
    const [a] = await conn.query("DELETE FROM submissions WHERE department_id = ?", [deptId]);
    const [b] = await conn.query("DELETE FROM questions WHERE department_id = ?", [deptId]);
    const [c] = await conn.query("DELETE FROM question_patterns WHERE department_id = ?", [deptId]);
    await conn.query("DELETE FROM departments WHERE id = ?", [deptId]);
    return {
      students: u.users,
      submissions: u.submissions + a.affectedRows,
      snapshots: u.snapshots,
      questions: b.affectedRows,
      patterns: c.affectedRows,
    };
  });
  removeFiles(files);
  return out;
}
