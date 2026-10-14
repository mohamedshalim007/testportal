 // client/src/pages/AdminDashboard/components/SubmissionsTab.jsx
import React, { useState } from "react";
import Pagination from "./Pagination";
import SubmissionDetails from "./SubmissionDetails";
import api from "../../../api";
import * as XLSX from 'xlsx';
import { 
  FiFilter, FiSearch, FiDownload, FiRefreshCw, FiTrash2, FiX,
  FiCheckCircle, FiXCircle, FiClock, FiCalendar, FiAward,
  FiLayers, FiUsers, FiBook, FiBarChart2, FiChevronDown,
  FiChevronRight, FiEye, FiAlertCircle, FiUser, FiHash,
  FiFileText, FiPlus, FiEdit2, FiGrid, FiList
} from "react-icons/fi";
import { FaUniversity, FaUserGraduate, FaGraduationCap } from "react-icons/fa";

export default function SubmissionsTab({
  submissions,
  allSubmissions,
  departments,
  patterns,
  loading,
  pagination,
  setPagination,
  onSearchChange,
  searchSub,
  onExport,
  onRefresh,
  token,
}) {
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Filter states
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterPattern, setFilterPattern] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Fetch all questions for export
  React.useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await api.get("/api/questions", {
          params: { test_id: "default_test" },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.ok) {
          setAllQuestions(res.data.data);
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
      }
    };
    if (token) {
      fetchQuestions();
    }
  }, [token]);

  const handleViewDetails = (submission) => {
    setSelectedSubmission(submission.id);
  };

  const handleCloseDetails = () => {
    setSelectedSubmission(null);
  };

  const toggleUserExpand = (userId) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  const getAvailablePatterns = () => {
    if (!filterDepartment) return patterns;
    return patterns.filter(p => p.department_id === parseInt(filterDepartment));
  };

  const getFilteredSubmissions = () => {
    let filtered = submissions;

    if (filterDepartment) {
      filtered = filtered.filter(s => s.department_id === parseInt(filterDepartment));
    }

    if (filterPattern) {
      filtered = filtered.filter(s => s.pattern_id === parseInt(filterPattern));
    }

    if (filterStatus === "passed") {
      filtered = filtered.filter(s => (s.percentage || 0) >= 40);
    } else if (filterStatus === "failed") {
      filtered = filtered.filter(s => (s.percentage || 0) < 40);
    } else if (filterStatus === "malpractice") {
      filtered = filtered.filter(s => s.malpractice_reason && s.malpractice_reason !== "Manual Submit");
    }

    return filtered;
  };

  const clearFilters = () => {
    setFilterDepartment("");
    setFilterPattern("");
    setFilterStatus("all");
    onSearchChange("");
  };

  const toggleSelectAll = () => {
    const filteredData = getFilteredSubmissions();
    if (selectAll) {
      setSelectedDeleteIds([]);
    } else {
      setSelectedDeleteIds(filteredData.map(s => s.id));
    }
    setSelectAll(!selectAll);
  };

  const toggleSelect = (id) => {
    if (selectedDeleteIds.includes(id)) {
      setSelectedDeleteIds(selectedDeleteIds.filter(sid => sid !== id));
    } else {
      setSelectedDeleteIds([...selectedDeleteIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDeleteIds.length === 0) {
      alert("Please select at least one submission to delete.");
      return;
    }

    const filteredData = getFilteredSubmissions();
    const deptName = filterDepartment ? departments.find(d => d.id === parseInt(filterDepartment))?.name : 'All';
    const patternName = filterPattern ? patterns.find(p => p.id === parseInt(filterPattern))?.pattern_no : 'All';

    const confirmMessage = 
      `⚠️ WARNING: This action cannot be undone!\n\n` +
      `You are about to delete ${selectedDeleteIds.length} submission${selectedDeleteIds.length > 1 ? 's' : ''}.\n` +
      `Filters: Department: ${deptName} | Pattern: ${patternName}\n` +
      `Total filtered: ${filteredData.length}\n\n` +
      `Are you sure you want to continue?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleteLoading(true);
    try {
      const results = { success: 0, failed: 0, errors: [] };

      for (const id of selectedDeleteIds) {
        try {
          const res = await api.delete(`/api/submissions/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.data.ok) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push(`ID ${id}: ${res.data.error || 'Unknown error'}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`ID ${id}: ${error.message}`);
        }
      }

      onRefresh();
      let message = `✅ Successfully deleted ${results.success} submission${results.success > 1 ? 's' : ''}!`;
      if (results.failed > 0) {
        message += `\n❌ Failed to delete ${results.failed} submission${results.failed > 1 ? 's' : ''}.`;
      }
      alert(message);

      setSelectedDeleteIds([]);
      setSelectAll(false);

    } catch (error) {
      console.error("Bulk delete error:", error);
      alert("Error deleting submissions. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSingle = async (id) => {
    if (!window.confirm(`Are you sure you want to delete this submission?`)) {
      return;
    }

    try {
      const res = await api.delete(`/api/submissions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        alert("✅ Submission deleted successfully!");
        onRefresh();
      } else {
        alert(res.data.error || "Failed to delete submission");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Error deleting submission");
    }
  };

  // ✅ COMPLETE EXPORT FUNCTION
  const exportCompleteData = async () => {
    const filteredData = getFilteredSubmissions();
    
    if (filteredData.length === 0) {
      alert("No data to export with current filters.");
      return;
    }

    try {
      const res = await api.get("/api/questions", {
        params: { test_id: "default_test" },
        headers: { Authorization: `Bearer ${token}` },
      });
      
      let questions = [];
      if (res.data.ok) {
        questions = res.data.data;
      }

      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        ['EXAM SUBMISSIONS REPORT'],
        [''],
        ['FILTERS APPLIED'],
        ['Department:', filterDepartment ? departments.find(d => d.id === parseInt(filterDepartment))?.name || 'All' : 'All'],
        ['Pattern:', filterPattern ? patterns.find(p => p.id === parseInt(filterPattern))?.pattern_no || 'All' : 'All'],
        ['Status:', filterStatus === 'all' ? 'All' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)],
        [''],
        ['SUMMARY STATISTICS'],
        ['Total Submissions', filteredData.length],
        ['Total Students', new Set(filteredData.map(s => s.user_id)).size],
        ['Passed', filteredData.filter(s => (s.percentage || 0) >= 40).length],
        ['Failed', filteredData.filter(s => (s.percentage || 0) < 40).length],
        ['Malpractice Cases', filteredData.filter(s => s.malpractice_reason && s.malpractice_reason !== "Manual Submit").length],
        ['Average Score', filteredData.length > 0 ? (filteredData.reduce((sum, s) => sum + (s.percentage || 0), 0) / filteredData.length).toFixed(2) : 0],
        ['Highest Score', filteredData.length > 0 ? Math.max(...filteredData.map(s => s.percentage || 0)) : 0],
        ['Lowest Score', filteredData.length > 0 ? Math.min(...filteredData.map(s => s.percentage || 0)) : 0],
        [''],
        ['Generated On:', new Date().toLocaleString()],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Student Submissions Sheet
      const studentHeaders = [
        'S.No', 'User ID', 'Student Name', 'Registration No', 'Department',
        'Pattern', 'Test ID', 'Attempt No', 'Score', 'Max Score',
        'Percentage', 'Status', 'Malpractice', 'Started At', 'Finished At', 'Duration (min)'
      ];

      const studentRows = filteredData.map((sub, index) => {
        const dept = departments.find(d => d.id === sub.department_id);
        const pattern = patterns.find(p => p.id === sub.pattern_id);
        const duration = sub.started_at && sub.finished_at 
          ? Math.round((new Date(sub.finished_at) - new Date(sub.started_at)) / 60000) 
          : 0;
        const userAttempts = filteredData.filter(s => s.user_id === sub.user_id);
        const attemptNo = userAttempts.findIndex(s => s.id === sub.id) + 1;

        return [
          index + 1,
          sub.user_id || 'N/A',
          sub.user_name || 'N/A',
          sub.reg_no || 'N/A',
          dept?.name || 'N/A',
          pattern?.pattern_no || 'N/A',
          sub.test_id || 'N/A',
          attemptNo,
          sub.score || 0,
          sub.max_score || 0,
          sub.percentage || 0,
          (sub.percentage || 0) >= 40 ? 'Passed' : 'Failed',
          sub.malpractice_reason && sub.malpractice_reason !== "Manual Submit" ? sub.malpractice_reason : 'None',
          sub.started_at ? new Date(sub.started_at).toLocaleString() : 'N/A',
          sub.finished_at ? new Date(sub.finished_at).toLocaleString() : 'N/A',
          duration
        ];
      });

      const wsStudents = XLSX.utils.aoa_to_sheet([studentHeaders, ...studentRows]);
      XLSX.utils.book_append_sheet(wb, wsStudents, 'Submissions');

      // Detailed Answers Sheet
      const answerHeaders = [
        'S.No', 'User ID', 'Student Name', 'Registration No', 'Department',
        'Pattern', 'Attempt No', 'Question ID', 'Question', 'Question Type',
        'Option A', 'Option B', 'Option C', 'Option D',
        'Correct Answer', 'Student Answer', 'Status', 'Points Earned', 'Max Points'
      ];

      const answerRows = [];
      let answerSNo = 0;

      filteredData.forEach((sub) => {
        let answers = {};
        try {
          answers = typeof sub.answers_json === 'string' 
            ? JSON.parse(sub.answers_json) 
            : sub.answers_json || {};
        } catch (e) {
          answers = {};
        }

        const dept = departments.find(d => d.id === sub.department_id);
        const pattern = patterns.find(p => p.id === sub.pattern_id);
        const userAttempts = filteredData.filter(s => s.user_id === sub.user_id);
        const attemptNo = userAttempts.findIndex(s => s.id === sub.id) + 1;

        Object.keys(answers).forEach((qid) => {
          answerSNo++;
          const studentAnswer = answers[qid] || 'Not Answered';
          const questionData = questions.find(q => q.qid === qid);
          
          let isCorrect = false;
          let correctAnswer = '';
          let points = 1;
          
          if (questionData) {
            correctAnswer = questionData.correct || 'N/A';
            points = questionData.points || 1;
            if (studentAnswer && studentAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
              isCorrect = true;
            }
          }

          answerRows.push([
            answerSNo,
            sub.user_id || 'N/A',
            sub.user_name || 'N/A',
            sub.reg_no || 'N/A',
            dept?.name || 'N/A',
            pattern?.pattern_no || 'N/A',
            attemptNo,
            qid,
            questionData?.word || 'N/A',
            questionData?.question_type || 'N/A',
            questionData?.optA || 'N/A',
            questionData?.optB || 'N/A',
            questionData?.optC || 'N/A',
            questionData?.optD || 'N/A',
            correctAnswer,
            studentAnswer,
            isCorrect ? '✅ Correct' : '❌ Wrong',
            isCorrect ? points : 0,
            points
          ]);
        });
      });

      const wsAnswers = XLSX.utils.aoa_to_sheet([answerHeaders, ...answerRows]);
      XLSX.utils.book_append_sheet(wb, wsAnswers, 'Detailed Answers');

      // Student Performance Sheet
      const perfHeaders = [
        'S.No', 'User ID', 'Student Name', 'Registration No', 'Department',
        'Pattern', 'Total Attempts', 'Best Score (%)', 'Average Score (%)',
        'Passed', 'Failed', 'Malpractice Count', 'Latest Score (%)', 'Latest Status'
      ];

      const studentMap = {};
      filteredData.forEach(sub => {
        if (!studentMap[sub.user_id]) {
          studentMap[sub.user_id] = {
            user_id: sub.user_id,
            user_name: sub.user_name || sub.user_id,
            reg_no: sub.reg_no || 'N/A',
            department_id: sub.department_id,
            pattern_id: sub.pattern_id,
            attempts: [],
            malpractice_count: 0
          };
        }
        studentMap[sub.user_id].attempts.push(sub);
        if (sub.malpractice_reason && sub.malpractice_reason !== "Manual Submit") {
          studentMap[sub.user_id].malpractice_count++;
        }
      });

      const perfRows = Object.values(studentMap).map((student, index) => {
        const dept = departments.find(d => d.id === student.department_id);
        const pattern = patterns.find(p => p.id === student.pattern_id);
        const attempts = student.attempts;
        const scores = attempts.map(a => a.percentage || 0);
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length || 0;
        const bestScore = Math.max(...scores);
        const latest = attempts[attempts.length - 1];
        const passed = attempts.filter(a => (a.percentage || 0) >= 40).length;
        const failed = attempts.filter(a => (a.percentage || 0) < 40).length;

        return [
          index + 1,
          student.user_id,
          student.user_name,
          student.reg_no,
          dept?.name || 'N/A',
          pattern?.pattern_no || 'N/A',
          attempts.length,
          Math.round(bestScore),
          Math.round(avgScore),
          passed,
          failed,
          student.malpractice_count,
          latest ? Math.round(latest.percentage || 0) : 0,
          latest ? ((latest.percentage || 0) >= 40 ? 'Passed' : 'Failed') : 'N/A'
        ];
      });

      const wsPerf = XLSX.utils.aoa_to_sheet([perfHeaders, ...perfRows]);
      XLSX.utils.book_append_sheet(wb, wsPerf, 'Student Performance');

      // Save file
      let filename = "exam_submissions_complete";
      if (filterDepartment) {
        const dept = departments.find(d => d.id === parseInt(filterDepartment));
        filename += `_${dept?.code || 'dept'}`;
      }
      if (filterPattern) {
        const pattern = patterns.find(p => p.id === parseInt(filterPattern));
        filename += `_${pattern?.pattern_no || 'pattern'}`;
      }
      if (filterStatus !== "all") {
        filename += `_${filterStatus}`;
      }
      filename += `_${new Date().toISOString().split("T")[0]}.xlsx`;

      XLSX.writeFile(wb, filename);
      alert(`✅ Export completed!\n📊 ${filteredData.length} submissions exported with ${answerRows.length} answers.`);

    } catch (error) {
      console.error("Export error:", error);
      alert("Error exporting data: " + error.message);
    }
  };

  // Get filtered data
  const filteredData = getFilteredSubmissions();
  const filteredCount = filteredData.length;

  return (
    <div>
      {/* Submission Details Modal */}
      {selectedSubmission && (
        <SubmissionDetails
          submissionId={selectedSubmission}
          onClose={handleCloseDetails}
          token={token}
        />
      )}

      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-group">
          <label className="filter-label">
            <FaUniversity size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Department:
          </label>
          <select
            className="input-box"
            style={{ width: 160 }}
            value={filterDepartment}
            onChange={(e) => {
              setFilterDepartment(e.target.value);
              setFilterPattern("");
              setPagination((prev) => ({ ...prev, submissions: 1 }));
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
            style={{ width: 160 }}
            value={filterPattern}
            onChange={(e) => {
              setFilterPattern(e.target.value);
              setPagination((prev) => ({ ...prev, submissions: 1 }));
            }}
            disabled={!filterDepartment}
          >
            <option value="">All Patterns</option>
            {getAvailablePatterns().map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                Pattern {pattern.pattern_no}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">
            <FiBarChart2 size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Status:
          </label>
          <select
            className="input-box"
            style={{ width: 140 }}
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination((prev) => ({ ...prev, submissions: 1 }));
            }}
          >
            <option value="all">All Status</option>
            <option value="passed">
              <FiCheckCircle size={12} style={{ marginRight: 4, color: "#28a745" }} />
              Passed
            </option>
            <option value="failed">
              <FiXCircle size={12} style={{ marginRight: 4, color: "#dc3545" }} />
              Failed
            </option>
            <option value="malpractice">
              <FiAlertCircle size={12} style={{ marginRight: 4, color: "#ff9800" }} />
              Malpractice
            </option>
          </select>
        </div>

        <button className="btn-ghost-sm" onClick={clearFilters} style={{ fontSize: 12 }}>
          <FiX size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Clear Filters
        </button>

        <button className="btn-ghost-sm" onClick={onRefresh} style={{ fontSize: 12 }}>
          <FiRefreshCw size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Refresh
        </button>

        {selectedDeleteIds.length > 0 && (
          <button 
            className="btn-danger" 
            onClick={handleBulkDelete}
            style={{ fontSize: 12, padding: "6px 14px" }}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <><FiRefreshCw size={14} style={{ marginRight: 4, animation: "spin 1s linear infinite" }} /> Deleting...</>
            ) : (
              <><FiTrash2 size={14} style={{ marginRight: 4 }} /> Delete Selected ({selectedDeleteIds.length})</>
            )}
          </button>
        )}

        <button 
          className="btn-primary" 
          onClick={exportCompleteData} 
          style={{ fontSize: 12, padding: "6px 14px", background: "#28a745" }}
        >
          <FiDownload size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Export Complete ({filteredCount})
        </button>
      </div>

      {/* Stats Summary */}
      <div className="submission-stats">
        <div className="stat-item">
          <span className="stat-label">Total Submissions:</span>
          <span className="stat-value">{allSubmissions.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Filtered:</span>
          <span className="stat-value" style={{ color: "#1976d2" }}>
            {filteredCount}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">
            <FiCheckCircle size={12} style={{ marginRight: 4, color: "#28a745" }} />
            Passed:
          </span>
          <span className="stat-value" style={{ color: "#28a745" }}>
            {allSubmissions.filter(s => s.percentage >= 40).length}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">
            <FiXCircle size={12} style={{ marginRight: 4, color: "#dc3545" }} />
            Failed:
          </span>
          <span className="stat-value" style={{ color: "#dc3545" }}>
            {allSubmissions.filter(s => s.percentage < 40).length}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">
            <FiAlertCircle size={12} style={{ marginRight: 4, color: "#ff9800" }} />
            Malpractice:
          </span>
          <span className="stat-value" style={{ color: "#ff9800" }}>
            {allSubmissions.filter(s => s.malpractice_reason && s.malpractice_reason !== "Manual Submit").length}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">
            <FiTrash2 size={12} style={{ marginRight: 4, color: "#dc3545" }} />
            Selected:
          </span>
          <span className="stat-value" style={{ color: "#dc3545" }}>
            {selectedDeleteIds.length}
          </span>
        </div>
      </div>

      {/* Select All Bar */}
      {filteredData.length > 0 && (
        <div className="select-all-bar">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleSelectAll}
            />
            <FiCheckCircle size={14} style={{ marginRight: 4 }} />
            Select All ({filteredData.length})
          </label>
          {selectedDeleteIds.length > 0 && (
            <span className="selected-count">
              <FiTrash2 size={14} style={{ marginRight: 4 }} />
              {selectedDeleteIds.length} selected
            </span>
          )}
        </div>
      )}

      {/* Submissions List */}
      {loading ? (
        <div className="loading-state">Loading submissions...</div>
      ) : filteredData.length === 0 ? (
        <div className="empty-state">No submissions found matching your filters</div>
      ) : (
        <div className="submissions-list">
          {Object.entries(
            filteredData.reduce((acc, sub) => {
              if (!acc[sub.user_id]) {
                acc[sub.user_id] = {
                  user_name: sub.user_name || sub.user_id,
                  reg_no: sub.reg_no || 'N/A',
                  attempts: [],
                  total_attempts: 0,
                  best_score: 0,
                  avg_percentage: 0,
                  passed_count: 0,
                  failed_count: 0,
                  latest_attempt: null
                };
              }
              acc[sub.user_id].attempts.push(sub);
              return acc;
            }, {})
          ).map(([userId, userData]) => {
            const isExpanded = expandedUser === userId;
            const dept = departments.find(d => d.id === userData.latest_attempt?.department_id);
            const pattern = patterns.find(p => p.id === userData.latest_attempt?.pattern_id);

            const attempts = userData.attempts;
            userData.total_attempts = attempts.length;
            userData.best_score = Math.max(...attempts.map(a => a.percentage || 0));
            userData.avg_percentage = Math.round(attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length);
            userData.passed_count = attempts.filter(a => (a.percentage || 0) >= 40).length;
            userData.failed_count = attempts.filter(a => (a.percentage || 0) < 40).length;
            userData.latest_attempt = attempts[attempts.length - 1];
            userData.attempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            return (
              <div key={userId} className="submission-group">
                <div 
                  className="submission-group-header"
                  onClick={() => toggleUserExpand(userId)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="user-info">
                    <div className="user-avatar">
                      {userData.user_name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="user-name">
                        <strong>{userData.user_name}</strong>
                        <span className="user-reg"><FiHash size={12} style={{ marginRight: 4 }} /> {userData.reg_no}</span>
                      </div>
                      <div className="user-details">
                        <span className="user-dept"><FaUniversity size={12} style={{ marginRight: 4 }} /> {dept?.name || 'N/A'}</span>
                        <span className="user-pattern"><FiLayers size={12} style={{ marginRight: 4 }} /> Pattern: {pattern?.pattern_no || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="user-stats">
                    <div className="attempt-badge">
                      <FiClock size={14} style={{ marginRight: 4 }} />
                      {userData.total_attempts} attempt{userData.total_attempts !== 1 ? 's' : ''}
                    </div>
                    <div className={`avg-score ${userData.avg_percentage >= 40 ? 'pass' : 'fail'}`}>
                      Avg: {userData.avg_percentage}%
                    </div>
                    <div className="best-score">
                      <FiAward size={14} style={{ marginRight: 4 }} />
                      Best: {userData.best_score}%
                    </div>
                    <div className="pass-fail-stats">
                      <span className="pass-count"><FiCheckCircle size={12} style={{ marginRight: 4 }} /> {userData.passed_count}</span>
                      <span className="fail-count"><FiXCircle size={12} style={{ marginRight: 4 }} /> {userData.failed_count}</span>
                    </div>
                    <span className="expand-icon">
                      {isExpanded ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="submission-attempts">
                    {userData.attempts.map((sub, index) => {
                      const subDept = departments.find(d => d.id === sub.department_id);
                      const subPattern = patterns.find(p => p.id === sub.pattern_id);
                      const isMalpractice = sub.malpractice_reason && sub.malpractice_reason !== "Manual Submit";
                      const attemptNumber = userData.total_attempts - index;
                      const isSelected = selectedDeleteIds.includes(sub.id);

                      return (
                        <div key={sub.id || index} className={`submission-item ${isSelected ? 'selected' : ''}`}>
                          <div className="submission-checkbox">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(sub.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="submission-info">
                            <div className="submission-header">
                              <span className="attempt-number">#{attemptNumber}</span>
                              <span className={`submission-status ${sub.percentage >= 40 ? "passed" : "failed"}`}>
                                {sub.percentage >= 40 ? (
                                  <><FiCheckCircle size={12} style={{ marginRight: 4 }} /> Passed</>
                                ) : (
                                  <><FiXCircle size={12} style={{ marginRight: 4 }} /> Failed</>
                                )}
                              </span>
                              {isMalpractice && (
                                <span className="malpractice-badge">
                                  <FiAlertCircle size={12} style={{ marginRight: 4 }} /> Malpractice
                                </span>
                              )}
                              <span className="submission-date">
                                <FiCalendar size={12} style={{ marginRight: 4 }} />
                                {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            <div className="submission-details">
                              <span><FiAward size={12} style={{ marginRight: 4 }} /> Score: <strong>{sub.score || 0}</strong> / {sub.max_score || 0}</span>
                              <span>Percentage: <strong style={{ color: sub.percentage >= 40 ? "#28a745" : "#dc3545" }}>
                                {sub.percentage || 0}%
                              </strong></span>
                              <span><FaUniversity size={12} style={{ marginRight: 4 }} /> {subDept?.code || "N/A"}</span>
                              <span><FiLayers size={12} style={{ marginRight: 4 }} /> {subPattern?.pattern_no || "N/A"}</span>
                              <span><FiClock size={12} style={{ marginRight: 4 }} /> Duration: {sub.started_at && sub.finished_at ? 
                                Math.round((new Date(sub.finished_at) - new Date(sub.started_at)) / 60000) : 0} min
                              </span>
                            </div>
                            {isMalpractice && (
                              <div className="malpractice-reason">
                                <FiAlertCircle size={14} style={{ marginRight: 4 }} />
                                {sub.malpractice_reason}
                              </div>
                            )}
                          </div>
                          <div className="submission-actions">
                            <button 
                              className="btn-primary" 
                              onClick={() => handleViewDetails(sub)}
                              style={{ fontSize: 12, padding: "6px 14px" }}
                            >
                              <FiEye size={14} style={{ marginRight: 4 }} />
                              View Details
                            </button>
                            <button 
                              className="btn-danger-sm" 
                              onClick={() => handleDeleteSingle(sub.id)}
                              style={{ fontSize: 12, padding: "4px 10px" }}
                            >
                              <FiTrash2 size={14} style={{ marginRight: 4 }} />
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="progress-chart">
                      <div className="chart-label">
                        <FiBarChart2 size={14} style={{ marginRight: 4 }} />
                        Progress Over Attempts
                      </div>
                      <div className="chart-bars">
                        {userData.attempts.map((sub, idx) => {
                          const height = Math.max((sub.percentage || 0) * 0.6, 5);
                          const color = sub.percentage >= 40 ? '#28a745' : '#dc3545';
                          return (
                            <div key={idx} className="chart-bar-wrapper">
                              <div 
                                className="chart-bar" 
                                style={{ 
                                  height: `${height}px`, 
                                  background: color,
                                  width: '100%'
                                }}
                              />
                              <div className="chart-label-bar">{idx + 1}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="chart-legend">
                        <span><FiXCircle size={12} style={{ marginRight: 4, color: "#dc3545" }} /> Failed (&lt;40%)</span>
                        <span><FiCheckCircle size={12} style={{ marginRight: 4, color: "#28a745" }} /> Passed (≥40%)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        page={pagination.submissions}
        total={Math.ceil(filteredData.length / 10) || 1}
        setPage={(page) => setPagination((prev) => ({ ...prev, submissions: page }))}
      />
    </div>
  );
}