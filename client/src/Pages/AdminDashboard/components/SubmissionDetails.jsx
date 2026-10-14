 // client/src/pages/AdminDashboard/components/SubmissionDetails.jsx
import React, { useState, useEffect } from "react";
import api from "../../../api";
import * as XLSX from 'xlsx';
import { 
  FiX, FiDownload, FiUser, FiMail, FiHash, FiClock, FiCalendar, 
  FiAward, FiCheckCircle, FiXCircle, FiFileText, FiList, FiAlertCircle,
  FiBook, FiLayers, FiPrinter, FiBarChart2
} from "react-icons/fi";
import { FaUserGraduate, FaUniversity, FaQuestionCircle } from "react-icons/fa";

export default function SubmissionDetails({ submissionId, onClose, token }) {
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (submissionId) {
      fetchSubmissionDetails();
      fetchQuestions();
    }
  }, [submissionId]);

  const fetchSubmissionDetails = async () => {
    try {
      setLoading(true);
      console.log("📊 Fetching submission details for ID:", submissionId);
      
      const res = await api.get(`/api/submissions/${submissionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("📊 Submission details response:", res.data);

      if (res.data.ok) {
        setSubmission(res.data.data);
      } else {
        setError(res.data.error || "Failed to load submission details");
      }
    } catch (error) {
      console.error("Error fetching submission details:", error);
      setError("Failed to load submission details");
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await api.get("/api/questions", {
        params: { test_id: "default_test" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        setQuestions(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
    }
  };

  // ✅ Export to Excel with complete details
  const exportToExcel = () => {
    if (!submission) return;

    // Parse answers
    let answers = {};
    try {
      answers = typeof submission.answers_json === 'string' 
        ? JSON.parse(submission.answers_json) 
        : submission.answers_json || {};
    } catch (e) {
      answers = {};
    }

    // Create Student Info Sheet
    const studentInfo = [
      ['EXAM SUBMISSION REPORT'],
      [''],
      ['STUDENT INFORMATION'],
      ['Student Name', submission.user_name || submission.user_id || 'N/A'],
      ['Registration Number', submission.reg_no || 'N/A'],
      ['Department', submission.department_name || 'N/A'],
      ['Pattern', submission.pattern_no || 'N/A'],
      ['Test ID', submission.test_id || 'N/A'],
      ['Submitted Date', submission.created_at ? new Date(submission.created_at).toLocaleString() : 'N/A'],
      [''],
      ['SCORE SUMMARY'],
      ['Total Score', submission.score || 0],
      ['Maximum Score', submission.max_score || 0],
      ['Percentage', `${submission.percentage || 0}%`],
      ['Status', (submission.percentage || 0) >= 40 ? 'Passed' : 'Failed'],
      ['Malpractice', submission.malpractice_reason && submission.malpractice_reason !== 'Manual Submit' ? submission.malpractice_reason : 'None'],
      [''],
      ['ANSWER DETAILS'],
    ];

    // Question headers
    const answerHeaders = [
      'S.No',
      'Question ID',
      'Question',
      'Question Type',
      'Option A',
      'Option B',
      'Option C',
      'Option D',
      'Correct Answer',
      'Student Answer',
      'Status',
      'Points'
    ];

    const answerRows = (submission.details || []).map((d, index) => [
      index + 1, d.qid, d.question || 'N/A', d.question_type || 'N/A',
      d.optA || '', d.optB || '', d.optC || '', d.optD || '',
      d.correctAnswer || 'N/A',
      String(d.userAnswer ?? '').trim() ? d.userAnswer : 'Not Answered',
      d.isCorrect ? 'Correct' : (String(d.userAnswer ?? '').trim() ? 'Wrong' : 'Skipped'),
      d.earned
    ]);
    const correctCount = (submission.details || []).filter(d => d.isCorrect).length;
    const totalQ = (submission.details || []).length;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryData = [
      ...studentInfo,
      [],
      ['ANSWER SUMMARY'],
      ['Total Questions', totalQ],
      ['Answered', answerRows.filter(r => r[9] !== 'Not Answered').length],
      ['Correct Answers', correctCount],
      ['Wrong Answers', totalQ - correctCount],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // 2. Answers Sheet
    const wsAnswers = XLSX.utils.aoa_to_sheet([answerHeaders, ...answerRows]);
    
    wsAnswers['!cols'] = [
      { wch: 6 }, { wch: 12 }, { wch: 40 }, { wch: 12 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 8 }
    ];

    XLSX.utils.book_append_sheet(wb, wsAnswers, 'Answers');

    // 3. Student Info Sheet
    const studentData = [
      ['EXAM SUBMISSION DETAILS'],
      [''],
      ['Student:', submission.user_name || submission.user_id || 'N/A'],
      ['Registration:', submission.reg_no || 'N/A'],
      ['Department:', submission.department_name || 'N/A'],
      ['Pattern:', submission.pattern_no || 'N/A'],
      ['Test ID:', submission.test_id || 'N/A'],
      ['Submitted:', submission.created_at ? new Date(submission.created_at).toLocaleString() : 'N/A'],
      [''],
      ['Score:', `${submission.score || 0} / ${submission.max_score || 0}`],
      ['Percentage:', `${submission.percentage || 0}%`],
      ['Status:', (submission.percentage || 0) >= 40 ? 'Passed' : 'Failed'],
      ['Malpractice:', submission.malpractice_reason && submission.malpractice_reason !== 'Manual Submit' ? submission.malpractice_reason : 'None'],
    ];
    const wsStudent = XLSX.utils.aoa_to_sheet(studentData);
    XLSX.utils.book_append_sheet(wb, wsStudent, 'Student Info');

    // 4. Detailed Answers
    const detailedHeaders = [
      'S.No', 'Question ID', 'Question', 'Type',
      'Option A', 'Option B', 'Option C', 'Option D',
      'Correct Answer', 'Student Answer', 'Status', 'Points Earned'
    ];

    const detailedRows = answerRows.map(row => [
      row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7],
      row[8], row[9], row[10], row[11]
    ]);

    const wsDetailed = XLSX.utils.aoa_to_sheet([detailedHeaders, ...detailedRows]);
    wsDetailed['!cols'] = [
      { wch: 6 }, { wch: 12 }, { wch: 40 }, { wch: 12 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDetailed, 'Detailed Answers');

    // Generate filename
    const studentName = (submission.user_name || submission.user_id || 'student').replace(/\s+/g, '_');
    const date = new Date().toISOString().split('T')[0];
    const filename = `${studentName}_exam_report_${date}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-container" style={{ maxWidth: 700 }}>
          <div className="modal-body" style={{ textAlign: "center", padding: 40 }}>
            <div><FiClock size={32} style={{ animation: "spin 1s linear infinite" }} /></div>
            <div style={{ marginTop: 12 }}>Loading submission details...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container" style={{ maxWidth: 500 }}>
          <div className="modal-body" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ color: "#dc3545", fontSize: 18 }}>
              <FiAlertCircle size={24} style={{ marginRight: 8, verticalAlign: "middle" }} />
              {error || "Submission not found"}
            </div>
            <button className="btn-ghost" onClick={onClose} style={{ marginTop: 16 }}>
              <FiX size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Parse answers
  let answers = {};
  try {
    answers = typeof submission.answers_json === 'string' 
      ? JSON.parse(submission.answers_json) 
      : submission.answers_json || {};
  } catch (e) {
    answers = {};
  }

  const details = submission.details || [];
  const totalQuestions = details.length || Object.keys(answers).length;
  const answeredQuestions = details.length
    ? details.filter(d => String(d.userAnswer ?? "").trim() !== "").length
    : Object.values(answers).filter(a => a && a !== "").length;
  const correctCount = details.filter(d => d.isCorrect).length;
  const wrongCount = details.length - correctCount;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-container" 
        style={{ maxWidth: 850, maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            <FiBarChart2 style={{ marginRight: 10, verticalAlign: "middle", color: "#3758f9" }} />
            Submission Details
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: "auto" }}>
          {/* Student Info */}
          <div className="submission-student-info">
            <div className="info-grid">
              <div>
                <FaUserGraduate size={14} style={{ marginRight: 6, color: "#3758f9" }} />
                <strong>Student:</strong> {submission.user_name || submission.user_id}
              </div>
              <div>
                <FiHash size={14} style={{ marginRight: 6, color: "#6b7280" }} />
                <strong>Registration:</strong> {submission.reg_no || "N/A"}
              </div>
              <div>
                <FaUniversity size={14} style={{ marginRight: 6, color: "#6b7280" }} />
                <strong>Department:</strong> {submission.department_name || "N/A"}
              </div>
              <div>
                <FiLayers size={14} style={{ marginRight: 6, color: "#6b7280" }} />
                <strong>Pattern:</strong> {submission.pattern_no || "N/A"}
              </div>
              <div>
                <FiFileText size={14} style={{ marginRight: 6, color: "#6b7280" }} />
                <strong>Test ID:</strong> {submission.test_id}
              </div>
              <div>
                <FiCalendar size={14} style={{ marginRight: 6, color: "#6b7280" }} />
                <strong>Submitted:</strong> {new Date(submission.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Score Summary */}
          <div className="submission-score-summary">
            <div className="score-cards">
              <div className="score-card" style={{ background: "#e3f2fd" }}>
                <div className="score-number">{submission.score || 0}</div>
                <div className="score-label"><FiAward size={14} style={{ marginRight: 4 }} /> Score</div>
              </div>
              <div className="score-card" style={{ background: "#e8f5e9" }}>
                <div className="score-number">{submission.max_score || 0}</div>
                <div className="score-label"><FiAward size={14} style={{ marginRight: 4 }} /> Max Score</div>
              </div>
              <div className="score-card" style={{ background: submission.percentage >= 40 ? "#e8f5e9" : "#fce4ec" }}>
                <div className="score-number" style={{ color: submission.percentage >= 40 ? "#28a745" : "#dc3545" }}>
                  {submission.percentage || 0}%
                </div>
                <div className="score-label">
                  {submission.percentage >= 40 ? (
                    <><FiCheckCircle size={14} style={{ marginRight: 4 }} /> Passed</>
                  ) : (
                    <><FiXCircle size={14} style={{ marginRight: 4 }} /> Failed</>
                  )}
                </div>
              </div>
              <div className="score-card" style={{ background: "#fff3e0" }}>
                <div className="score-number">{totalQuestions}</div>
                <div className="score-label"><FiList size={14} style={{ marginRight: 4 }} /> Questions</div>
              </div>
            </div>
          </div>

          {/* Answer Breakdown */}
          <div className="answer-breakdown">
            <div className="breakdown-stats">
              <span className="answered-badge">
                <FiCheckCircle size={14} style={{ marginRight: 4 }} />
                Answered: {answeredQuestions}
              </span>
              <span className="answered-badge">
                <FiList size={14} style={{ marginRight: 4 }} />
                Total: {totalQuestions}
              </span>
              <span className="answered-badge" style={{ color: "#28a745" }}>
                <FiCheckCircle size={14} style={{ marginRight: 4 }} />
                Correct: {correctCount}
              </span>
              <span className="answered-badge" style={{ color: "#dc3545" }}>
                <FiXCircle size={14} style={{ marginRight: 4 }} />
                Wrong: {wrongCount}
              </span>
            </div>
          </div>

          {/* Malpractice Info */}
          {submission.malpractice_reason && submission.malpractice_reason !== "Manual Submit" && (
            <div className="malpractice-warning">
              <FiAlertCircle size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Malpractice Detected: <strong>{submission.malpractice_reason}</strong>
            </div>
          )}

          {/* Answers List */}
          <div className="answers-list">
            <h4>
              <FiBook size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Answer Details
            </h4>
            {details.length === 0 ? (
              <p style={{ color: "#687791" }}>No answers recorded</p>
            ) : (
              <div className="answers-table-wrapper">
                <table className="answers-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Question</th>
                      <th>Student Answer</th>
                      <th>Correct Answer</th>
                      <th>Status</th>
                      <th>Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d, index) => {
                      const answered = String(d.userAnswer ?? "").trim() !== "";
                      return (
                        <tr key={d.qid} style={{ background: d.isCorrect ? "#f1fbf3" : "#fff5f5" }}>
                          <td>{index + 1}</td>
                          <td style={{ maxWidth: 280 }}>{d.question}</td>
                          <td>{answered ? d.userAnswer : <em style={{ color: "#9ca3af" }}>Not answered</em>}</td>
                          <td style={{ color: "#28a745", fontWeight: 600 }}>{d.correctAnswer}</td>
                          <td style={{ color: d.isCorrect ? "#28a745" : "#dc3545", fontWeight: 600 }}>
                            {d.isCorrect ? "Correct" : answered ? "Wrong" : "Skipped"}
                          </td>
                          <td>{d.earned} / {d.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            <FiX size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Close
          </button>
          <button 
            className="btn-save" 
            onClick={exportToExcel}
            style={{ background: "#28a745" }}
          >
            <FiDownload size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Export to Excel
          </button>
        </div>
      </div>
    </div>
  );
}