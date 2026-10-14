import React, { useState } from "react";
import "../styles/portal.css";
import api from "../api";

export default function Instructions({ go, user, token }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const goNext = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/test/camera-verification", {
        params: { test_id: user?.test_id || "default_test" },
        headers: { Authorization: `Bearer ${token}` },
      });
      const cameraRequired = res?.data?.camera_verification === "yes";
      go(cameraRequired ? "cameraCheck" : "instruction2");
    } catch (err) {
      console.error("Camera setting fetch error:", err);
      setError("Could not verify the exam settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <div className="portal-container">
        <div className="h-title">Exam Instructions</div>
        <div className="h-subtitle">Please read carefully before starting</div>
        <ul style={{ marginTop: 26, fontSize: 16, lineHeight: 1.7, paddingLeft: 20 }}>
          <li>This is a timed online exam.</li>
          <li>Switching tabs or leaving fullscreen may trigger malpractice handling.</li>
          <li>Internet interruption does not pause the server timer.</li>
          <li>One answer is allowed per question.</li>
          <li>Your score is calculated and stored by the server.</li>
        </ul>

        <div style={{ marginTop: 25, background: "#f3f6ff", borderRadius: 10, padding: 14, border: "1px solid #cad6ff" }}>
          <b>Name:</b> {user?.name}<br />
          <b>Email:</b> {user?.email}<br />
          <b>Registration No:</b> {user?.reg_no}<br />
          <b>Department:</b> {user?.department_name || user?.department_id}<br />
          <b>Pattern:</b> {user?.pattern_no || user?.pattern_id}
        </div>

        {error && <div className="lp-error" style={{ marginTop: 16 }}>{error}</div>}

        <button className="btn-primary" style={{ marginTop: 30, width: "100%" }} onClick={goNext} disabled={loading}>
          {loading ? "Checking exam settings..." : "Next"}
        </button>
        <button className="btn-ghost" style={{ marginTop: 14 }} onClick={() => go("login")} disabled={loading}>
          ⬅ Logout
        </button>
      </div>
    </div>
  );
}
