 // client/src/pages/AdminDashboard/components/Modals/EditQuestionModal.jsx
import React, { useState, useEffect } from "react";
import { FiEdit2, FiX, FiSave, FiFileText, FiAward, FiCheckCircle } from "react-icons/fi";
import { FaQuestionCircle } from "react-icons/fa";

export default function EditQuestionModal({
  isOpen,
  question,
  departments,
  patterns,
  onClose,
  onSave,
  darkMode,
}) {
  const [data, setData] = useState({
    qid: "",
    type: "MCQ",
    word: "",
    A: "",
    B: "",
    C: "",
    D: "",
    correct: "",
    points: 1,
    department_id: "",
    pattern_id: "",
  });

  useEffect(() => {
    if (question) {
      setData({
        qid: question.qid || "",
        type: question.type || "MCQ",
        word: question.word || "",
        A: question.A || "",
        B: question.B || "",
        C: question.C || "",
        D: question.D || "",
        correct: question.correct || "",
        points: question.points || 1,
        department_id: question.department_id || "",
        pattern_id: question.pattern_id || "",
      });
    }
  }, [question]);

  if (!isOpen || !question) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(data);
  };

  const availablePatterns = patterns.filter(
    (p) => p.department_id === parseInt(data.department_id)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: darkMode ? "#1a2332" : "#ffffff",
          color: darkMode ? "#e8edf4" : "#1a2a4a",
          maxWidth: 550,
        }}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            <FiEdit2 style={{ marginRight: 10, verticalAlign: "middle", color: "#3758f9" }} />
            Edit Question
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8, 
              marginBottom: 16,
              padding: "10px 14px",
              background: darkMode ? "#0f1a2e" : "#f8f9fa",
              borderRadius: 8,
              border: `1px solid ${darkMode ? "#2a3a5a" : "#e5e7eb"}`
            }}>
              <FaQuestionCircle size={18} color="#3758f9" />
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                Editing: <strong>#{data.qid}</strong>
              </span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Question Type</label>
                <select
                  className="form-select"
                  value={data.type}
                  onChange={(e) => setData({ ...data, type: e.target.value })}
                >
                  <option value="MCQ">Multiple Choice</option>
                  <option value="FILL">Fill in the Blank</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FiAward size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Points
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Points"
                  value={data.points}
                  onChange={(e) => setData({ ...data, points: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <FiFileText size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Question Text
              </label>
              <textarea
                className="form-textarea"
                placeholder="Enter question text"
                value={data.word}
                onChange={(e) => setData({ ...data, word: e.target.value })}
                rows="2"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={data.department_id}
                  onChange={(e) => {
                    setData({
                      ...data,
                      department_id: e.target.value,
                      pattern_id: "",
                    });
                  }}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Pattern</label>
                <select
                  className="form-select"
                  value={data.pattern_id}
                  onChange={(e) => setData({ ...data, pattern_id: e.target.value })}
                  disabled={!data.department_id}
                  required
                >
                  <option value="">Select Pattern</option>
                  {availablePatterns.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      Pattern {pattern.pattern_no}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {data.type === "MCQ" && (
              <div className="form-options-grid">
                {["A", "B", "C", "D"].map((opt) => (
                  <div key={opt} className="form-group">
                    <label className="form-label">Option {opt}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Option ${opt}`}
                      value={data[opt] || ""}
                      onChange={(e) => setData({ ...data, [opt]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                <FiCheckCircle size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Correct Answer
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={data.type === "MCQ" ? "Enter correct option (A/B/C/D)" : "Enter correct answer"}
                value={data.correct}
                onChange={(e) => setData({ ...data, correct: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              <FiX size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Cancel
            </button>
            <button type="submit" className="btn-save">
              <FiSave size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}