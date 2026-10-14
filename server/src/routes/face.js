import express from "express";
import { db } from "../db.js";
import { euclideanDistance } from "../utils/distance.js"; // function to compare vectors

const router = express.Router();
const THRESHOLD = 0.45;

router.post("/verify", (req, res) => {
  const { user_id, descriptor } = req.body;

  db.query(
    "SELECT face_descriptor FROM users WHERE user_id = ? LIMIT 1",
    [user_id],
    (err, result) => {
      if (err) return res.json({ ok: false, error: err });

      if (!result.length || !result[0].face_descriptor) {
        return res.json({ ok: false, status: "NO_REGISTERED_FACE" });
      }

      const saved = JSON.parse(result[0].face_descriptor);
      const score = euclideanDistance(descriptor, saved);

      if (score <= THRESHOLD) {
        return res.json({ ok: true, status: "MATCH" });
      } else {
        return res.json({ ok: true, status: "MISMATCH" });
      }
    }
  );
});

export default router;
