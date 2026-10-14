 // client/src/pages/CameraCheck.jsx
import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import api from "../api";
import "../styles/portal.css";

export default function CameraCheck({ go, user, token }) {
  const webcamRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState("Loading face models...");
  const [faceDetected, setFaceDetected] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const MODEL_URL = "/models";
        console.log("Loading models from:", MODEL_URL);

        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        setMsg("Models loaded. Align your face and click verify.");
        setLoading(false);
      } catch (e) {
        console.error("Model load error:", e);
        setMsg("Face model load failed. Please check /public/models folder.");
        setLoading(false);
      }
    })();
  }, []);

  // Auto-detect face in video
  useEffect(() => {
    if (loading || !webcamRef.current) return;

    const interval = setInterval(async () => {
      try {
        const video = webcamRef.current.video;
        if (!video) return;

        const det = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (det) {
          setFaceDetected(true);
          setMsg("✅ Face detected! Click verify to continue.");
        } else {
          setFaceDetected(false);
          if (!verifying) {
            setMsg("Please align your face in the camera.");
          }
        }
      } catch (e) {
        console.error("Face detection error:", e);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [loading, webcamRef, verifying]);

  async function captureDescriptor() {
    if (!webcamRef.current) return null;
    const video = webcamRef.current.video;
    if (!video) return null;

    const det = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    return det ? Array.from(det.descriptor) : null;
  }

  async function handleVerify() {
    if (loading || verifying) return;
    
    setVerifying(true);
    setMsg("📸 Capturing face...");

    try {
      const descriptor = await captureDescriptor();
      if (!descriptor) {
        setMsg("❌ Face not detected. Please align your face properly.");
        setVerifying(false);
        return;
      }

      setMsg("🔍 Comparing with registered face...");

      const res = await api.post(
        "/api/face/verify",
        { descriptor },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("VERIFY RESPONSE:", res.data);

      if (res.data.ok) {
        if (res.data.data?.verified === true) {
          setMsg(`✅ Face verified! Confidence: ${Math.round((res.data.data.confidence || 0) * 100)}%. Starting exam...`);
          setTimeout(() => go("instruction2"), 800);
        } else if (res.data.data?.verified === false) {
          setMsg(`❌ Face mismatch. Confidence: ${Math.round((res.data.data.confidence || 0) * 100)}%. Please try again.`);
        } else {
          setMsg("❌ Verification failed. Please try again.");
        }
      } else {
        setMsg(res.data.error || "❌ Verification failed. Try again later.");
      }
    } catch (e) {
      console.error("Verify error:", e);
      setMsg("❌ Face verification error. Contact admin.");
    }

    setVerifying(false);
  }

  return (
    <div style={{ padding: 40, background: "#eef2f7", minHeight: "100vh" }}>
      <div className="portal-container" style={{ textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <div className="h-title" style={{ fontSize: 24, marginBottom: 8 }}>📷 Face Verification</div>
        <div className="h-subtitle" style={{ 
          fontSize: 16, 
          color: msg.includes("✅") ? "#28a745" : msg.includes("❌") ? "#dc3545" : "#4a5c80",
          fontWeight: msg.includes("✅") || msg.includes("❌") ? 600 : 400,
          minHeight: 40,
          padding: "8px 0"
        }}>
          {msg}
        </div>

        <div style={{ position: "relative", display: "inline-block" }}>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user" }}
            style={{
              marginTop: 10,
              width: "100%",
              maxWidth: 480,
              height: 340,
              borderRadius: 12,
              border: faceDetected ? "4px solid #28a745" : "4px solid #dc3545",
              objectFit: "cover",
            }}
          />
          {faceDetected && (
            <div style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(40, 167, 69, 0.9)",
              color: "white",
              padding: "4px 16px",
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 600,
            }}>
              ✅ Face Detected
            </div>
          )}
        </div>

        <button
          className="btn-primary"
          style={{ marginTop: 26, width: "100%", padding: "14px" }}
          onClick={handleVerify}
          disabled={loading || verifying || !faceDetected}
        >
          {verifying ? "⏳ Verifying..." : "✅ Verify Face & Continue"}
        </button>

        <button
          className="btn-ghost"
          style={{ marginTop: 12, width: "100%" }}
          onClick={() => go("login")}
          disabled={verifying}
        >
          ⬅ Cancel
        </button>

        <div style={{ marginTop: 16, fontSize: 12, color: "#6b7280" }}>
          {user?.name && <div>👤 Student: {user.name}</div>}
          {user?.reg_no && <div>🆔 Reg No: {user.reg_no}</div>}
        </div>
      </div>
    </div>
  );
}