 // client/src/pages/AdminDashboard/components/Modals/EditUserModal.jsx
import React, { useState, useEffect } from "react";
import { FiEdit2, FiX, FiSave, FiUser, FiMail, FiHash } from "react-icons/fi";

export default function EditUserModal({
  isOpen,
  user,
  onClose,
  onSave,
  darkMode,
}) {
  const [data, setData] = useState({
    name: "",
    email: "",
    reg_no: "",
  });

  useEffect(() => {
    if (user) {
      setData({
        name: user.name || "",
        email: user.email || "",
        reg_no: user.reg_no || "",
      });
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(user.user_id, data);
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
            Edit Student
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
              <FiUser size={18} color="#3758f9" />
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                Editing: <strong>{user.name}</strong>
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">
                <FiUser size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Full Name
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter full name"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <FiMail size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Email Address
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter email address"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <FiHash size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Registration Number
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter registration number"
                value={data.reg_no}
                onChange={(e) => setData({ ...data, reg_no: e.target.value })}
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