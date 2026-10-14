 // client/src/pages/Exam.jsx
import React, { useEffect, useState, useRef } from "react";
import "../styles/portal.css";
import api from "../api";
import Webcam from "react-webcam";
import RealTerminal from "../components/RealTerminal";

// Works out whether a question should render as a fill-in-the-blank box,
// regardless of exactly how the backend labels it (question_type, type,
// different casing, etc). Falls back to "no options present" as the
// strongest signal, since a real MCQ always has at least optA/optB.
function isFillQuestion(q) {
  const rawType = (q.question_type || q.type || q.qtype || "").toString().trim().toUpperCase();
  if (["FILL", "FILL_IN_THE_BLANK", "FILL_BLANK", "TEXT", "TYPE", "INPUT"].includes(rawType)) {
    return true;
  }
  const hasAnyOption = ["A", "B", "C", "D"].some((opt) => !!q[`opt${opt}`]);
  return !hasAnyOption;
}

// Stable per-question key that never collapses two questions onto the same
// answer slot, even if the API sends a missing/duplicate qid.
function getQKey(q, index) {
  return q.qid ?? q.id ?? q._id ?? `q_${index}`;
}

// Deterministic shuffle: every student gets a DIFFERENT question order, but the
// same student always gets the SAME order (page refresh / re-render won't reshuffle).
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededRandom(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleForUser(list, userKey) {
  const arr = [...list];
  const rand = seededRandom(hashSeed(String(userKey || "guest")));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Exam({ go, user, token, setTestResult }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(600);
  const [paused, setPaused] = useState(false);
  const [offline, setOffline] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examSessionId, setExamSessionId] = useState(null);

  const [malpracticeCount, setMalpracticeCount] = useState(0);
  const [popupVisible, setPopupVisible] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const countdownRef = useRef(null);

  // Always-fresh copies for timers / event listeners (avoids stale closures)
  const answersRef = useRef({});
  const questionsRef = useRef([]);
  const submittingRef = useRef(false);
  const sessionExpiresAtRef = useRef(null);
  const serverClockOffsetRef = useRef(0);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const webcamRef = useRef(null);
  const [compilerVisible, setCompilerVisible] = useState("no");
  const [compilerLanguage, setCompilerLanguage] = useState("python");
  const [compilerConnected, setCompilerConnected] = useState(false);

  // ---------------- START / RESUME SERVER-SIDE EXAM SESSION ----------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        // IMPORTANT:
        // Do not send test_id / department_id / pattern_id from the browser.
        // The server gets the student's assigned exam from the authenticated user.
        const res = await api.post(
          "/api/exam-sessions/start",
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (cancelled) return;

        if (!res.data?.ok) {
          throw new Error(
            res.data?.error || "Could not start exam"
          );
        }

        const session = res.data.data;
        const fetchedQuestions = session.questions || [];

        if (!session.session_id) {
          throw new Error("Server did not return an exam session ID.");
        }

        if (!fetchedQuestions.length) {
          throw new Error(
            "No questions were returned for your assigned exam."
          );
        }

        const required = Number(
          session.total_questions || fetchedQuestions.length
        );

        if (fetchedQuestions.length !== required) {
          throw new Error(
            `Server returned ${fetchedQuestions.length} questions, but ${required} are required.`
          );
        }

        setExamSessionId(String(session.session_id));

        sessionExpiresAtRef.current = session.expires_at;

        // Calculate the difference between server time and browser time.
        serverClockOffsetRef.current =
          new Date(session.server_now).getTime() - Date.now();

        // The server has already frozen the question set.
        // This only changes presentation order and does not change the set.
        const orderedQuestions = shuffleForUser(
          fetchedQuestions,
          `${user?.user_id || "guest"}:${session.session_id}`
        );

        setQuestions(orderedQuestions);

        const remainingSeconds = Math.max(
          0,
          Math.ceil(
            (
              new Date(session.expires_at).getTime() -
              (Date.now() + serverClockOffsetRef.current)
            ) / 1000
          )
        );

        if (remainingSeconds <= 0) {
          throw new Error("Your exam time has expired.");
        }

        setTimeLeft(remainingSeconds);

        // Keep these only as client-side convenience values.
        // The server session remains the source of truth.
        localStorage.setItem(
          "exam_session_id",
          String(session.session_id)
        );
        localStorage.setItem(
          "exam_started_at",
          String(session.started_at)
        );
        localStorage.setItem(
          "exam_expires_at",
          String(session.expires_at)
        );

        try {
          const cs = await api.get(
            "/api/test/compiler-setting",
            {
              params: {
                test_id: session.test_id,
              },
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (cs.data.ok) {
            setCompilerVisible(
              cs.data.compiler_visible || "no"
            );
            setCompilerLanguage(
              cs.data.compiler_language || "python"
            );
          }
        } catch (compilerError) {
          console.log(
            "Compiler settings not available, using defaults"
          );
        }
      } catch (error) {
        if (cancelled) return;

        console.error(
          "Error starting/resuming exam session:",
          error
        );

        setQuestions([]);

        alert(
          error?.response?.data?.error ||
          error.message ||
          "Unable to start the exam."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user?.user_id]);

  // ---------------- SERVER-AUTHORITATIVE TIMER ----------------
  useEffect(() => {
    if (
      !examSessionId ||
      !sessionExpiresAtRef.current ||
      autoSubmitted ||
      isSubmitting
    ) {
      return;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (
            new Date(sessionExpiresAtRef.current).getTime() -
            (Date.now() + serverClockOffsetRef.current)
          ) / 1000
        )
      );

      setTimeLeft(remaining);
    };

    tick();

    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [examSessionId, autoSubmitted, isSubmitting]);

  useEffect(() => {
    if (
      timeLeft === 0 &&
      examSessionId &&
      !autoSubmitted &&
      !isSubmitting
    ) {
      finishExam("Time Over");
    }
  }, [
    timeLeft,
    examSessionId,
    autoSubmitted,
    isSubmitting,
  ]);

  // ---------------- ONLINE / OFFLINE ----------------
  useEffect(() => {
    const off = () => {
      // IMPORTANT:
      // Network loss NEVER pauses the official exam timer.
      setOffline(true);
    };

    const on = async () => {
      setOffline(false);

      if (
        !examSessionId ||
        autoSubmitted ||
        isSubmitting
      ) {
        return;
      }

      try {
        const res = await api.get(
          `/api/exam-sessions/${examSessionId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.data?.ok) {
          return;
        }

        const session = res.data.data;

        serverClockOffsetRef.current =
          new Date(session.server_now).getTime() - Date.now();

        sessionExpiresAtRef.current =
          session.expires_at;

        if (session.status !== "active") {
          if (
            session.status === "expired" &&
            !submittingRef.current
          ) {
            finishExam("Time Over");
          }
          return;
        }

        setTimeLeft(
          Number(session.remaining_seconds || 0)
        );
      } catch (error) {
        console.error(
          "Exam session resync failed:",
          error
        );
      }
    };

    window.addEventListener("offline", off);
    window.addEventListener("online", on);

    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, [
    examSessionId,
    token,
    autoSubmitted,
    isSubmitting,
  ]);

  // ---------------- MALPRACTICE POPUP ----------------
  function triggerWarning(reason) {
    if (submittingRef.current) return;

    setMalpracticeCount((prev) => {
      const next = prev + 1;

      if (next < 4) {
        setPopupVisible(true);
        setPaused(true);
        setCountdown(15);

        if (countdownRef.current) clearInterval(countdownRef.current);

        countdownRef.current = setInterval(() => {
          setCountdown((c) => {
            if (c <= 1) {
              clearInterval(countdownRef.current);
              finishExam(reason + " — countdown ended (violation " + next + ")");
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      } else if (next >= 4) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        finishExam(reason + " — 4th violation");
      }

      return next;
    });
  }

  function continueExam() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setPopupVisible(false);
    // The official server timer was never paused.
    setPaused(false);
    try {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } catch (e) {}
  }

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ---------------- FULLSCREEN EXIT ----------------
  useEffect(() => {
    if (autoSubmitted || isSubmitting) return;

    const fs = () => {
      if (!document.fullscreenElement && !autoSubmitted && !popupVisible && !isSubmitting) {
        triggerWarning("Fullscreen exit");
      }
    };
    document.addEventListener("fullscreenchange", fs);
    return () => document.removeEventListener("fullscreenchange", fs);
  }, [autoSubmitted, popupVisible, isSubmitting]);

  // ---------------- TAB SWITCH / MINIMIZE ----------------
  useEffect(() => {
    if (autoSubmitted || isSubmitting) return;

    const h = () => {
      if (document.hidden && !autoSubmitted && !popupVisible && !isSubmitting) {
        triggerWarning("Tab switch / minimized");
      }
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [autoSubmitted, popupVisible, isSubmitting]);

  // ---------------- KEYDOWN: Win key ONLY ----------------
  useEffect(() => {
    if (autoSubmitted || isSubmitting) return;

    const h = (e) => {
      const winKey = e.key === "Meta";

      if (winKey) {
        e.preventDefault();
        triggerWarning("Windows key pressed");
      }

      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        return;
      }
    };

    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [autoSubmitted, isSubmitting]);

  // ---------------- BLOCK COPY ----------------
  useEffect(() => {
    const blockCopyKey = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
      }
    };
    const disableCopyEvent = (e) => e.preventDefault();

    window.addEventListener("keydown", blockCopyKey);
    document.addEventListener("copy", disableCopyEvent);

    return () => {
      window.removeEventListener("keydown", blockCopyKey);
      document.removeEventListener("copy", disableCopyEvent);
    };
  }, []);

  // ---------------- WEBCAM SNAPSHOT ----------------
  useEffect(() => {
    if (
      !examSessionId ||
      autoSubmitted ||
      isSubmitting
    ) {
      return;
    }

    const i = setInterval(
      () => captureSnapshot(),
      30000
    );

    return () => clearInterval(i);
  }, [
    examSessionId,
    autoSubmitted,
    isSubmitting,
  ]);

  async function captureSnapshot() {
    if (
      !examSessionId ||
      !webcamRef.current ||
      autoSubmitted ||
      isSubmitting
    ) {
      return;
    }

    try {
      const img =
        webcamRef.current.getScreenshot();

      if (!img) return;

      const base64 = img.replace(
        /^data:image\/jpeg;base64,/,
        ""
      );

      await api.post(
        "/api/snapshots",
        {
          session_id: examSessionId,
          image: base64,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error) {
      console.error(
        "Snapshot error:",
        error
      );
    }
  }

  function selectAnswer(qkey, val) {
    if (autoSubmitted || isSubmitting) return;
    setAnswers((p) => ({ ...p, [qkey]: val }));
  }

  // ---------------- SUBMIT ----------------
  // One request only. Marks are calculated by the server.
  // The server also decides whether the session is still valid.
  async function finishExam(reason) {
    if (
      submittingRef.current ||
      !examSessionId
    ) {
      return;
    }

    submittingRef.current = true;

    setIsSubmitting(true);
    setAutoSubmitted(true);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    setPopupVisible(false);

    const finalAnswers =
      answersRef.current;

    const finalQuestions =
      questionsRef.current;

    const answeredCount =
      Object.values(finalAnswers).filter(
        (v) =>
          String(v ?? "").trim() !== ""
      ).length;

    try {
      const res = await api.post(
        "/api/submissions",
        {
          // Do NOT send user_id.
          // Do NOT send test_id.
          // Do NOT send started_at.
          // Do NOT send finished_at.
          // The server gets all of these from the session.
          session_id: examSessionId,
          answers_json: finalAnswers,
          malpractice_reason:
            reason || "Manual Submit",
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const d =
        res.data?.data || {};

      setSubmissionId(d.id);

      setTestResult({
        score: d.score ?? 0,
        max_score: d.max_score ?? 0,
        percentage: d.percentage ?? 0,
        answers: d.answers || [],
        reason,
        totalQuestions:
          d.totalQuestions ??
          finalQuestions.length,
        answeredQuestions:
          d.answeredQuestions ??
          answeredCount,
        submissionId: d.id,
      });

      localStorage.removeItem(
        "exam_session_id"
      );
      localStorage.removeItem(
        "exam_started_at"
      );
      localStorage.removeItem(
        "exam_expires_at"
      );

      setIsSubmitting(false);
      go("score");
    } catch (error) {
      console.error(
        "Submit error:",
        error
      );

      const serverMsg =
        error?.response?.data?.error;

      /*
       * Do not show a successful score screen
       * when the server rejected the submission.
       *
       * The student can reconnect and try again
       * while the session is still active.
       */
      setAutoSubmitted(false);
      submittingRef.current = false;
      setIsSubmitting(false);

      alert(
        serverMsg ||
        "The server could not save your submission. Please reconnect and try again."
      );
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleCompilerStatusChange = (connected) => {
    setCompilerConnected(connected);
  };

  const answeredCount = Object.values(answers).filter((v) => String(v ?? "").trim() !== "").length;
  const progressPct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
  const timeCritical = timeLeft <= 60 && timeLeft > 0;

  // ---------------- UI ----------------
  return (
    <>
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "user" }}
        style={{ position: "fixed", width: 1, height: 1, opacity: 0 }}
      />

      {popupVisible && (
        <div
          id="warningPopup"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "#1e1e2e",
            color: "#cdd6f4",
            padding: "30px",
            borderRadius: "12px",
            zIndex: 1000,
            border: "2px solid #f38ba8",
            maxWidth: "400px",
            textAlign: "center",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          <h3 style={{ color: "#f38ba8", marginTop: 0 }}>⚠️ Malpractice Detected</h3>
          <p style={{ fontSize: "14px", color: "#a6adc8" }}>Warning {malpracticeCount} of 3</p>
          <p style={{ fontSize: "16px", margin: "20px 0" }}>
            Click continue within{" "}
            <strong style={{ color: "#89b4fa", fontSize: "24px" }}>{countdown}</strong> seconds
          </p>
          <p style={{ fontSize: "13px", color: "#a6adc8" }}>Otherwise exam will be auto submitted.</p>
          <button
            onClick={continueExam}
            style={{
              backgroundColor: "#89b4fa",
              color: "#1e1e2e",
              border: "none",
              padding: "10px 30px",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              marginTop: "15px",
            }}
          >
            Continue Exam
          </button>
        </div>
      )}

      {popupVisible && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            zIndex: 999,
          }}
        />
      )}

      <div className={`exam-shell ${popupVisible ? "blur" : ""}`}>
        {/* Header */}
        <div
          className="exam-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "15px 20px",
            backgroundColor: "#181825",
            borderBottom: "1px solid #313244",
            flexWrap: "wrap",
            gap: "10px",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <b style={{ color: "#cdd6f4" }}>{user?.name}</b>
            <span style={{ color: "#a6adc8", marginLeft: "8px" }}>— {user?.reg_no}</span>
            <span style={{ marginLeft: 10, fontSize: 13, color: "#6c7086" }}>
              {user?.department_name || user?.department_code || "Dept"} • Pattern: {user?.pattern_no || "N/A"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
            {offline ? (
              <span
                className="timer-badge"
                style={{
                  background: "#f38ba8",
                  color: "#1e1e2e",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                ❌ Internet Lost — Timer Continues
              </span>
            ) : (
              <span
                className={`timer-badge ${timeCritical ? "timer-critical" : ""}`}
                style={{
                  background: timeCritical ? "#f38ba8" : "#89b4fa",
                  color: "#1e1e2e",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  transition: "background 0.3s",
                }}
              >
                ⏳ {formatTime(timeLeft)}
              </span>
            )}
            <span style={{ fontSize: 13, color: "#a6adc8" }}>Questions: {questions.length}</span>
            <span style={{ fontSize: 13, color: "#a6adc8" }}>
              Answered: {answeredCount}
            </span>
            {isSubmitting && <span style={{ color: "#f9e2af", fontSize: "13px" }}>⏳ Submitting...</span>}
          </div>
        </div>

        {/* Progress bar */}
        {!loading && questions.length > 0 && (
          <div style={{ height: 4, background: "#181825" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #89b4fa, #a6e3a1)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}

        {/* Questions */}
        <div
          className="questions-area"
          style={{
            padding: "20px",
            maxHeight: "calc(100vh - 84px)",
            overflowY: "auto",
          }}
        >
          {loading && (
            <div
              className="loading-text"
              style={{
                textAlign: "center",
                color: "#a6adc8",
                padding: "40px",
                fontSize: "18px",
              }}
            >
              Loading questions…
            </div>
          )}

          {!loading && questions.length === 0 && (
            <div className="no-questions" style={{ textAlign: "center", padding: 40, color: "#a6adc8" }}>
              <h3 style={{ color: "#cdd6f4" }}>No questions available</h3>
              <p>Please contact your administrator.</p>
            </div>
          )}

          {!loading &&
            questions.map((q, i) => {
              const qkey = getQKey(q, i);
              const fillType = isFillQuestion(q);

              return (
                <div
                  className="q-box"
                  key={qkey}
                  style={{
                    backgroundColor: "#1e1e2e",
                    borderRadius: "10px",
                    padding: "18px",
                    marginBottom: "16px",
                    border: "1px solid #313244",
                    borderLeft: String(answers[qkey] ?? "").trim() ? "3px solid #a6e3a1" : "3px solid #313244",
                    transition: "border-color 0.2s",
                  }}
                >
                  <div
                    className="q-header"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <span className="q-number" style={{ fontWeight: 700, color: "#89b4fa" }}>
                      Q{i + 1}
                    </span>
                    <span className="q-points" style={{ fontSize: 13, color: "#6c7086" }}>
                      {q.points || 1} point{(q.points || 1) > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="q-text" style={{ marginBottom: 14, color: "#cdd6f4", fontSize: 15, lineHeight: 1.5 }}>
                    {q.word}
                  </div>

                  {fillType ? (
                    <input
                      type="text"
                      className="fill-input"
                      placeholder="Type your answer here..."
                      value={answers[qkey] || ""}
                      onChange={(e) => selectAnswer(qkey, e.target.value)}
                      disabled={autoSubmitted || isSubmitting}
                      autoComplete="off"
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        backgroundColor: "#11111b",
                        color: "#cdd6f4",
                        border: "2px solid #45475a",
                        borderRadius: "8px",
                        fontSize: "15px",
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "border-color 0.2s, box-shadow 0.2s",
                      }}
                    />
                  ) : (
                    ["A", "B", "C", "D"].map((opt) => {
                      const optionText = q[`opt${opt}`];
                      if (!optionText) return null;
                      const selected = answers[qkey] === opt;
                      return (
                        <div
                          key={opt}
                          className={`option-card ${selected ? "option-selected" : ""}`}
                          onClick={() => selectAnswer(qkey, opt)}
                          style={{
                            padding: "12px 14px",
                            marginBottom: "8px",
                            backgroundColor: selected ? "#89b4fa" : "#313244",
                            color: selected ? "#1e1e2e" : "#cdd6f4",
                            borderRadius: "8px",
                            cursor: autoSubmitted || isSubmitting ? "default" : "pointer",
                            opacity: autoSubmitted || isSubmitting ? 0.7 : 1,
                            transition: "all 0.15s",
                            border: selected ? "1px solid #89b4fa" : "1px solid transparent",
                          }}
                        >
                          <span className="option-label" style={{ fontWeight: 600 }}>
                            {opt}.
                          </span>{" "}
                          {optionText}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}

          {compilerVisible === "yes" && !loading && questions.length > 0 && (
            <div className="compiler-section" style={{ marginTop: 20 }}>
              <h4 style={{ color: "#cdd6f4", marginBottom: 12 }}>💻 Online Compiler</h4>
              <RealTerminal
                defaultLanguage={compilerLanguage || "python"}
                sessionId={examSessionId}
                onCompilerStatusChange={handleCompilerStatusChange}
              />
            </div>
          )}

          {!loading && questions.length > 0 && (
            <div className="submit-section" style={{ textAlign: "right", marginTop: 20 }}>
              <button
                className="btn-primary submit-btn"
                onClick={() => {
                  if (window.confirm("Are you sure you want to submit your answers?")) {
                    finishExam("Manual Submit");
                  }
                }}
                disabled={autoSubmitted || isSubmitting}
                style={{
                  backgroundColor: autoSubmitted || isSubmitting ? "#45475a" : "#89b4fa",
                  color: autoSubmitted || isSubmitting ? "#6c7086" : "#1e1e2e",
                  border: "none",
                  padding: "12px 28px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: autoSubmitted || isSubmitting ? "not-allowed" : "pointer",
                  transition: "transform 0.1s, background 0.2s",
                }}
              >
                {isSubmitting ? "⏳ Submitting..." : "📤 Submit Answers"}
              </button>
              <span style={{ marginLeft: 12, fontSize: 13, color: "#6c7086" }}>
                Answered: {answeredCount} / {questions.length}
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .fill-input:focus {
          border-color: #89b4fa !important;
          box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.2);
        }
        .fill-input::placeholder {
          color: #6c7086;
        }
        .option-card:hover {
          filter: brightness(1.1);
        }
        .submit-btn:not(:disabled):hover {
          transform: translateY(-1px);
        }
        .submit-btn:not(:disabled):active {
          transform: translateY(0);
        }
        .timer-critical {
          animation: timerPulse 1s infinite;
        }
        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .questions-area {
          scrollbar-width: thin;
          scrollbar-color: #45475a #181825;
        }
        .questions-area::-webkit-scrollbar {
          width: 8px;
        }
        .questions-area::-webkit-scrollbar-thumb {
          background: #45475a;
          border-radius: 4px;
        }
      `}</style>
    </>
  );
}