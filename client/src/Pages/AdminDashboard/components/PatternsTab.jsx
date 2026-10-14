 // client/src/pages/AdminDashboard/components/PatternsTab.jsx
import React from "react";
import Pagination from "./Pagination";
import { 
  FiPlus, FiEdit2, FiTrash2, FiLayers, FiClock, FiFileText, 
  FiFilter, FiBook, FiCheckCircle, FiXCircle, FiList
} from "react-icons/fi";
import { FaUniversity } from "react-icons/fa";

export default function PatternsTab({
  patterns,
  allPatterns,
  departments,
  questions,
  selectedDepartment,
  loading,
  pagination,
  setPagination,
  onEdit,
  onDelete,
  onViewQuestions,
  onFilterChange,
  newPattern,
  setNewPattern,
  onAddPattern,
}) {
  return (
    <div>
      {/* Filter */}
      <div className="filter-section">
        <div className="filter-group">
          <label className="filter-label">
            <FiFilter size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Filter by Department:
          </label>
          <select
            className="input-box"
            style={{ width: 200 }}
            value={selectedDepartment}
            onChange={(e) => onFilterChange(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>
        {selectedDepartment && (
          <span style={{ fontSize: 13, color: "#687791" }}>
            Showing patterns for: <strong>{departments.find(d => d.id === parseInt(selectedDepartment))?.name}</strong>
          </span>
        )}
      </div>

      {/* Add Form */}
      <div className="card-add">
        <div className="card-title">
          <FiPlus style={{ marginRight: 8, verticalAlign: "middle" }} />
          Add New Pattern
        </div>
        <div className="form-grid-4">
          <select
            className="input-box"
            value={newPattern.department_id}
            onChange={(e) => setNewPattern({ ...newPattern, department_id: e.target.value })}
          >
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                <FaUniversity size={12} style={{ marginRight: 4 }} />
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
          <input
            className="input-box"
            placeholder="Pattern No. (e.g., P001)"
            value={newPattern.pattern_no}
            onChange={(e) => setNewPattern({ ...newPattern, pattern_no: e.target.value })}
          />
          <input
            className="input-box"
            placeholder="Total Questions"
            type="number"
            value={newPattern.total_questions}
            onChange={(e) =>
              setNewPattern({ ...newPattern, total_questions: parseInt(e.target.value) || 0 })
            }
          />
          <input
            className="input-box"
            placeholder="Time Limit (min)"
            type="number"
            value={newPattern.time_limit_minutes}
            onChange={(e) =>
              setNewPattern({ ...newPattern, time_limit_minutes: parseInt(e.target.value) || 0 })
            }
          />
          <button className="btn-primary" onClick={onAddPattern}>
            <FiPlus size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Add Pattern
          </button>
        </div>
        <input
          className="input-box"
          placeholder="Description (Optional)"
          style={{ marginTop: 8 }}
          value={newPattern.description}
          onChange={(e) => setNewPattern({ ...newPattern, description: e.target.value })}
        />
      </div>

      {/* Stats Summary */}
      {patterns.length > 0 && (
        <div style={{ 
          display: "flex", 
          gap: 16, 
          marginBottom: 12,
          padding: "10px 16px",
          background: "#f8f9fa",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          flexWrap: "wrap"
        }}>
          <span style={{ fontSize: 13, color: "#687791" }}>
            <FiLayers size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Total Patterns: <strong>{patterns.length}</strong>
          </span>
          <span style={{ fontSize: 13, color: "#687791" }}>
            <FiBook size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Total Questions: <strong>{patterns.reduce((sum, p) => sum + questions.filter(q => q.pattern_id === p.id).length, 0)}</strong>
          </span>
        </div>
      )}

      {/* List */}
      {patterns.length === 0 ? (
        <div className="empty-state">No patterns found</div>
      ) : (
        patterns.map((pattern) => {
          const dept = departments.find((d) => d.id === pattern.department_id);
          const questionCount = questions.filter((q) => q.pattern_id === pattern.id).length;

          return (
            <div key={pattern.id} className="card-item">
              <div className="card-item-content">
                <div>
                  <div className="card-item-title">
                    <FiLayers size={16} style={{ marginRight: 6, verticalAlign: "middle", color: "#3758f9" }} />
                    Pattern {pattern.pattern_no}
                    <span className="card-item-subtitle">
                      {dept?.name} ({dept?.code})
                    </span>
                    <span className={`status-badge ${pattern.is_active !== false ? "active" : "inactive"}`}>
                      {pattern.is_active !== false ? (
                        <><FiCheckCircle size={12} style={{ marginRight: 4 }} /> Active</>
                      ) : (
                        <><FiXCircle size={12} style={{ marginRight: 4 }} /> Inactive</>
                      )}
                    </span>
                  </div>
                  <div className="card-item-desc">{pattern.description || "No description"}</div>
                  <div className="card-item-stats">
                    <span><FiBook size={12} style={{ marginRight: 4 }} /> Questions: {questionCount}</span>
                    <span><FiClock size={12} style={{ marginRight: 4 }} /> Time: {pattern.time_limit_minutes} min</span>
                    <span><FiFileText size={12} style={{ marginRight: 4 }} /> Total: {pattern.total_questions} questions</span>
                  </div>
                </div>
                <div className="card-item-actions">
                  <button className="btn-ghost-sm" onClick={() => onEdit(pattern)}>
                    <FiEdit2 size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    Edit
                  </button>
                  <button className="btn-ghost-sm" onClick={() => onViewQuestions(pattern.department_id, pattern.id)}>
                    <FiList size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    Questions
                  </button>
                  <button className="btn-ghost-sm danger" onClick={() => onDelete(pattern.id)}>
                    <FiTrash2 size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      <Pagination
        page={pagination.patterns}
        total={Math.ceil(allPatterns.filter(p => {
          if (!selectedDepartment) return true;
          return p.department_id === parseInt(selectedDepartment);
        }).length / 10) || 1}
        setPage={(page) => setPagination((prev) => ({ ...prev, patterns: page }))}
      />
    </div>
  );
}