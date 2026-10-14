 // client/src/pages/AdminDashboard/components/QuestionsTab.jsx
import React, { useState, useRef, useEffect } from "react";
import Pagination from "./Pagination";
import * as XLSX from 'xlsx';
import { 
  FiPlus, FiEdit2, FiTrash2, FiSearch, FiFilter, FiDownload, FiUpload,
  FiX, FiFileText, FiAward, FiCheckCircle, FiClock, FiLayers,
  FiBook, FiList, FiGrid, FiRefreshCw, FiAlertCircle, FiHash
} from "react-icons/fi";
import { FaQuestionCircle, FaUniversity, FaCode } from "react-icons/fa";

export default function QuestionsTab({
  questions,
  allQuestions,
  departments,
  patterns,
  selectedDepartment,
  selectedPattern,
  loading,
  pagination,
  setPagination,
  compilerVisible,
  compilerLanguage,
  onEdit,
  onDelete,
  onDeleteAll,
  onFilterChange,
  onSearchChange,
  searchQ,
  onExport,
  onCompilerChange,
  newQuestion,
  setNewQuestion,
  onAddQuestion,
  onBulkImport,
}) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [importDepartment, setImportDepartment] = useState("");
  const [importPattern, setImportPattern] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [showStats, setShowStats] = useState(true);
  const fileInputRef = useRef(null);

  // ✅ Get available patterns based on selected import department
  const getImportAvailablePatterns = () => {
    if (!importDepartment) return [];
    return patterns.filter(p => p.department_id === parseInt(importDepartment));
  };

  // ✅ Handle import department change
  const handleImportDepartmentChange = (e) => {
    const deptId = e.target.value;
    setImportDepartment(deptId);
    setImportPattern(""); // Reset pattern when department changes
    setImportError("");
  };

  // Handle file upload
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
        const requiredColumns = ['question', 'correct'];
        const hasRequired = requiredColumns.every(col => 
          Object.keys(firstRow).some(key => key.toLowerCase().includes(col.toLowerCase()))
        );

        if (!hasRequired) {
          setImportError("File must contain 'question' and 'correct' columns.");
          return;
        }

        const mappedData = jsonData.map((row, index) => {
          const questionKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('question') || k.toLowerCase().includes('word')
          ) || 'question';
          
          const correctKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('correct') || k.toLowerCase().includes('answer')
          ) || 'correct';
          
          const typeKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('type')
          );
          
          const optAKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('opta') || k.toLowerCase().includes('a')
          );
          const optBKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('optb') || k.toLowerCase().includes('b')
          );
          const optCKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('optc') || k.toLowerCase().includes('c')
          );
          const optDKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('optd') || k.toLowerCase().includes('d')
          );
          const pointsKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('points') || k.toLowerCase().includes('point')
          );
          const deptKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('department') || k.toLowerCase().includes('dept')
          );
          const patternKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('pattern')
          );

          const questionText = String(row[questionKey] || '').trim();
          const correctAnswer = String(row[correctKey] || '').trim();

          if (!questionText || !correctAnswer) {
            setImportError(`Row ${index + 1}: Missing question or correct answer.`);
            return null;
          }

          let questionType = 'MCQ';
          if (typeKey) {
            const typeVal = String(row[typeKey]).toUpperCase();
            if (typeVal.includes('FILL') || typeVal.includes('BLANK')) {
              questionType = 'FILL';
            }
          }

          const optA = optAKey ? String(row[optAKey] || '').trim() : '';
          const optB = optBKey ? String(row[optBKey] || '').trim() : '';
          const optC = optCKey ? String(row[optCKey] || '').trim() : '';
          const optD = optDKey ? String(row[optDKey] || '').trim() : '';

          let deptId = importDepartment;
          if (deptKey && !deptId) {
            const deptName = String(row[deptKey]).trim();
            const foundDept = departments.find(d => 
              d.name.toLowerCase().includes(deptName.toLowerCase()) || 
              d.code.toLowerCase().includes(deptName.toLowerCase()) ||
              deptName.toLowerCase().includes(d.name.toLowerCase()) ||
              deptName.toLowerCase().includes(d.code.toLowerCase())
            );
            if (foundDept) deptId = String(foundDept.id);
          }

          let patId = importPattern;
          if (patternKey && !patId) {
            const patternName = String(row[patternKey]).trim();
            const foundPattern = patterns.find(p => 
              p.pattern_no.toLowerCase().includes(patternName.toLowerCase()) ||
              patternName.toLowerCase().includes(p.pattern_no.toLowerCase())
            );
            if (foundPattern) patId = String(foundPattern.id);
          }

          return {
            word: questionText,
            correct: correctAnswer,
            question_type: questionType,
            optA: optA,
            optB: optB,
            optC: optC,
            optD: optD,
            points: pointsKey ? parseInt(row[pointsKey]) || 1 : 1,
            department_id: deptId || '',
            pattern_id: patId || '',
            _row: index + 1,
          };
        }).filter(row => row !== null);

        if (mappedData.length === 0) {
          setImportError("No valid questions found in the file.");
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

  const handleBulkImport = async () => {
    if (importData.length === 0) {
      setImportError("No data to import.");
      return;
    }

    const hasDeptInFile = importData.some(q => q.department_id);
    const hasPatternInFile = importData.some(q => q.pattern_id);
    
    if (!hasDeptInFile && !hasPatternInFile && !importDepartment && !importPattern) {
      if (!window.confirm("No department or pattern found in the file or selected. Continue with empty values?")) {
        return;
      }
    }

    setImportLoading(true);
    setImportError("");
    setImportProgress(0);

    try {
      const finalData = importData.map((q, index) => ({
        ...q,
        department_id: q.department_id || importDepartment || null,
        pattern_id: q.pattern_id || importPattern || null,
        _index: index
      }));

      if (typeof onBulkImport !== 'function') {
        setImportError("Import function not available.");
        setImportLoading(false);
        return;
      }

      const result = await onBulkImport(finalData);
      
      if (result && result.ok) {
        const msg = result.data 
          ? `✅ Successfully imported ${result.data.success} questions!\n❌ ${result.data.failed} failed.`
          : `✅ Successfully imported ${importData.length} questions!`;
        alert(msg);
        setShowImportModal(false);
        setImportData([]);
        setImportPreview([]);
        setSelectedFile(null);
        setImportDepartment("");
        setImportPattern("");
        setImportProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setImportError(result?.error || "Failed to import questions.");
      }
    } catch (error) {
      console.error("Bulk import error:", error);
      setImportError("Failed to import questions: " + error.message);
    } finally {
      setImportLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['question', 'type', 'optA', 'optB', 'optC', 'optD', 'correct', 'points', 'department', 'pattern'],
      ['What is 2+2?', 'MCQ', '3', '4', '5', '6', 'B', '1', 'Computer Science', 'CS101'],
      ['What is the capital of France?', 'MCQ', 'London', 'Paris', 'Berlin', 'Madrid', 'B', '1', 'Computer Science', 'CS101'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.writeFile(wb, 'question_template.xlsx');
  };

  // ✅ FIXED: Import Modal with NO SVG inside options
  const ImportModal = () => (
    <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
      <div 
        className="modal-container" 
        style={{ maxWidth: 820 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            <FiUpload style={{ marginRight: 10, verticalAlign: "middle", color: "#3758f9" }} />
            Bulk Import Questions
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
              <span className="step-text">Choose department & pattern (optional)</span>
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
                  onChange={handleImportDepartmentChange}
                >
                  <option value="">Select Department (from file or here)</option>
                  {departments.map((dept) => (
                    // ✅ FIXED: No SVG inside option - just plain text
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FiLayers size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Pattern (Optional)
                </label>
                <select
                  className="form-select"
                  value={importPattern}
                  onChange={(e) => setImportPattern(e.target.value)}
                  disabled={!importDepartment}
                >
                  <option value="">Select Pattern (from file or here)</option>
                  {getImportAvailablePatterns().map((pattern) => (
                    // ✅ FIXED: No SVG inside option - just plain text
                    <option key={pattern.id} value={pattern.id}>
                      Pattern {pattern.pattern_no}
                    </option>
                  ))}
                </select>
                {importDepartment && getImportAvailablePatterns().length === 0 && (
                  <span className="filter-hint" style={{ fontSize: 11, color: "#dc3545" }}>
                    No patterns available for this department
                  </span>
                )}
              </div>
            </div>
            <div className="import-hint">
              <FiAlertCircle size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Questions will use department/pattern from the Excel file if specified.
              If not, they will use the selection above.
            </div>
          </div>

          <div className="import-info">
            <p><FiFileText size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
              <strong>Supported formats:</strong> CSV, Excel (.xlsx, .xls)</p>
            <p><FiCheckCircle size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
              <strong>Required columns:</strong> question, correct</p>
            <p><FiList size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
              <strong>Optional columns:</strong> type, optA, optB, optC, optD, points, department, pattern</p>
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
                Preview (showing {Math.min(importPreview.length, 10)} of {importData.length} questions)
              </h4>
              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Question</th>
                      <th>Type</th>
                      <th>Options</th>
                      <th>Correct</th>
                      <th>Points</th>
                      <th>Dept</th>
                      <th>Pattern</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((q, i) => {
                      const dept = departments.find(d => d.id === parseInt(q.department_id));
                      const pattern = patterns.find(p => p.id === parseInt(q.pattern_id));
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: "#3758f9" }}>{q._row}</td>
                          <td>{q.word?.substring(0, 40)}{q.word?.length > 40 ? '...' : ''}</td>
                          <td><span className="type-badge">{q.question_type}</span></td>
                          <td style={{ fontSize: 12 }}>
                            {q.question_type === 'MCQ' 
                              ? `A:${q.optA || '-'} B:${q.optB || '-'} C:${q.optC || '-'} D:${q.optD || '-'}`
                              : 'N/A'
                            }
                          </td>
                          <td><strong style={{ color: '#28a745' }}>{q.correct}</strong></td>
                          <td>{q.points}</td>
                          <td>{dept?.code || '-'}</td>
                          <td>{pattern?.pattern_no || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {importData.length > 10 && (
                <div style={{ textAlign: 'center', fontSize: 13, color: '#687791', marginTop: 8 }}>
                  ... and {importData.length - 10} more questions
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
              <><FiUpload size={16} style={{ marginRight: 6 }} /> Import {importData.length} Questions</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Calculate stats
  const totalMCQ = questions.filter(q => q.question_type === 'MCQ').length;
  const totalFILL = questions.filter(q => q.question_type === 'FILL').length;
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);

  return (
    <div>
      {showImportModal && <ImportModal />}

      {/* Filters */}
      <div className="filter-section">
        <div className="filter-group">
          <label className="filter-label">
            <FaUniversity size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Department:
          </label>
          <select
            className="input-box"
            style={{ width: 150 }}
            value={selectedDepartment}
            onChange={(e) => onFilterChange(e.target.value, "")}
          >
            <option value="">All Depts</option>
            {departments.map((dept) => (
              // ✅ FIXED: No SVG inside option
              <option key={dept.id} value={dept.id}>
                {dept.name}
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
            style={{ width: 150 }}
            value={selectedPattern}
            onChange={(e) => onFilterChange(selectedDepartment, e.target.value)}
            disabled={!selectedDepartment}
          >
            <option value="">All Patterns</option>
            {patterns
              .filter((p) => p.department_id === parseInt(selectedDepartment))
              .map((pattern) => (
                // ✅ FIXED: No SVG inside option
                <option key={pattern.id} value={pattern.id}>
                  Pattern {pattern.pattern_no}
                </option>
              ))}
          </select>
        </div>

        <div className="filter-group" style={{ flex: 1 }}>
          <label className="filter-label">
            <FiSearch size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Search:
          </label>
          <input
            className="input-box"
            placeholder="Search questions..."
            value={searchQ}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <button className="btn-ghost-sm" onClick={onExport}>
          <FiDownload size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Export
        </button>
        <button 
          className="btn-primary" 
          onClick={() => setShowImportModal(true)}
          style={{ background: '#28a745' }}
        >
          <FiUpload size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Bulk Import
        </button>
      </div>

      {/* Compiler Settings */}
      <div className="compiler-settings">
        <div className="compiler-title">
          <FaCode size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
          Online Compiler Settings
        </div>
        <div className="compiler-controls">
          <div>
            <label>Status:</label>
            <select
              className="input-box"
              style={{ width: 120 }}
              value={compilerVisible}
              onChange={(e) => onCompilerChange(e.target.value, compilerLanguage)}
            >
              <option value="no">OFF</option>
              <option value="yes">ON</option>
            </select>
          </div>
          <div>
            <label>Default Language:</label>
            <select
              className="input-box"
              style={{ width: 150 }}
              value={compilerLanguage}
              onChange={(e) => onCompilerChange(compilerVisible, e.target.value)}
            >
              <option value="python">Python</option>
              <option value="c">C</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>
          </div>
          <span className="compiler-status">
            {compilerVisible === "yes" ? (
              <><FiCheckCircle size={14} style={{ marginRight: 4 }} /> Compiler visible</>
            ) : (
              <><FiX size={14} style={{ marginRight: 4 }} /> Compiler hidden</>
            )}
          </span>
        </div>
      </div>

      {/* Stats Summary */}
      {questions.length > 0 && (
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
            <FaQuestionCircle size={14} color="#3758f9" />
            Total: <strong>{questions.length}</strong>
          </span>
          <span style={{ fontSize: 13, color: "#687791", display: "flex", alignItems: "center", gap: 4 }}>
            <FiCheckCircle size={14} color="#28a745" />
            MCQ: <strong>{totalMCQ}</strong>
          </span>
          <span style={{ fontSize: 13, color: "#687791", display: "flex", alignItems: "center", gap: 4 }}>
            <FiFileText size={14} color="#ff9800" />
            FILL: <strong>{totalFILL}</strong>
          </span>
          <span style={{ fontSize: 13, color: "#687791", display: "flex", alignItems: "center", gap: 4 }}>
            <FiAward size={14} color="#7b1fa2" />
            Points: <strong>{totalPoints}</strong>
          </span>
        </div>
      )}

      {/* Add Form */}
      <div className="card-add">
        <div className="card-title">
          <FiPlus style={{ marginRight: 8, verticalAlign: "middle", color: "#3758f9" }} />
          Add New Question
        </div>
        <div className="form-grid-3">
          <select
            className="input-box"
            value={newQuestion.type}
            onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value })}
          >
            <option value="MCQ">Multiple Choice</option>
            <option value="FILL">Fill in the Blank</option>
          </select>
          <input
            className="input-box"
            placeholder="Points"
            type="number"
            value={newQuestion.points}
            onChange={(e) =>
              setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) || 1 })
            }
          />
          <input
            className="input-box"
            placeholder="Question text..."
            value={newQuestion.word}
            onChange={(e) => setNewQuestion({ ...newQuestion, word: e.target.value })}
          />
          <select
            className="input-box"
            value={newQuestion.department_id}
            onChange={(e) => {
              setNewQuestion({ ...newQuestion, department_id: e.target.value, pattern_id: "" });
            }}
          >
            <option value="">Select Department</option>
            {departments.map((dept) => (
              // ✅ FIXED: No SVG inside option
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
          <select
            className="input-box"
            value={newQuestion.pattern_id}
            onChange={(e) => setNewQuestion({ ...newQuestion, pattern_id: e.target.value })}
            disabled={!newQuestion.department_id}
          >
            <option value="">Select Pattern</option>
            {patterns
              .filter((p) => p.department_id === parseInt(newQuestion.department_id))
              .map((pattern) => (
                // ✅ FIXED: No SVG inside option
                <option key={pattern.id} value={pattern.id}>
                  Pattern {pattern.pattern_no}
                </option>
              ))}
          </select>
          <button className="btn-primary" onClick={onAddQuestion}>
            <FiPlus size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Add
          </button>
        </div>

        {newQuestion.type === "MCQ" && (
          <div className="form-grid-4" style={{ marginTop: 10 }}>
            {["A", "B", "C", "D"].map((opt) => (
              <input
                key={opt}
                className="input-box"
                placeholder={`Option ${opt}`}
                value={newQuestion[opt]}
                onChange={(e) => setNewQuestion({ ...newQuestion, [opt]: e.target.value })}
              />
            ))}
          </div>
        )}
        <input
          className="input-box"
          placeholder="Correct Answer"
          value={newQuestion.correct}
          onChange={(e) => setNewQuestion({ ...newQuestion, correct: e.target.value })}
          style={{ marginTop: 10 }}
        />
        <button className="btn-ghost-sm danger" onClick={onDeleteAll} style={{ marginTop: 10 }}>
          <FiTrash2 size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Delete All ({allQuestions.length})
        </button>
      </div>

      {/* List */}
      {questions.length === 0 ? (
        <div className="empty-state">No questions found</div>
      ) : (
        questions.map((q) => {
          const dept = departments.find((d) => d.id === q.department_id);
          const pattern = patterns.find((p) => p.id === q.pattern_id);

          return (
            <div key={q.qid} className="card-item">
              <div className="card-item-content">
                <div style={{ flex: 1 }}>
                  <div className="card-item-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <FaQuestionCircle size={16} style={{ color: "#3758f9" }} />
                    <span style={{ fontWeight: 600 }}>#{q.qid}</span>
                    <span style={{ fontWeight: 500 }}>- {q.word}</span>
                    <span className="card-item-subtitle">
                      {dept?.code || "No Dept"} • Pattern {pattern?.pattern_no || "None"}
                    </span>
                    <span className="points-badge">
                      <FiAward size={12} style={{ marginRight: 4 }} />
                      {q.points || 1} pts
                    </span>
                    <span className={`type-badge ${q.question_type === 'MCQ' ? 'mcq' : 'fill'}`}>
                      {q.question_type}
                    </span>
                  </div>
                  <div className="card-item-desc" style={{ marginTop: 4 }}>
                    {q.question_type === "MCQ" && (
                      <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>A: <strong>{q.optA || '-'}</strong></span>
                        <span>B: <strong>{q.optB || '-'}</strong></span>
                        <span>C: <strong>{q.optC || '-'}</strong></span>
                        <span>D: <strong>{q.optD || '-'}</strong></span>
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <FiCheckCircle size={14} color="#28a745" />
                      Correct: <strong style={{ color: "#28a745" }}>{q.correct}</strong>
                    </span>
                  </div>
                </div>
                <div className="card-item-actions">
                  <button className="btn-ghost-sm" onClick={() => onEdit(q)}>
                    <FiEdit2 size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    Edit
                  </button>
                  <button className="btn-ghost-sm danger" onClick={() => onDelete(q.qid)}>
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
        page={pagination.questions}
        total={Math.ceil(
          allQuestions.filter((q) => {
            if (!selectedDepartment && !selectedPattern) return true;
            if (selectedDepartment && q.department_id !== parseInt(selectedDepartment)) return false;
            if (selectedPattern && q.pattern_id !== parseInt(selectedPattern)) return false;
            return true;
          }).length / 10
        ) || 1}
        setPage={(page) => setPagination((prev) => ({ ...prev, questions: page }))}
      />
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}