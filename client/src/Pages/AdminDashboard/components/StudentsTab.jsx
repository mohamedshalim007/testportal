 // client/src/pages/AdminDashboard/components/StudentsTab.jsx
import React, { useState, useRef } from "react";
import Pagination from "./Pagination";
import * as XLSX from 'xlsx';
import { 
  FiPlus, FiEdit2, FiTrash2, FiSearch, FiFilter, FiDownload, FiUpload,
  FiX, FiUser, FiMail, FiHash, FiLock, FiEye, FiEyeOff,
  FiCheckCircle, FiXCircle, FiClock, FiCalendar, FiAward,
  FiLayers, FiGrid, FiList, FiRefreshCw, FiAlertCircle, FiCamera,
  FiPrinter, FiFileText, FiUsers, FiBook, FiUploadCloud
} from "react-icons/fi";
import { FaUserGraduate, FaUniversity, FaRegUserCircle } from "react-icons/fa";

export default function StudentsTab({
  users,
  allUsers,
  departments,
  patterns,
  loading,
  pagination,
  setPagination,
  onEdit,
  onDelete,
  onFaceUpload,
  onClearFace,
  uploadingUserId,
  onSearchChange,
  searchUser,
  newUser,
  setNewUser,
  onAddUser,
  onBulkImportStudents,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterPattern, setFilterPattern] = useState("");
  const [filterFace, setFilterFace] = useState("all");
  const [imageErrors, setImageErrors] = useState({});
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  
  // Bulk Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [importDepartment, setImportDepartment] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef(null);

  // ✅ Helper function to get correct image URL
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url === 'null' || url === 'undefined' || url === '') return null;
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `http://localhost:5000${url}`;
    }
    return `http://localhost:5000/uploads/faces/${url}`;
  };

  // ✅ Filter users based on department and pattern
  const filteredUsers = users.filter((user) => {
    if (filterDepartment) {
      const deptId = parseInt(filterDepartment);
      if (user.department_id !== deptId) return false;
    }
    
    if (filterPattern) {
      const patternId = parseInt(filterPattern);
      if (user.pattern_id !== patternId) return false;
    }
    
    const hasFace = !!user.face_descriptor || !!user.face_embedding || !!user.face_image_url;
    if (filterFace === "registered" && !hasFace) return false;
    if (filterFace === "unregistered" && hasFace) return false;
    
    return true;
  });

  // ✅ Get available patterns based on selected department
  const getAvailablePatterns = () => {
    if (!filterDepartment) return patterns;
    return patterns.filter(p => p.department_id === parseInt(filterDepartment));
  };

  const availablePatterns = getAvailablePatterns();

  // ✅ Bulk Import - Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setImportError("");
    setImportPreview([]);
    setImportData([]);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length === 0) {
          setImportError("No data found in the file.");
          return;
        }

        const firstRow = jsonData[0];
        const requiredColumns = ['name', 'email', 'reg_no'];
        const hasRequired = requiredColumns.every(col => 
          Object.keys(firstRow).some(key => key.toLowerCase().includes(col.toLowerCase()))
        );

        if (!hasRequired) {
          setImportError("File must contain 'name', 'email', and 'reg_no' columns.");
          return;
        }

        const mappedData = jsonData.map((row, index) => {
          const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('name')) || 'name';
          const emailKey = Object.keys(row).find(k => k.toLowerCase().includes('email')) || 'email';
          const regKey = Object.keys(row).find(k => k.toLowerCase().includes('reg')) || 'reg_no';
          const passKey = Object.keys(row).find(k => k.toLowerCase().includes('password') || k.toLowerCase().includes('pass')) || 'password';
          const deptKey = Object.keys(row).find(k => k.toLowerCase().includes('department') || k.toLowerCase().includes('dept'));

          const name = String(row[nameKey] || '').trim();
          const email = String(row[emailKey] || '').trim();
          const reg_no = String(row[regKey] || '').trim();
          const password = passKey ? String(row[passKey] || '').trim() : 'student123';

          if (!name || !email || !reg_no) {
            setImportError(`Row ${index + 1}: Missing name, email, or registration number.`);
            return null;
          }

          let deptId = importDepartment;
          if (deptKey && !deptId) {
            const deptName = String(row[deptKey]).trim();
            const foundDept = departments.find(d => 
              d.name.toLowerCase().includes(deptName.toLowerCase()) || 
              d.code.toLowerCase().includes(deptName.toLowerCase())
            );
            if (foundDept) deptId = String(foundDept.id);
          }

          return {
            name: name,
            email: email,
            reg_no: reg_no,
            password: password,
            department_id: deptId || '',
            _row: index + 1,
          };
        }).filter(row => row !== null);

        if (mappedData.length === 0) {
          setImportError("No valid students found in the file.");
          return;
        }

        setImportData(mappedData);
        setImportPreview(mappedData.slice(0, 10));
        setImportProgress(100);
      } catch (error) {
        console.error("Import error:", error);
        setImportError("Failed to read file: " + error.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // ✅ Handle bulk import
  const handleBulkImport = async () => {
    if (importData.length === 0) {
      setImportError("No data to import.");
      return;
    }

    const hasDeptInFile = importData.some(s => s.department_id);
    
    if (!hasDeptInFile && !importDepartment) {
      if (!window.confirm("No department found in the file or selected. Continue with empty values?")) {
        return;
      }
    }

    setImportLoading(true);
    setImportError("");
    setImportProgress(0);

    try {
      const finalData = importData.map((s, index) => ({
        ...s,
        department_id: s.department_id || importDepartment || null,
        _index: index
      }));

      if (typeof onBulkImportStudents !== 'function') {
        setImportError("Import function not available.");
        setImportLoading(false);
        return;
      }

      const result = await onBulkImportStudents(finalData);
      
      if (result && result.ok) {
        const msg = result.data 
          ? `✅ Successfully imported ${result.data.success} students!\n❌ ${result.data.failed} failed.`
          : `✅ Successfully imported ${importData.length} students!`;
        alert(msg);
        setShowImportModal(false);
        setImportData([]);
        setImportPreview([]);
        setSelectedFile(null);
        setImportDepartment("");
        setImportProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setImportError(result?.error || "Failed to import students.");
      }
    } catch (error) {
      console.error("Bulk import error:", error);
      setImportError("Failed to import students: " + error.message);
    } finally {
      setImportLoading(false);
    }
  };

  // ✅ Download template
  const downloadTemplate = () => {
    const template = [
      ['name', 'email', 'reg_no', 'password', 'department'],
      ['John Doe', 'john@university.edu', 'REG001', 'student123', 'Computer Science'],
      ['Jane Smith', 'jane@university.edu', 'REG002', 'student123', 'Electronics'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student_template.xlsx');
  };

  // ✅ Export users with multiple formats
  const exportUsers = (format = 'csv') => {
    if (filteredUsers.length === 0) {
      alert('No students to export!');
      return;
    }

    setExportLoading(true);

    try {
      const headers = [
        "User ID",
        "Name",
        "Email",
        "Registration No",
        "Department",
        "Login Count",
        "Face Registered",
        "Created At",
        "Status"
      ];
      
      const rows = filteredUsers.map((user) => {
        const dept = departments.find((d) => d.id === user.department_id);
        const hasFace = !!user.face_descriptor || !!user.face_embedding || !!user.face_image_url;
        return [
          user.user_id || 'N/A',
          user.name || 'N/A',
          user.email || 'N/A',
          user.reg_no || 'N/A',
          dept?.name || 'N/A',
          user.login_count || 0,
          hasFace ? 'Yes' : 'No',
          user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A',
          user.is_active !== false ? 'Active' : 'Inactive'
        ];
      });

      if (format === 'csv') {
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(','))
        ].join('\n');
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (format === 'json') {
        const jsonData = filteredUsers.map((user) => {
          const dept = departments.find((d) => d.id === user.department_id);
          const hasFace = !!user.face_descriptor || !!user.face_embedding || !!user.face_image_url;
          return {
            id: user.user_id,
            name: user.name,
            email: user.email,
            registration: user.reg_no,
            department: dept?.name || 'N/A',
            departmentCode: dept?.code || 'N/A',
            loginCount: user.login_count || 0,
            faceRegistered: hasFace,
            faceImageUrl: user.face_image_url || null,
            status: user.is_active !== false ? 'Active' : 'Inactive',
            joined: user.created_at || null
          };
        });

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `students_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (format === 'print') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const tableHtml = `
            <html>
              <head>
                <title>Students Report</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; }
                  h1 { color: #1a2a4a; }
                  .header-info { margin: 10px 0; color: #555; }
                  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                  th { background: #3758f9; color: white; padding: 10px; text-align: left; }
                  td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
                  tr:hover { background: #f5f5f5; }
                  .status-active { color: #28a745; font-weight: bold; }
                  .status-inactive { color: #dc3545; font-weight: bold; }
                  .face-yes { color: #28a745; }
                  .face-no { color: #dc3545; }
                </style>
              </head>
              <body>
                <h1>📊 Students Report</h1>
                <div class="header-info">
                  <p>Generated: ${new Date().toLocaleString()}</p>
                  <p>Total Students: ${filteredUsers.length}</p>
                  ${filterDepartment ? `<p>Department: ${departments.find(d => d.id === parseInt(filterDepartment))?.name || 'N/A'}</p>` : ''}
                  ${filterPattern ? `<p>Pattern: ${patterns.find(p => p.id === parseInt(filterPattern))?.pattern_no || 'N/A'}</p>` : ''}
                </div>
                <table>
                  <thead>
                    <tr>
                      ${headers.map(h => `<th>${h}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.map(row => `
                      <tr>
                        ${row.map((cell, i) => {
                          if (i === 6) {
                            return `<td class="face-${cell === 'Yes' ? 'yes' : 'no'}">${cell}</td>`;
                          }
                          if (i === 8) {
                            return `<td class="status-${cell === 'Active' ? 'active' : 'inactive'}">${cell}</td>`;
                          }
                          return `<td>${cell}</td>`;
                        }).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </body>
            </html>
          `;
          printWindow.document.write(tableHtml);
          printWindow.document.close();
          printWindow.print();
        }
      }

      setShowExportOptions(false);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterDepartment("");
    setFilterPattern("");
    setFilterFace("all");
    onSearchChange("");
  };

  // Handle image error
  const handleImageError = (userId) => {
    setImageErrors(prev => ({ ...prev, [userId]: true }));
  };

  // Calculate stats
  const totalStudents = filteredUsers.length;
  const registeredFace = filteredUsers.filter(u => 
    !!u.face_descriptor || !!u.face_embedding || !!u.face_image_url
  ).length;

  // Import Modal
  const ImportModal = () => (
    <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
      <div 
        className="modal-container" 
        style={{ maxWidth: 820 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            <FiUploadCloud style={{ marginRight: 10, verticalAlign: "middle", color: "#3758f9" }} />
            Bulk Import Students
          </h2>
          <button className="modal-close-btn" onClick={() => setShowImportModal(false)}>
            <FiX size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="import-steps">
            <div className="step">
              <span className="step-number">1</span>
              <span className="step-text">Select your Excel/CSV file</span>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <span className="step-text">Choose department (optional)</span>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <span className="step-text">Preview & Import</span>
            </div>
          </div>

          <div className="import-dept-pattern">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  <FaUniversity size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Department (Optional)
                </label>
                <select
                  className="form-select"
                  value={importDepartment}
                  onChange={(e) => setImportDepartment(e.target.value)}
                >
                  <option value="">Select Department (from file or here)</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="import-hint">
              <FiAlertCircle size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Students will use department from the Excel file if specified.
              If not, they will use the selection above.
            </div>
          </div>

          <div className="import-info">
            <p><FiFileText size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
              <strong>Supported formats:</strong> CSV, Excel (.xlsx, .xls)</p>
            <p><FiCheckCircle size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
              <strong>Required columns:</strong> name, email, reg_no</p>
            <p><FiList size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
              <strong>Optional columns:</strong> password, department</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn-ghost-sm" onClick={downloadTemplate}>
                <FiDownload size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Download Template
              </button>
              <button 
                className="btn-ghost-sm" 
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                style={{ background: '#e3f2fd' }}
              >
                <FiUpload size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Choose File
              </button>
            </div>
          </div>

          <div className="import-upload">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            {selectedFile && (
              <div className="file-info">
                <span><FiFileText size={14} style={{ marginRight: 4 }} /> {selectedFile.name}</span>
                <span style={{ fontSize: 12, color: '#687791' }}>
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
                <button 
                  className="btn-ghost-sm" 
                  onClick={() => {
                    setSelectedFile(null);
                    setImportData([]);
                    setImportPreview([]);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  style={{ fontSize: 11, color: '#dc3545' }}
                >
                  <FiX size={14} style={{ marginRight: 4 }} />
                  Remove
                </button>
              </div>
            )}
          </div>

          {importProgress > 0 && importProgress < 100 && (
            <div className="import-progress">
              <div className="progress-bar" style={{ width: `${importProgress}%` }}></div>
              <span>{importProgress}%</span>
            </div>
          )}

          {importError && (
            <div className="import-error">
              <FiAlertCircle size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
              {importError}
            </div>
          )}

          {importPreview.length > 0 && (
            <div className="import-preview">
              <h4>
                <FiList size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Preview (showing {Math.min(importPreview.length, 10)} of {importData.length} students)
              </h4>
              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Registration</th>
                      <th>Password</th>
                      <th>Dept</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((s, i) => {
                      const dept = departments.find(d => d.id === parseInt(s.department_id));
                      return (
                        <tr key={i}>
                          <td>{s._row}</td>
                          <td>{s.name}</td>
                          <td>{s.email}</td>
                          <td>{s.reg_no}</td>
                          <td>{'•'.repeat(Math.min(s.password?.length || 0, 8))}</td>
                          <td>{dept?.code || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {importData.length > 10 && (
                <div style={{ textAlign: 'center', fontSize: 13, color: '#687791', marginTop: 8 }}>
                  ... and {importData.length - 10} more students
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={() => setShowImportModal(false)}>
            <FiX size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Cancel
          </button>
          <button 
            className="btn-save" 
            onClick={handleBulkImport}
            disabled={importData.length === 0 || importLoading}
          >
            {importLoading ? (
              <><FiRefreshCw size={16} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} /> Importing...</>
            ) : (
              <><FiUpload size={16} style={{ marginRight: 6 }} /> Import {importData.length} Students</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Import Modal */}
      {showImportModal && <ImportModal />}

      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-group">
          <label className="filter-label">
            <FaUniversity size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Department:
          </label>
          <select
            className="input-box"
            style={{ width: 180 }}
            value={filterDepartment}
            onChange={(e) => {
              setFilterDepartment(e.target.value);
              setFilterPattern("");
              setPagination((prev) => ({ ...prev, students: 1 }));
            }}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">
            <FiLayers size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Pattern:
          </label>
          <select
            className="input-box"
            style={{ width: 180 }}
            value={filterPattern}
            onChange={(e) => {
              setFilterPattern(e.target.value);
              setPagination((prev) => ({ ...prev, students: 1 }));
            }}
            disabled={!filterDepartment}
          >
            <option value="">All Patterns</option>
            {availablePatterns.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                Pattern {pattern.pattern_no}
              </option>
            ))}
          </select>
          {filterDepartment && availablePatterns.length === 0 && (
            <span className="filter-hint">No patterns available</span>
          )}
        </div>

        <div className="filter-group">
          <label className="filter-label">
            <FiCamera size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Face Status:
          </label>
          <select
            className="input-box"
            style={{ width: 150 }}
            value={filterFace}
            onChange={(e) => {
              setFilterFace(e.target.value);
              setPagination((prev) => ({ ...prev, students: 1 }));
            }}
          >
            <option value="all">All Students</option>
            <option value="registered">✅ Face Registered</option>
            <option value="unregistered">❌ No Face</option>
          </select>
        </div>

        <button className="btn-ghost-sm" onClick={clearFilters} style={{ fontSize: 12 }}>
          <FiX size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Clear Filters
        </button>

        {/* Bulk Import Button */}
        <button 
          className="btn-primary" 
          onClick={() => setShowImportModal(true)}
          style={{ background: '#28a745' }}
        >
          <FiUpload size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Bulk Import
        </button>

        {/* Export Button */}
        <div className="export-wrapper">
          <button 
            className="btn-primary" 
            onClick={() => setShowExportOptions(!showExportOptions)}
            style={{ fontSize: 12, padding: "6px 14px" }}
            disabled={exportLoading}
          >
            {exportLoading ? (
              <><FiRefreshCw size={14} style={{ marginRight: 4, animation: "spin 1s linear infinite" }} /> Exporting...</>
            ) : (
              <><FiDownload size={14} style={{ marginRight: 4 }} /> Export ({filteredUsers.length})</>
            )}
          </button>
          
          {showExportOptions && (
            <div className="export-dropdown">
              <button onClick={() => exportUsers('csv')}>
                <FiFileText size={14} style={{ marginRight: 8 }} />
                Export as CSV
              </button>
              <button onClick={() => exportUsers('json')}>
                <FiGrid size={14} style={{ marginRight: 8 }} />
                Export as JSON
              </button>
              <button onClick={() => exportUsers('print')}>
                <FiPrinter size={14} style={{ marginRight: 8 }} />
                Print Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {users.length > 0 && (
        <div style={{ 
          display: "flex", 
          gap: 16, 
          marginBottom: 12,
          padding: "10px 16px",
          background: "#f8f9fa",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          flexWrap: "wrap",
          alignItems: "center"
        }}>
          <span style={{ fontSize: 13, color: "#687791", display: "flex", alignItems: "center", gap: 4 }}>
            <FaUserGraduate size={14} color="#3758f9" />
            Total: <strong>{users.length}</strong>
          </span>
          <span style={{ fontSize: 13, color: "#687791", display: "flex", alignItems: "center", gap: 4 }}>
            <FiCheckCircle size={14} color="#28a745" />
            Face Registered: <strong>{users.filter(u => !!u.face_descriptor || !!u.face_embedding || !!u.face_image_url).length}</strong>
          </span>
          <span style={{ fontSize: 13, color: "#687791", display: "flex", alignItems: "center", gap: 4 }}>
            <FiXCircle size={14} color="#dc3545" />
            No Face: <strong>{users.filter(u => !u.face_descriptor && !u.face_embedding && !u.face_image_url).length}</strong>
          </span>
          <span style={{ fontSize: 13, color: "#687791", display: "flex", alignItems: "center", gap: 4 }}>
            <FiClock size={14} color="#ff9800" />
            Filtered: <strong>{filteredUsers.length}</strong>
          </span>
        </div>
      )}

      {/* Add Form */}
      <div className="card-add">
        <div className="card-title">
          <FiPlus style={{ marginRight: 8, verticalAlign: "middle", color: "#3758f9" }} />
          Add New Student
        </div>
        <div className="form-grid-4">
          <input
            className="input-box"
            placeholder="Full Name"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
          />
          <input
            className="input-box"
            placeholder="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
          />
          <input
            className="input-box"
            placeholder="Registration No"
            value={newUser.reg_no}
            onChange={(e) => setNewUser({ ...newUser, reg_no: e.target.value })}
          />
          <div className="password-input-wrapper">
            <input
              className="input-box"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FiEye size={18} /> : <FiEyeOff size={18} />}
            </button>
          </div>
        </div>
        <div className="form-grid-2" style={{ marginTop: 10 }}>
          <select
            className="input-box"
            value={newUser.department_id}
            onChange={(e) => {
              setNewUser({ ...newUser, department_id: e.target.value });
            }}
          >
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={onAddUser}>
            <FiPlus size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Add Student
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}>
          <FiAlertCircle size={14} />
          Student will be able to select any pattern during login
        </div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <input
          className="input-box"
          placeholder="Search students by name, email, or registration..."
          value={searchUser}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <span className="search-count">
          <FiUsers size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Found {filteredUsers.length} student{filteredUsers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="loading-state">Loading students...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">No students found matching your criteria</div>
      ) : (
        filteredUsers.map((user) => {
          const hasFace = !!user.face_descriptor || !!user.face_embedding || !!user.face_image_url;
          const fileInputId = `face-file-${user.user_id}`;
          const dept = departments.find((d) => d.id === user.department_id);
          const pattern = patterns.find((p) => p.id === user.pattern_id);
          const imageUrl = getImageUrl(user.face_image_url);
          const hasError = imageErrors[user.user_id];

          return (
            <div key={user.user_id} className="card-item">
              <div className="card-item-content">
                <div className="student-info" style={{ flex: 1 }}>
                  <div className="card-item-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <FaUserGraduate size={16} style={{ color: "#3758f9" }} />
                    <span style={{ fontWeight: 600 }}>{user.name}</span>
                    <span className="card-item-subtitle">
                      {dept?.name || "No Dept"} • Pattern: {pattern?.pattern_no || "Any Pattern"}
                    </span>
                    <span className={`status-badge ${user.is_active !== false ? "active" : "inactive"}`}>
                      {user.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="card-item-desc" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                    <span><FiMail size={12} style={{ marginRight: 4 }} /> {user.email}</span>
                    <span><FiHash size={12} style={{ marginRight: 4 }} /> {user.reg_no}</span>
                  </div>
                  <div className="card-item-stats" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                    <span><FiLock size={12} style={{ marginRight: 4 }} /> Logins: {user.login_count || 0}</span>
                    <span className={`face-status ${hasFace ? "registered" : "unregistered"}`}>
                      {hasFace ? "✅ Face Registered" : "❌ No Face"}
                    </span>
                    {user.created_at && (
                      <span><FiCalendar size={12} style={{ marginRight: 4 }} /> Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  
                  {/* Face image display */}
                  {hasFace && imageUrl && (
                    <div className="face-preview-container">
                      <img
                        src={imageUrl}
                        alt={`${user.name}'s face`}
                        className="face-thumbnail"
                        onError={() => handleImageError(user.user_id)}
                        onLoad={() => setImageErrors(prev => ({ ...prev, [user.user_id]: false }))}
                        style={{ display: hasError ? 'none' : 'block' }}
                        onClick={() => window.open(imageUrl, "_blank")}
                      />
                      {!hasError ? (
                        <span className="face-preview-label"><FiCamera size={12} style={{ marginRight: 4 }} /> Click to enlarge</span>
                      ) : (
                        <span className="face-fallback"><FiAlertCircle size={12} style={{ marginRight: 4 }} /> Image not found</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="card-item-actions">
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageErrors(prev => ({ ...prev, [user.user_id]: false }));
                        onFaceUpload(user.user_id, file);
                      }
                      e.target.value = "";
                    }}
                  />
                  <button
                    className={`btn-ghost-sm ${uploadingUserId === user.user_id ? "loading" : ""}`}
                    onClick={() => document.getElementById(fileInputId).click()}
                    disabled={uploadingUserId === user.user_id}
                    title="Upload face image"
                  >
                    {uploadingUserId === user.user_id ? (
                      <><FiRefreshCw size={14} style={{ marginRight: 4, animation: "spin 1s linear infinite" }} /> Uploading...</>
                    ) : (
                      <><FiCamera size={14} style={{ marginRight: 4 }} /> Face</>
                    )}
                  </button>
                  {hasFace && (
                    <button 
                      className="btn-ghost-sm danger" 
                      onClick={() => onClearFace(user.user_id)}
                      title="Clear face image"
                    >
                      <FiTrash2 size={14} style={{ marginRight: 4 }} />
                      Clear
                    </button>
                  )}
                  <button 
                    className="btn-ghost-sm" 
                    onClick={() => onEdit(user)}
                    title="Edit student"
                  >
                    <FiEdit2 size={14} style={{ marginRight: 4 }} />
                    Edit
                  </button>
                  <button 
                    className="btn-ghost-sm danger" 
                    onClick={() => onDelete(user.user_id)}
                    title="Delete student"
                  >
                    <FiTrash2 size={14} style={{ marginRight: 4 }} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      <Pagination
        page={pagination.students}
        total={Math.ceil(filteredUsers.length / 10) || 1}
        setPage={(page) => setPagination((prev) => ({ ...prev, students: page }))}
      />
    </div>
  );
}