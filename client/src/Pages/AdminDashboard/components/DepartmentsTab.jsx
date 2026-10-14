 // client/src/pages/AdminDashboard/components/DepartmentsTab.jsx
import React from "react";
import Pagination from "./Pagination";
import { FiPlus, FiEdit2, FiTrash2, FiLayers, FiUsers, FiBook, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { FaUniversity } from "react-icons/fa";

export default function DepartmentsTab({
  departments,
  allDepartments,
  users,
  questions,
  patterns,
  loading,
  pagination,
  setPagination,
  onEdit,
  onDelete,
  onViewPatterns,
  newDepartment,
  setNewDepartment,
  onAddDepartment,
}) {
  return (
    <div>
      {/* Add Form */}
      <div className="card-add">
        <div className="card-title">
          <FaUniversity style={{ marginRight: 8, verticalAlign: "middle" }} />
          Add New Department
        </div>
        <div className="form-grid-4">
          <input
            className="input-box"
            placeholder="Department Name"
            value={newDepartment.name}
            onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
          />
          <input
            className="input-box"
            placeholder="Code (e.g., CS)"
            value={newDepartment.code}
            onChange={(e) => setNewDepartment({ ...newDepartment, code: e.target.value.toUpperCase() })}
          />
          <input
            className="input-box"
            placeholder="Description (Optional)"
            value={newDepartment.description}
            onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
          />
          <button className="btn-primary" onClick={onAddDepartment}>
            <FiPlus style={{ marginRight: 6, verticalAlign: "middle" }} />
            Add
          </button>
        </div>
      </div>

      {/* List */}
      {departments.length === 0 ? (
        <div className="empty-state">No departments found</div>
      ) : (
        departments.map((dept) => {
          const patternCount = patterns.filter((p) => p.department_id === dept.id).length;
          const studentCount = users.filter((u) => u.department_id === dept.id).length;
          const questionCount = questions.filter((q) => q.department_id === dept.id).length;

          return (
            <div key={dept.id} className="card-item">
              <div className="card-item-content">
                <div>
                  <div className="card-item-title">
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{dept.name}</span>
                    <span className="card-item-subtitle">({dept.code})</span>
                    <span className={`status-badge ${dept.is_active !== false ? "active" : "inactive"}`}>
                      {dept.is_active !== false ? (
                        <><FiCheckCircle size={12} style={{ marginRight: 4 }} /> Active</>
                      ) : (
                        <><FiXCircle size={12} style={{ marginRight: 4 }} /> Inactive</>
                      )}
                    </span>
                  </div>
                  <div className="card-item-desc">{dept.description || "No description"}</div>
                  <div className="card-item-stats">
                    <span><FiLayers size={12} style={{ marginRight: 4 }} /> Patterns: {patternCount}</span>
                    <span><FiUsers size={12} style={{ marginRight: 4 }} /> Students: {studentCount}</span>
                    <span><FiBook size={12} style={{ marginRight: 4 }} /> Questions: {questionCount}</span>
                  </div>
                </div>
                <div className="card-item-actions">
                  <button className="btn-ghost-sm" onClick={() => onEdit(dept)}>
                    <FiEdit2 size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    Edit
                  </button>
                  <button className="btn-ghost-sm" onClick={() => onViewPatterns(dept.id)}>
                    <FiLayers size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    Patterns
                  </button>
                  <button className="btn-ghost-sm danger" onClick={() => onDelete(dept.id)}>
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
        page={pagination.departments}
        total={Math.ceil(allDepartments.length / 10) || 1}
        setPage={(page) => setPagination((prev) => ({ ...prev, departments: page }))}
      />
    </div>
  );
}