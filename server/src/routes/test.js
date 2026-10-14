import express from "express";
import { db } from "../db.js";
const router = express.Router();

// GET Camera Verification
router.get("/camera-verification", (req, res) => {
  const { test_id } = req.query;

  db.query(
    "SELECT camera_verification FROM test_settings WHERE test_id = ? LIMIT 1",
    [test_id],
    (err, rows) => {
      if (err) return res.json({ ok: false, error: err });
      if (!rows.length)
        return res.json({ ok: true, camera_verification: "no" });
      return res.json({
        ok: true,
        camera_verification: rows[0].camera_verification,
      });
    }
  );
});

// UPDATE Camera Verification
router.post("/camera-verification", (req, res) => {
  const { test_id, value } = req.body;

  db.query(
    "INSERT INTO test_settings (test_id, camera_verification) VALUES (?, ?) ON DUPLICATE KEY UPDATE camera_verification = ?",
    [test_id, value, value],
    (err) => {
      if (err) return res.json({ ok: false, error: err });
      return res.json({ ok: true });
    }
  );
});

export default router;
