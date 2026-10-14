// client/src/pages/Score.jsx
import React from "react";

export default function Score({ go, testResult, user, token }) {
  const {
    score,
    answers,
    max_score,
    percentage,
    reason,
    totalQuestions,
    answeredQuestions,
    submissionId,
  } = testResult || {};

  // Calculate number of correct answers
  const correctAnswers = answers?.filter((a) => a.isCorrect).length || 0;
  const wrongAnswers = (answers?.length || 0) - correctAnswers;

  return (
    <div style={{ padding: 40, background: "#eef2f7", minHeight: "100vh" }}>
      <div
        className="portal-container"
        style={{ maxWidth: 600, margin: "0 auto" }}
      >
        <div className="score-box">
          <h1 className="h-title" style={{ marginBottom: 4 }}>
            📊 Exam Results
          </h1>

          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: percentage >= 40 ? "#28a745" : "#dc3545",
              margin: "20px 0",
            }}
          >
            {percentage}%
          </div>

          <div style={{ fontSize: 24, fontWeight: 700, color: "#1a2a4a" }}>
            {score} / {max_score} marks
          </div>

          <div
            style={{
              marginTop: 20,
              textAlign: "left",
              borderTop: "1px solid #e5e7eb",
              paddingTop: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
              }}
            >
              <span>📝 Total Questions:</span>
              <span>
                <strong>{totalQuestions || 0}</strong>
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
              }}
            >
              <span>✅ Answered:</span>
              <span>
                <strong>{answeredQuestions || 0}</strong>
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
              }}
            >
              <span>✅ Correct:</span>
              <span>
                <strong style={{ color: "#28a745" }}>{correctAnswers}</strong>
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
              }}
            >
              <span>❌ Wrong:</span>
              <span>
                <strong style={{ color: "#dc3545" }}>{wrongAnswers}</strong>
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
              }}
            >
              <span>📋 Status:</span>
              <span>
                <strong
                  style={{ color: percentage >= 40 ? "#28a745" : "#dc3545" }}
                >
                  {percentage >= 40 ? "✅ Passed" : "❌ Failed"}
                </strong>
              </span>
            </div>
            {reason && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                }}
              >
                <span>📌 Reason:</span>
                <span>
                  <strong>{reason}</strong>
                </span>
              </div>
            )}
            {submissionId && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                }}
              >
                <span>🆔 Submission ID:</span>
                <span>
                  <strong>{submissionId}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Answer Review */}
          {answers && answers.length > 0 && (
            <div
              style={{
                marginTop: 20,
                textAlign: "left",
                borderTop: "1px solid #e5e7eb",
                paddingTop: 20,
              }}
            >
              <h3 style={{ fontSize: 18, marginBottom: 10 }}>
                📋 Answer Review
              </h3>
              {answers.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    marginBottom: 8,
                    borderRadius: 8,
                    background: a.isCorrect ? "#d4edda" : "#f8d7da",
                    border: `1px solid ${a.isCorrect ? "#c3e6cb" : "#f5c6cb"}`,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    Q{i + 1}: {a.question}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    <span>
                      Your Answer:{" "}
                      <strong>{a.userAnswer || "Not answered"}</strong>
                    </span>
                    <span style={{ marginLeft: 16 }}>
                      Correct:{" "}
                      <strong style={{ color: "#28a745" }}>
                        {a.correctAnswer}
                      </strong>
                    </span>
                    <span style={{ marginLeft: 16 }}>
                      Status:{" "}
                      <strong
                        style={{ color: a.isCorrect ? "#28a745" : "#dc3545" }}
                      >
                        {a.isCorrect ? "✅ Correct" : "❌ Wrong"}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 24,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn-primary"
              onClick={() => go("login")}
              style={{ flex: 1 }}
            >
              🏠 Go to Login
            </button>
            {user && (
              <button
                className="btn-ghost"
                onClick={() => go("instructions")}
                style={{ flex: 1 }}
              >
                🔄 Retake Exam
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
