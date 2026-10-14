 // client/src/pages/AdminDashboard/components/Modals/EditDepartmentModal.jsx
import React, { useState, useEffect } from "react";
import { FiEdit2, FiX, FiSave, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { FaUniversity } from "react-icons/fa";

export default function EditDepartmentModal({
  isOpen,
  department,
  onClose,
  onSave,
  darkMode,
}) {
  const [data, setData] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    if (department) {
      setData({
        name: department.name || "",
        code: department.code || "",
        description: department.description || "",
        is_active: department.is_active !== undefined ? department.is_active : true,
      });
    }
  }, [department]);

  if (!isOpen || !department) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(department.id, data);
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
            Edit Department
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
              <FaUniversity size={18} color="#3758f9" />
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                Editing: <strong>{department.name}</strong> ({department.code})
              </span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter department name"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., CS"
                  value={data.code}
                  onChange={(e) => setData({ ...data, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
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