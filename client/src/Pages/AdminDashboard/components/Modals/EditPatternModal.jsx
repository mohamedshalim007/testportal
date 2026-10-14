 // client/src/pages/AdminDashboard/components/Modals/EditPatternModal.jsx
import React, { useState, useEffect } from "react";
import { FiEdit2, FiX, FiSave, FiCheckCircle, FiXCircle, FiClock, FiFileText } from "react-icons/fi";
import { FiLayers } from "react-icons/fi";

export default function EditPatternModal({
  isOpen,
  pattern,
  onClose,
  onSave,
  darkMode,
}) {
  const [data, setData] = useState({
    pattern_no: "",
    total_questions: 10,
    time_limit_minutes: 30,
    description: "",
    passing_percentage: 40,
    is_active: true,
  });

  useEffect(() => {
    if (pattern) {
      setData({
        pattern_no: pattern.pattern_no || "",
        total_questions: pattern.total_questions || 10,
        time_limit_minutes: pattern.time_limit_minutes || 30,
        description: pattern.description || "",
        passing_percentage: pattern.passing_percentage || 40,
        is_active: pattern.is_active !== undefined ? pattern.is_active : true,
      });
    }
  }, [pattern]);

  if (!isOpen || !pattern) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(pattern.id, data);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: darkMode ? "#1a2332" : "#ffffff",
          color: darkMode ? "#e8edf4" : "#1a2a4a",
        }}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            <FiEdit2 style={{ marginRight: 10, verticalAlign: "middle", color: "#3758f9" }} />
            Edit Pattern
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
              <FiLayers size={18} color="#3758f9" />
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                Editing: <strong>Pattern {pattern.pattern_no}</strong>
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Pattern Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter pattern number"
                value={data.pattern_no}
                onChange={(e) => setData({ ...data, pattern_no: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  <FiFileText size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Total Questions
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Total questions"
                  value={data.total_questions}
                  onChange={(e) => setData({ ...data, total_questions: parseInt(e.target.value) || 0 })}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FiClock size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Time Limit (minutes)
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Time limit"
                  value={data.time_limit_minutes}
                  onChange={(e) => setData({ ...data, time_limit_minutes: parseInt(e.target.value) || 0 })}
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Passing Percentage</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Passing %"
                  value={data.passing_percentage}
                  onChange={(e) => setData({ ...data, passing_percentage: parseInt(e.target.value) || 0 })}
                  min="0"
                  max="100"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={data.is_active ? "active" : "inactive"}
                  onChange={(e) => setData({ ...data, is_active: e.target.value === "active" })}
                >
                  <option value="active">
                    <FiCheckCircle size={14} style={{ marginRight: 6 }} />
                    Active
                  </option>
                  <option value="inactive">
                    <FiXCircle size={14} style={{ marginRight: 6 }} />
                    Inactive
                  </option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Enter description (optional)"
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                rows="2"
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