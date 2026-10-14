 // client/src/pages/Login.jsx
import React, { useState, useRef, useEffect } from "react";
import api from "../api";

export default function Login({ go, setUser, setToken }) {
  const [side, setSide] = useState("student");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentReg, setStudentReg] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedPattern, setSelectedPattern] = useState("");

  const [departments, setDepartments] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingPatterns, setLoadingPatterns] = useState(false);

  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPass, setShowPass] = useState(false);

  const cardRef = useRef(null);

  // Fetch departments on load
  useEffect(() => {
    fetchDepartments();
  }, []);

  // Fetch patterns when department changes
  useEffect(() => {
    if (selectedDepartment) {
      fetchPatterns(selectedDepartment);
    } else {
      setPatterns([]);
      setSelectedPattern("");
    }
  }, [selectedDepartment]);

  async function fetchDepartments() {
    setLoadingDepartments(true);
    try {
      const res = await api.get("/api/departments");
      if (res.data.ok) {
        setDepartments(res.data.data);
        console.log('✅ Departments loaded:', res.data.data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
      setErr("Failed to load departments. Please refresh.");
    } finally {
      setLoadingDepartments(false);
    }
  }

  async function fetchPatterns(departmentId) {
    setLoadingPatterns(true);
    try {
      const res = await api.get(`/api/patterns/department/${departmentId}`);
      if (res.data.ok) {
        setPatterns(res.data.data);
        console.log('✅ Patterns loaded:', res.data.data);
        if (res.data.data.length === 0) {
          setErr("No question patterns available for this department");
        } else {
          setErr("");
        }
      }
    } catch (error) {
      console.error("Error fetching patterns:", error);
      setPatterns([]);
      setErr("Failed to load patterns. Please try again.");
    } finally {
      setLoadingPatterns(false);
    }
  }

  // STUDENT LOGIN with department and pattern
  async function studentLogin() {
    if (!studentEmail.trim() || !studentPassword.trim() || !studentReg.trim()) {
      return setErr("Please fill all fields: Email, Password, and Registration Number.");
    }

    if (!selectedDepartment) {
      return setErr("Please select your department.");
    }

    if (!selectedPattern) {
      return setErr("Please select your question pattern.");
    }

    setLoading(true);
    setErr("");

    try {
      const departmentId = parseInt(selectedDepartment);
      const patternId = parseInt(selectedPattern);

      if (isNaN(departmentId) || isNaN(patternId)) {
        setErr("Invalid department or pattern selection.");
        setLoading(false);
        return;
      }

      console.log('🔑 Logging in with:', { 
        email: studentEmail.trim().toLowerCase(),
        reg_no: studentReg.trim(),
        department_id: departmentId,
        pattern_id: patternId
      });

      const res = await api.post("/auth/student", {
        email: studentEmail.trim().toLowerCase(),
        password: studentPassword.trim(),
        reg_no: studentReg.trim(),
        department_id: departmentId,
        pattern_id: patternId,
      });

      if (!res.data?.ok) {
        setErr(res.data?.error || "Invalid credentials.");
        setLoading(false);
        return;
      }

      if (res.data.data && res.data.token) {
        const userData = res.data.data;
        console.log('✅ Login successful:', userData);
        
        setUser(userData);
        setToken(res.data.token);

        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("department", selectedDepartment);
        localStorage.setItem("pattern", selectedPattern);
        localStorage.setItem("department_id", selectedDepartment);
        localStorage.setItem("pattern_id", selectedPattern);
        localStorage.setItem("user_id", userData.user_id);
        localStorage.setItem("user_name", userData.name);

        go("instructions");
      } else {
        setErr("Invalid response from server.");
      }
    } catch (e) {
      console.error("Student login error:", e);
      setErr(e.response?.data?.error || "Network error. Please try again.");
    }

    setLoading(false);
  }

  // ADMIN LOGIN
  async function adminLogin() {
    if (!adminUser.trim() || !adminPass.trim()) {
      return setErr("Please enter admin username and password.");
    }

    setLoading(true);
    setErr("");

    try {
      const res = await api.post("/auth/admin", {
        username: adminUser.trim(),
        password: adminPass.trim(),
      });

      if (!res.data?.ok) {
        setErr(res.data?.error || "Invalid admin credentials.");
        setLoading(false);
        return;
      }

      if (res.data.token) {
        setToken(res.data.token);
        localStorage.setItem("adminToken", res.data.token);
        localStorage.setItem("userType", "admin");
        go("adminDashboard");
      } else {
        setErr("Invalid response from server.");
      }
    } catch (e) {
      console.error("Admin login error:", e);
      setErr(e.response?.data?.error || "Network error. Please try again.");
    }

    setLoading(false);
  }

  // Handle Enter key press
  const handleKeyPress = (e, type) => {
    if (e.key === "Enter") {
      if (type === "student") {
        studentLogin();
      } else {
        adminLogin();
      }
    }
  };

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Poppins", "Inter", sans-serif;
          background: #ffffff;
        }

        .login-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at top left, #ffffff 0, #f3f4ff 45%, #eef2ff 95%);
          color: #111827;
        }

        .lp-nav {
          width: 100%;
          padding: 18px 5vw;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .lp-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 22px;
          letter-spacing: 0.4px;
          color: #111827;
        }

        .lp-logo-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 20px;
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.45);
        }

        .lp-nav-links {
          display: flex;
          align-items: center;
          gap: 26px;
          font-size: 14px;
          color: #1f2937;
        }

        .lp-nav-links span {
          cursor: pointer;
          position: relative;
        }

        .lp-nav-links span::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -4px;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #2563eb, #22c55e);
          border-radius: 999px;
          transition: width 0.22s ease;
        }

        .lp-nav-links span:hover::after {
          width: 100%;
        }

        .lp-nav-cta {
          padding: 8px 18px;
          border-radius: 999px;
          border: 1px solid rgba(37, 99, 235, 0.25);
          background: #ffffff;
          font-size: 13px;
          font-weight: 600;
          color: #1d4ed8;
          cursor: pointer;
          box-shadow: 0 6px 18px rgba(148, 163, 184, 0.35);
          transition: all 0.3s ease;
        }

        .lp-nav-cta:hover {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4);
        }

        .lp-main {
          flex: 1;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          padding: 20px 5vw 40px;
          position: relative;
          gap: 32px;
        }

        .lp-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.18;
          z-index: 0;
        }
        .lp-blob.one {
          width: 320px;
          height: 320px;
          background: #c7d2fe;
          top: 12%;
          left: 4%;
        }
        .lp-blob.two {
          width: 260px;
          height: 260px;
          background: #bae6fd;
          bottom: 6%;
          right: 6%;
        }
        .lp-blob.three {
          width: 220px;
          height: 220px;
          background: #facc15;
          top: 55%;
          left: 40%;
        }

        .lp-left {
          flex: 1 1 320px;
          max-width: 520px;
          z-index: 1;
        }

        .lp-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.09);
          border: 1px solid rgba(37, 99, 235, 0.25);
          font-size: 12px;
          color: #1d4ed8;
          margin-bottom: 10px;
        }

        .lp-badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.25);
        }

        .lp-title {
          font-size: clamp(30px, 4vw, 40px);
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 12px;
        }

        .lp-title span {
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .lp-subtitle {
          font-size: 15px;
          line-height: 1.7;
          color: #374151;
          margin-bottom: 18px;
        }

        .lp-stats-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 18px;
        }

        .lp-pill {
          padding: 8px 14px;
          border-radius: 999px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          font-size: 12px;
          color: #111827;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 8px 20px rgba(148, 163, 184, 0.28);
        }

        .lp-pill strong {
          color: #111827;
        }

        .lp-right {
          flex: 1 1 340px;
          max-width: 450px;
          display: flex;
          justify-content: center;
          z-index: 1;
        }

        .lp-card-wrapper {
          width: 100%;
          max-width: 390px;
          transform: none; /* Disable 3D transform */
        }

        .lp-shadow {
          width: 80%;
          height: 20px;
          background: radial-gradient(circle, rgba(15,23,42,0.22), transparent 60%);
          margin: 16px auto 0;
          filter: blur(4px);
        }

        .flip-box {
          width: 100%;
          height: auto;
          min-height: 520px;
          perspective: 1400px;
        }

        .flip-inner {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(.18,.72,.35,1.1);
        }

        .flip-inner.admin {
          transform: rotateY(180deg);
        }

        .flip-side {
          position: relative;
          width: 100%;
          min-height: 520px;
          border-radius: 24px;
          background: #ffffff;
          border: 1px solid rgba(148,163,184,0.6);
          box-shadow: 0 18px 40px rgba(15,23,42,0.18), 0 0 0 1px rgba(255,255,255,0.9);
          padding: 26px 22px 22px;
          backface-visibility: hidden;
          display: flex;
          flex-direction: column;
        }

        .flip-side.back {
          transform: rotateY(180deg);
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }

        .card-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 4px;
          color: #111827;
        }

        .card-caption {
          font-size: 13px;
          color: #4b5563;
          margin-bottom: 12px;
        }

        .card-tabs {
          display: inline-flex;
          align-items: center;
          padding: 4px;
          border-radius: 999px;
          background: #f3f4f6;
          margin-bottom: 12px;
          align-self: center;
        }

        .card-tab {
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 12px;
          cursor: pointer;
          color: #4b5563;
          transition: all 0.2s ease;
        }

        .card-tab:hover {
          background: #e5e7eb;
        }

        .card-tab.active {
          background: #111827;
          color: white;
        }

        .lp-label {
          font-size: 13px;
          margin-bottom: 3px;
          color: #111827;
          font-weight: 500;
        }

        .lp-label .required {
          color: #ef4444;
          margin-left: 2px;
        }

        .lp-input {
          width: 100%;
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-size: 14px;
          margin-bottom: 8px;
          outline: none;
          background: #f9fafb;
          color: #111827;
          transition: border 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }

        .lp-input::placeholder {
          color: #9ca3af;
        }

        .lp-input:focus {
          border-color: #2563eb;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .lp-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .lp-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 12px;
          padding: 7px 8px;
          border-radius: 8px;
          margin-bottom: 8px;
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }

        .lp-error-icon {
          margin-top: 1px;
        }

        .lp-btn {
          width: 100%;
          margin-top: 4px;
          padding: 11px 12px;
          border-radius: 11px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: #ffffff;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.45);
          transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
        }

        .lp-btn:hover:not(.loading) {
          transform: translateY(-2px);
          box-shadow: 0 18px 38px rgba(37, 99, 235, 0.55);
          filter: brightness(1.03);
        }

        .lp-btn:active:not(.loading) {
          transform: translateY(0);
        }

        .lp-btn.loading {
          opacity: 0.7;
          cursor: not-allowed;
          pointer-events: none;
        }

        .lp-card-footer {
          margin-top: auto;
          font-size: 11px;
          color: #4b5563;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
        }

        .lp-switch-link {
          color: #2563eb;
          cursor: pointer;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .lp-switch-link:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }

        .lp-meta {
          font-size: 11px;
          color: #6b7280;
        }

        .lp-pass-wrapper {
          position: relative;
          width: 100%;
        }

        .lp-eye {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          cursor: pointer;
          font-size: 18px;
          opacity: 0.6;
          transition: all 0.18s ease;
        }
        .lp-eye:hover {
          opacity: 1;
          transform: translateY(-50%) scale(1.05);
        }

        .lp-select-wrapper {
          position: relative;
          width: 100%;
        }

        .lp-select-wrapper select {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-size: 14px;
          background: #f9fafb;
          color: #111827;
          outline: none;
          transition: border 0.18s ease, box-shadow 0.18s ease;
          cursor: pointer;
          margin-bottom: 8px;
        }

        .lp-select-wrapper select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .lp-select-wrapper select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .lp-select-wrapper::after {
          content: "▼";
          position: absolute;
          right: 12px;
          top: 40%;
          color: #6b7280;
          font-size: 12px;
          pointer-events: none;
        }

        @media (max-width: 900px) {
          .lp-main {
            padding-top: 10px;
          }
          .lp-left {
            text-align: center;
            max-width: 600px;
          }

          .lp-stats-row {
            justify-content: center;
          }

          .lp-right {
            max-width: 100%;
          }

          .lp-card-wrapper {
            max-width: 360px;
          }
        }

        @media (max-width: 640px) {
          .lp-nav-links {
            display: none;
          }

          .lp-nav {
            padding-inline: 16px;
          }

          .lp-main {
            padding-inline: 16px;
          }

          .flip-box {
            min-height: 480px;
          }
          
          .flip-side {
            min-height: 480px;
          }
        }
      `}</style>

      <div className="login-page">
        <header className="lp-nav">
          <div className="lp-logo">
            <div className="lp-logo-icon">S</div>
            <span>Smart Edu Portal</span>
          </div>

          <div className="lp-nav-links">
            <span>Overview</span>
            <span>Features</span>
            <span>Support</span>
          </div>

          <button
            className="lp-nav-cta"
            onClick={() => {
              const el = document.getElementById("login-card-area");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            Go to Login
          </button>
        </header>

        <main className="lp-main">
          <div className="lp-blob one" />
          <div className="lp-blob two" />
          <div className="lp-blob three" />

          <section className="lp-left">
            <div className="lp-badge">
              <span className="lp-badge-dot" />
              <span>Department-wise Exam Platform</span>
            </div>

            <h1 className="lp-title">
              Department-specific <span>exam management</span> made simple.
            </h1>

            <p className="lp-subtitle">
              A smart, secure examination portal where students from different
              departments access their specific question patterns. Admins can
              manage departments, patterns, and questions efficiently.
            </p>

            <div className="lp-stats-row">
              <div className="lp-pill">
                🏛️ <strong>Multiple</strong> departments
              </div>
              <div className="lp-pill">
                📋 <strong>Pattern-based</strong> questions
              </div>
              <div className="lp-pill">
                🔐 <strong>Department-wise</strong> access control
              </div>
            </div>
          </section>

          <section className="lp-right" id="login-card-area">
            <div
              className="lp-card-wrapper"
              ref={cardRef}
            >
              <div className="flip-box">
                <div className={`flip-inner ${side === "admin" ? "admin" : ""}`}>
                  {/* STUDENT SIDE */}
                  <div className="flip-side">
                    <div className="card-title">Student Login</div>
                    <div className="card-caption">
                      Enter credentials and select your department & pattern.
                    </div>

                    <div className="card-tabs">
                      <div className="card-tab active">Student</div>
                      <div
                        className="card-tab"
                        onClick={() => {
                          setErr("");
                          setSide("admin");
                        }}
                      >
                        Admin
                      </div>
                    </div>

                    <label className="lp-label">
                      Email Address <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      className="lp-input"
                      placeholder="you@university.edu"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, "student")}
                    />

                    <label className="lp-label">
                      Password <span className="required">*</span>
                    </label>
                    <div className="lp-pass-wrapper">
                      <input
                        type={showPass ? "text" : "password"}
                        className="lp-input"
                        placeholder="Enter password"
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, "student")}
                      />
                      <span
                        className="lp-eye"
                        onClick={() => setShowPass(!showPass)}
                      >
                        {showPass ? "👁️‍🗨️" : "👁️"}
                      </span>
                    </div>

                    <label className="lp-label">
                      Registration Number <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="lp-input"
                      placeholder="Enter registration number"
                      value={studentReg}
                      onChange={(e) => setStudentReg(e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, "student")}
                    />

                    <label className="lp-label">
                      Department <span className="required">*</span>
                    </label>
                    <div className="lp-select-wrapper">
                      <select
                        value={selectedDepartment}
                        onChange={(e) => {
                          setSelectedDepartment(e.target.value);
                          setSelectedPattern("");
                        }}
                        disabled={loadingDepartments}
                      >
                        <option value="">-- Select Department --</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="lp-label">
                      Question Pattern <span className="required">*</span>
                    </label>
                    <div className="lp-select-wrapper">
                      <select
                        value={selectedPattern}
                        onChange={(e) => setSelectedPattern(e.target.value)}
                        disabled={!selectedDepartment || patterns.length === 0 || loadingPatterns}
                      >
                        <option value="">-- Select Pattern --</option>
                        {patterns.map((pattern) => (
                          <option key={pattern.id} value={pattern.id}>
                            Pattern {pattern.pattern_no} ({pattern.total_questions || 0} questions, {pattern.time_limit_minutes || 0} min)
                          </option>
                        ))}
                      </select>
                      {loadingPatterns && (
                        <span style={{ fontSize: 11, color: "#6b7280" }}>
                          Loading patterns...
                        </span>
                      )}
                    </div>

                    {err && side === "student" && (
                      <div className="lp-error">
                        <span className="lp-error-icon">⚠️</span>
                        <span>{err}</span>
                      </div>
                    )}

                    <button
                      className={`lp-btn ${loading && side === "student" ? "loading" : ""}`}
                      onClick={studentLogin}
                      disabled={loading && side === "student"}
                    >
                      {loading && side === "student" ? (
                        <>
                          <span style={{ marginRight: 8 }}>⏳</span>
                          Verifying...
                        </>
                      ) : (
                        "Start Exam →"
                      )}
                    </button>

                    <div className="lp-card-footer">
                      <span className="lp-meta">
                        Only registered students with valid credentials.
                      </span>
                      <span
                        className="lp-switch-link"
                        onClick={() => {
                          setErr("");
                          setSide("admin");
                        }}
                      >
                        Admin Login →
                      </span>
                    </div>
                  </div>

                  {/* ADMIN SIDE */}
                  <div className="flip-side back">
                    <div className="card-title">Admin Login</div>
                    <div className="card-caption">
                      Manage departments, patterns, and questions.
                    </div>

                    <div className="card-tabs">
                      <div
                        className="card-tab"
                        onClick={() => {
                          setErr("");
                          setSide("student");
                        }}
                      >
                        Student
                      </div>
                      <div className="card-tab active">Admin</div>
                    </div>

                    <label className="lp-label">
                      Admin Username <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="lp-input"
                      placeholder="Enter admin username"
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, "admin")}
                    />

                    <label className="lp-label">
                      Password <span className="required">*</span>
                    </label>
                    <input
                      type="password"
                      className="lp-input"
                      placeholder="Enter password"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, "admin")}
                    />

                    {err && side === "admin" && (
                      <div className="lp-error">
                        <span className="lp-error-icon">⚠️</span>
                        <span>{err}</span>
                      </div>
                    )}

                    <button
                      className={`lp-btn ${loading && side === "admin" ? "loading" : ""}`}
                      onClick={adminLogin}
                      disabled={loading && side === "admin"}
                    >
                      {loading && side === "admin" ? (
                        <>
                          <span style={{ marginRight: 8 }}>⏳</span>
                          Authenticating...
                        </>
                      ) : (
                        "Enter Dashboard →"
                      )}
                    </button>

                    <div className="lp-card-footer">
                      <span className="lp-meta">
                        Contact coordinator if you forgot credentials.
                      </span>
                      <span
                        className="lp-switch-link"
                        onClick={() => {
                          setErr("");
                          setSide("student");
                        }}
                      >
                        Student Login →
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lp-shadow" />
            </div>
          </section>
        </main>
      </div>
    </>
  );
}