import { db } from "../db.js";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "faces");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const userId = String(req.body.user_id || "unknown").replace(/[^a-zA-Z0-9_-]/g, "");
    cb(null, `${userId}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

export const uploadFaceImage = [upload.single("image"), (req, res) => {
  const userId = typeof req.body.user_id === "string" ? req.body.user_id.trim() : "";
  if (!userId) return res.status(400).json({ ok: false, error: "User ID is required" });
  if (!req.file) return res.status(400).json({ ok: false, error: "Image file is required" });

  let descriptor = null;
  try { descriptor = req.body.descriptor ? JSON.parse(req.body.descriptor) : null; } catch { descriptor = null; }

  const base = process.env.SERVER_URL || "http://localhost:5000";
  const imageUrl = `${base}/uploads/faces/${req.file.filename}`;
  db.query(
    `UPDATE users SET face_image_url=?, face_descriptor=? WHERE user_id=?`,
    [imageUrl, descriptor ? JSON.stringify(descriptor) : null, userId],
    (err, result) => {
      if (err) {
        fs.unlink(req.file.path, () => {});
        return res.status(500).json({ ok: false, error: err.message });
      }
      if (!result.affectedRows) return res.status(404).json({ ok: false, error: "User not found" });
      res.json({ ok: true, data: { user_id: userId, image_url: imageUrl, has_face: Boolean(descriptor) } });
    }
  );
}];

export function clearFace(req, res) {
  const userId = typeof req.body.user_id === "string" ? req.body.user_id.trim() : "";
  if (!userId) return res.status(400).json({ ok: false, error: "User ID is required" });
  db.query("SELECT face_image_url FROM users WHERE user_id=?", [userId], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!rows.length) return res.status(404).json({ ok: false, error: "User not found" });
    if (rows[0].face_image_url) fs.unlink(path.join(UPLOAD_DIR, path.basename(rows[0].face_image_url)), () => {});
    db.query("UPDATE users SET face_image_url=NULL, face_descriptor=NULL WHERE user_id=?", [userId], (updateErr) => {
      if (updateErr) return res.status(500).json({ ok: false, error: updateErr.message });
      res.json({ ok: true, message: "Face data cleared successfully" });
    });
  });
}

export function verifyFace(req, res) {
  if (req.user?.role !== "student") return res.status(403).json({ ok: false, error: "Student access required" });
  const descriptor = req.body.descriptor;
  if (!Array.isArray(descriptor)) return res.status(400).json({ ok: false, error: "Face descriptor is required" });

  db.query("SELECT face_descriptor FROM users WHERE user_id=? AND is_active=1 LIMIT 1", [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!rows.length) return res.status(404).json({ ok: false, error: "User not found" });
    if (!rows[0].face_descriptor) return res.json({ ok: true, data: { verified: false, status: "NO_FACE", message: "No face registered for this user" } });

    try {
      const stored = typeof rows[0].face_descriptor === "string" ? JSON.parse(rows[0].face_descriptor) : rows[0].face_descriptor;
      const distance = calculateFaceDistance(stored, descriptor);
      const threshold = 0.6;
      const verified = distance < threshold;
      return res.json({ ok: true, data: { verified, confidence: Math.max(0, Math.min(1, 1 - distance / threshold)), distance, threshold, status: verified ? "MATCH" : "NO_MATCH", has_face: true } });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Face verification failed" });
    }
  });
}

function calculateFaceDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 999;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = Number(a[i]) - Number(b[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
