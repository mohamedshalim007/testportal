import { db, dbPromise } from "../db.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

export function getSnapshots(req, res) {
  db.query(
    `SELECT s.*, u.name AS user_name FROM snapshots s LEFT JOIN users u ON s.user_id=u.user_id ORDER BY s.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, data: rows.map((s) => ({ ...s, timestamp: s.created_at, image_url: s.image_url || "" })) });
    }
  );
}

export function getSnapshotsByUser(req, res) {
  db.query(`SELECT * FROM snapshots WHERE user_id=? ORDER BY created_at DESC`, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, data: rows });
  });
}

export async function createSnapshot(req, res) {
  if (req.user?.role !== "student") return res.status(403).json({ ok: false, error: "Student access required" });

  const sessionId = typeof req.body.session_id === "string" ? req.body.session_id.trim() : "";
  const image = req.body.image;
  const imageUrl = req.body.image_url;
  if (!sessionId || (!image && !imageUrl)) return res.status(400).json({ ok: false, error: "session_id and image are required" });

  try {
    const [sessions] = await dbPromise.query(
      `SELECT session_id, user_id, test_id, status, expires_at FROM exam_sessions WHERE session_id=? AND user_id=? LIMIT 1`,
      [sessionId, req.user.id]
    );
    if (!sessions.length) return res.status(404).json({ ok: false, error: "Exam session not found" });
    const session = sessions[0];
    if (session.status !== "active") return res.status(409).json({ ok: false, error: "Exam session is no longer active" });
    if (new Date(session.expires_at).getTime() <= Date.now()) return res.status(408).json({ ok: false, error: "Exam session has expired" });

    let finalUrl = imageUrl || null;
    if (image) {
      const base64 = String(image).replace(/^data:image\/\w+;base64,/, "");
      const safeUser = String(req.user.id).replace(/[^a-zA-Z0-9_-]/g, "");
      const fileName = `snap_${safeUser}_${Date.now()}.jpg`;
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, fileName), Buffer.from(base64, "base64"));
      finalUrl = `/uploads/${fileName}`;
    }

    const [result] = await dbPromise.query(
      `INSERT INTO snapshots (user_id, test_id, image_url) VALUES (?, ?, ?)`,
      [session.user_id, session.test_id, finalUrl]
    );
    return res.json({ ok: true, data: { id: result.insertId, image_url: finalUrl } });
  } catch (err) {
    console.error("Create snapshot error:", err);
    return res.status(500).json({ ok: false, error: "Could not save snapshot" });
  }
}

export function deleteSnapshot(req, res) {
  db.query("SELECT image_url FROM snapshots WHERE id=?", [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!rows.length) return res.status(404).json({ ok: false, error: "Snapshot not found" });
    if (rows[0].image_url) {
      const filePath = path.join(UPLOAD_DIR, path.basename(rows[0].image_url));
      fs.unlink(filePath, () => {});
    }
    db.query("DELETE FROM snapshots WHERE id=?", [req.params.id], (deleteErr, result) => {
      if (deleteErr) return res.status(500).json({ ok: false, error: deleteErr.message });
      if (!result.affectedRows) return res.status(404).json({ ok: false, error: "Snapshot not found" });
      res.json({ ok: true, message: "Snapshot deleted successfully" });
    });
  });
}
