// client/src/pages/AdminDashboard/AdminDashboard.jsx
// Fix the imports at the top

import React, { useEffect, useState, useCallback, useMemo } from "react";
import "../../styles/portal.css";
import api from "../../api";
import * as faceapi from "face-api.js";

// ✅ Correct imports from react-icons
import { 
  FiHome, FiUsers, FiBook, FiFileText, FiCamera, FiSettings, 
  FiBarChart2, FiLogOut, FiSun, FiMoon, FiPlus, FiEdit2, 
  FiTrash2, FiSearch, FiFilter, FiDownload, FiUpload,
  FiChevronDown, FiChevronRight, FiUser, FiMail, FiLock,
  FiCheckCircle, FiXCircle, FiClock, FiCalendar, FiAward,
  FiLayers, FiGrid, FiList, FiMenu, FiRefreshCw, FiEye
} from "react-icons/fi";

import { 
  FaGraduationCap, FaUniversity, FaQuestionCircle, FaClipboardList,
  FaUserGraduate, FaChalkboardTeacher, FaBookOpen
} from "react-icons/fa";

// ... rest of the code
// Components
import StatsCards from "./components/StatsCards";
import DepartmentsTab from "./components/DepartmentsTab";
import PatternsTab from "./components/PatternsTab";
import StudentsTab from "./components/StudentsTab";
import QuestionsTab from "./components/QuestionsTab";
import SubmissionsTab from "./components/SubmissionsTab";
import SnapshotsTab from "./components/SnapshotsTab";

// Modals
import EditDepartmentModal from "./components/Modals/EditDepartmentModal";
import EditPatternModal from "./components/Modals/EditPatternModal";
import EditUserModal from "./components/Modals/EditUserModal";
import EditQuestionModal from "./components/Modals/EditQuestionModal";

// Styles
import "./styles/dashboard.css";

const PAGE_SIZE = 10;
let globalModelsLoaded = false;

export default function AdminDashboard({ go, token }) {
  // State Management
  const [state, setState] = useState({
    users: [],
    questions: [],
    submissions: [],
    snapshots: [],
    departments: [],
    patterns: [],
    loading: false,
    error: null,
  });

  const [ui, setUi] = useState({
    activeTab: "departments",
    darkMode: false,
    previewImage: null,
    searchUser: "",
    searchQ: "",
    searchSub: "",
    cameraEnabled: "no",
    compilerVisible: "no",
    compilerLanguage: "python",
    editingQuestion: null,
    editingDepartment: null,
    editingPattern: null,
    editingUser: null,
    uploadingUserId: null,
    selectedDepartment: "",
    selectedPattern: "",
  });

  const [pagination, setPagination] = useState({
    students: 1,
    questions: 1,
    submissions: 1,
    snapshots: 1,
    departments: 1,
    patterns: 1,
  });

  const [newDepartment, setNewDepartment] = useState({
    name: "",
    code: "",
    description: "",
  });

  const [newPattern, setNewPattern] = useState({
    pattern_no: "",
    department_id: "",
    total_questions: 10,
    time_limit_minutes: 30,
    description: "",
    passing_percentage: 40,
    is_active: true,
  });

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    reg_no: "",
    password: "",
    department_id: "",
    pattern_id: "",
  });

  const [newQuestion, setNewQuestion] = useState({
    type: "MCQ",
    word: "",
    A: "",
    B: "",
    C: "",
    D: "",
    correct: "",
    department_id: "",
    pattern_id: "",
    points: 1,
  });

  const [modelsReady, setModelsReady] = useState(false);

  // Memoized filtered data
  const filteredData = useMemo(() => ({
    users: state.users.filter((u) =>
      u.name?.toLowerCase().includes(ui.searchUser.toLowerCase())
    ),
    questions: state.questions.filter((q) =>
      q.word?.toLowerCase().includes(ui.searchQ.toLowerCase())
    ),
    submissions: state.submissions.filter((s) =>
      `${s.user_id} ${s.malpractice_reason} ${s.test_id}`
        .toLowerCase()
        .includes(ui.searchSub.toLowerCase())
    ),
    snapshots: state.snapshots,
    departments: state.departments,
    patterns: state.patterns,
  }), [
    state.users,
    state.questions,
    state.submissions,
    state.snapshots,
    state.departments,
    state.patterns,
    ui.searchUser,
    ui.searchQ,
    ui.searchSub,
  ]);

  // Paginated data
  const paginatedData = useMemo(() => ({
    users: filteredData.users.slice(
      (pagination.students - 1) * PAGE_SIZE,
      pagination.students * PAGE_SIZE
    ),
    questions: filteredData.questions
      .filter((q) => {
        if (!ui.selectedDepartment && !ui.selectedPattern) return true;
        if (ui.selectedDepartment && q.department_id !== parseInt(ui.selectedDepartment)) return false;
        if (ui.selectedPattern && q.pattern_id !== parseInt(ui.selectedPattern)) return false;
        return true;
      })
      .slice(
        (pagination.questions - 1) * PAGE_SIZE,
        pagination.questions * PAGE_SIZE
      ),
    submissions: filteredData.submissions.slice(
      (pagination.submissions - 1) * PAGE_SIZE,
      pagination.submissions * PAGE_SIZE
    ),
    snapshots: filteredData.snapshots.slice(
      (pagination.snapshots - 1) * PAGE_SIZE,
      pagination.snapshots * PAGE_SIZE
    ),
    departments: filteredData.departments.slice(
      (pagination.departments - 1) * PAGE_SIZE,
      pagination.departments * PAGE_SIZE
    ),
    patterns: filteredData.patterns
      .filter((p) => {
        if (!ui.selectedDepartment) return true;
        return p.department_id === parseInt(ui.selectedDepartment);
      })
      .slice(
        (pagination.patterns - 1) * PAGE_SIZE,
        pagination.patterns * PAGE_SIZE
      ),
  }), [filteredData, pagination, ui.selectedDepartment, ui.selectedPattern]);

  // Fetch functions
  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [
        usersRes,
        questionsRes,
        submissionsRes,
        snapshotsRes,
        deptsRes,
        patternsRes,
      ] = await Promise.all([
        api.get("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/api/questions", {
          params: { test_id: "default_test" },
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/api/submissions", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/api/snapshots", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/api/departments", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/api/patterns", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setState((prev) => ({
        ...prev,
        loading: false,
        users: usersRes.data.data || [],
        questions: (questionsRes.data.data || []).sort((a, b) =>
          (a.word || "").localeCompare(b.word || "")
        ),
        submissions: (submissionsRes.data.data || []).sort(
          (a, b) => new Date(b.finished_at) - new Date(a.finished_at)
        ),
        snapshots: (snapshotsRes.data.data || []).sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        ),
        departments: deptsRes.data.data || [],
        patterns: patternsRes.data.data || [],
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message }));
      console.error("Fetch error:", error);
    }
  }, [token]);

  const fetchSettings = useCallback(async () => {
    try {
      const [cameraRes, compilerRes] = await Promise.all([
        api.get("/api/test/camera-verification", {
          params: { test_id: "default_test" },
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/api/test/compiler-setting", {
          params: { test_id: "default_test" },
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setUi((prev) => ({
        ...prev,
        cameraEnabled: cameraRes.data.camera_verification || "no",
        compilerVisible: compilerRes.data.compiler_visible || "no",
        compilerLanguage: compilerRes.data.compiler_language || "python",
      }));
    } catch (error) {
      console.error("Settings fetch error:", error);
    }
  }, [token]);

  // Load face detection models
  useEffect(() => {
    const loadModels = async () => {
      try {
        if (!globalModelsLoaded) {
          const MODEL_URL = "/models";
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
          await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
          await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
          globalModelsLoaded = true;
        }
        setModelsReady(true);
      } catch (error) {
        console.error("Face model load error:", error);
        setModelsReady(false);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, [fetchData, fetchSettings]);

  // ==================== OPERATIONS ====================
  const addDepartment = async () => {
    if (!newDepartment.name || !newDepartment.code) {
      alert("Please enter department name and code");
      return;
    }

    try {
      const res = await api.post("/api/departments", newDepartment, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.ok) {
        setNewDepartment({ name: "", code: "", description: "" });
        fetchData();
        alert("Department added successfully!");
      } else {
        alert(res.data.error || "Failed to add department");
      }
    } catch (error) {
      console.error("Add department error:", error);
      alert("Error adding department");
    }
  };

  const deleteDepartment = async (id) => {
    if (!window.confirm("Delete this department AND all its students, patterns, questions, submissions and snapshots? This cannot be undone.")) return;
    try {
      const res = await api.delete(`/api/departments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        fetchData();
        alert(res.data.message || "Department deleted successfully");
      } else {
        alert(res.data.error);
      }
    } catch (error) {
      console.error("Delete department error:", error);
      alert(error.response?.data?.error || "Error deleting department");
    }
  };

  const addPattern = async () => {
    if (!newPattern.pattern_no || !newPattern.department_id) {
      alert("Please enter pattern number and select department");
      return;
    }

    try {
      const res = await api.post("/api/patterns", newPattern, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.ok) {
        setNewPattern({
          pattern_no: "",
          department_id: "",
          total_questions: 10,
          time_limit_minutes: 30,
          description: "",
          passing_percentage: 40,
          is_active: true,
        });
        fetchData();
        alert("Question pattern added successfully!");
      } else {
        alert(res.data.error || "Failed to add pattern");
      }
    } catch (error) {
      console.error("Add pattern error:", error);
      alert("Error adding pattern");
    }
  };

  const deletePattern = async (id) => {
    if (!window.confirm("Delete this pattern AND all its questions and submissions? (Students stay, but lose this pattern.) This cannot be undone.")) return;
    try {
      const res = await api.delete(`/api/patterns/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        fetchData();
        alert(res.data.message || "Pattern deleted successfully");
      } else {
        alert(res.data.error);
      }
    } catch (error) {
      console.error("Delete pattern error:", error);
      alert(error.response?.data?.error || "Error deleting pattern");
    }
  };

  const addUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.reg_no || !newUser.password) {
      alert("Please fill all user details");
      return;
    }

    if (!newUser.department_id) {
      alert("Please select a department");
      return;
    }

    try {
      const res = await api.post("/api/users", {
        name: newUser.name,
        email: newUser.email,
        reg_no: newUser.reg_no,
        password: newUser.password,
        department_id: parseInt(newUser.department_id),
        pattern_id: newUser.pattern_id || null,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.ok) {
        setNewUser({
          name: "",
          email: "",
          reg_no: "",
          password: "",
          department_id: "",
          pattern_id: "",
        });
        fetchData();
        alert("✅ Student added successfully!");
      } else {
        alert(res.data.error || "Failed to add student");
      }
    } catch (error) {
      console.error("Add user error:", error);
      alert(error.response?.data?.error || "Error adding student. Please try again.");
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this student AND all their submissions, snapshots and face image? This cannot be undone.")) return;
    try {
      const res = await api.delete(`/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        fetchData();
        alert(res.data.message || "Student deleted successfully");
      } else {
        alert(res.data.error);
      }
    } catch (error) {
      console.error("Delete user error:", error);
      alert(error.response?.data?.error || "Error deleting student");
    }
  };

  const clearFace = async (userId) => {
    if (!window.confirm("Clear registered face for this student?")) return;
    try {
      const res = await api.post(
        "/api/face/clear",
        { user_id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.ok) {
        fetchData();
        alert("Face data cleared successfully");
      } else {
        alert(res.data.error || "Failed to clear face");
      }
    } catch (error) {
      console.error("Clear face error:", error);
      alert("Error clearing face");
    }
  };

  const handleFaceUpload = async (userId, file) => {
    if (!file) return;
    if (!modelsReady) {
      alert("Face models are loading. Please wait a moment...");
      return;
    }

    setUi((prev) => ({ ...prev, uploadingUserId: userId }));

    try {
      const descriptor = await extractFaceDescriptor(file);
      if (!descriptor) {
        alert("No face detected in the image. Please try another photo.");
        setUi((prev) => ({ ...prev, uploadingUserId: null }));
        return;
      }

      const formData = new FormData();
      formData.append("user_id", userId);
      formData.append("image", file);
      formData.append("descriptor", JSON.stringify(descriptor));

      const res = await api.post("/api/face/upload-image", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.ok) {
        alert("Face image registered successfully! ✅");
        fetchData();
      } else {
        alert(res.data.error || "Failed to register face");
      }
    } catch (error) {
      console.error("Face upload error:", error);
      alert("Error uploading face image");
    } finally {
      setUi((prev) => ({ ...prev, uploadingUserId: null }));
    }
  };

  const extractFaceDescriptor = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
          resolve(detection ? Array.from(detection.descriptor) : null);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

const addQuestion = async () => {
  const type = String(
    newQuestion.type || "MCQ"
  )
    .trim()
    .toUpperCase();

  const word = String(
    newQuestion.word || ""
  ).trim();

  const correct = String(
    newQuestion.correct || ""
  ).trim();

  const departmentId = Number(
    newQuestion.department_id
  );

  const patternId = Number(
    newQuestion.pattern_id
  );

  const points = Number(
    newQuestion.points ?? 1
  );

  /*
  |--------------------------------------------------------------------------
  | BASIC VALIDATION
  |--------------------------------------------------------------------------
  */

  if (!word) {
    alert("Please enter the question");
    return;
  }

  if (
    !Number.isInteger(departmentId) ||
    departmentId <= 0
  ) {
    alert("Please select a department");
    return;
  }

  if (
    !Number.isInteger(patternId) ||
    patternId <= 0
  ) {
    alert("Please select a pattern");
    return;
  }

  if (!correct) {
    alert("Please enter/select the correct answer");
    return;
  }

  if (
    !Number.isInteger(points) ||
    points <= 0
  ) {
    alert("Points must be a positive number");
    return;
  }

  /*
  |--------------------------------------------------------------------------
  | MCQ VALIDATION
  |--------------------------------------------------------------------------
  */

  if (type === "MCQ") {
    const A = String(
      newQuestion.A || ""
    ).trim();

    const B = String(
      newQuestion.B || ""
    ).trim();

    const C = String(
      newQuestion.C || ""
    ).trim();

    const D = String(
      newQuestion.D || ""
    ).trim();

    if (!A || !B || !C || !D) {
      alert(
        "MCQ requires all four options: A, B, C and D"
      );
      return;
    }

    const normalizedCorrect =
      correct.toUpperCase();

    if (
      ![
        "A",
        "B",
        "C",
        "D",
      ].includes(normalizedCorrect)
    ) {
      alert(
        "For MCQ, correct answer must be A, B, C or D"
      );
      return;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | TRUE / FALSE VALIDATION
  |--------------------------------------------------------------------------
  */

  if (
    type === "TRUE_FALSE"
  ) {
    const normalized =
      correct.toLowerCase();

    if (
      ![
        "true",
        "false",
      ].includes(normalized)
    ) {
      alert(
        "For TRUE/FALSE, correct answer must be true or false"
      );
      return;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | PAYLOAD
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  | Database columns are:
  |
  | word
  | question_type
  | optA
  | optB
  | optC
  | optD
  | correct
  | points
  | department_id
  | pattern_id
  |
  */

  const payload = {
    test_id: "default_test",

    word,

    question_type: type,

    optA:
      type === "MCQ"
        ? String(
            newQuestion.A || ""
          ).trim()
        : "",

    optB:
      type === "MCQ"
        ? String(
            newQuestion.B || ""
          ).trim()
        : "",

    optC:
      type === "MCQ"
        ? String(
            newQuestion.C || ""
          ).trim()
        : "",

    optD:
      type === "MCQ"
        ? String(
            newQuestion.D || ""
          ).trim()
        : "",

    correct:
      type === "MCQ"
        ? correct.toUpperCase()
        : correct,

    points,

    department_id:
      departmentId,

    pattern_id:
      patternId,
  };

  console.log(
    "ADDING QUESTION:",
    payload
  );

  /*
  |--------------------------------------------------------------------------
  | SEND TO SERVER
  |--------------------------------------------------------------------------
  */

  try {
    const res = await api.post(
      "/api/questions",
      payload,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
      }
    );

    console.log(
      "ADD QUESTION RESPONSE:",
      res.data
    );

    if (res.data?.ok) {
      /*
      |--------------------------------------------------------------------------
      | CLEAR FORM
      |--------------------------------------------------------------------------
      */

      setNewQuestion({
        type: "MCQ",
        word: "",
        A: "",
        B: "",
        C: "",
        D: "",
        correct: "",
        department_id: "",
        pattern_id: "",
        points: 1,
      });

      /*
      |--------------------------------------------------------------------------
      | REFRESH QUESTIONS
      |--------------------------------------------------------------------------
      */

      await fetchData();

      alert(
        "✅ Question added successfully!"
      );
    } else {
      alert(
        res.data?.error ||
          "Failed to add question"
      );
    }
  } catch (error) {
    console.error(
      "Add question error:",
      error
    );

    const message =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.response?.data?.details ||
      error?.message ||
      "Error adding question";

    alert(
      `❌ ${message}`
    );
  }
};
  const deleteQuestion = async (qid) => {
    if (!window.confirm("Delete this question permanently?")) return;
    try {
      await api.delete(`/api/questions/${qid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
      alert("Question deleted successfully");
    } catch (error) {
      console.error("Delete question error:", error);
      alert(error.response?.data?.error || "Error deleting question");
    }
  };

  const deleteAllQuestions = async () => {
    if (!state.questions.length) return alert("No questions to delete");
    if (!window.confirm(`Delete ALL ${state.questions.length} questions?`)) return;

    try {
      await api.delete("/api/questions/all", {
        params: { test_id: "default_test" },
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
      alert("All questions deleted");
    } catch (error) {
      console.error("Delete all questions error:", error);
      alert(error.response?.data?.error || "Error deleting questions");
    }
  };

  const updateQuestion = async (data) => {
    try {
      const res = await api.put("/api/questions", data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.ok) {
        setUi((prev) => ({ ...prev, editingQuestion: null }));
        fetchData();
        alert("Question updated successfully!");
      } else {
        alert(res.data.error || "Update failed");
      }
    } catch (error) {
      console.error("Update question error:", error);
      alert("Error updating question");
    }
  };

  const handleBulkImport = async (questionsData) => {
    if (!questionsData || questionsData.length === 0) {
      alert("No questions to import.");
      return { ok: false, error: "No questions to import" };
    }

    try {
      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (const q of questionsData) {
        try {
          if (!q.word || !q.word.trim()) {
            results.failed++;
            results.errors.push(`Row ${q._row || '?'}: Missing question text`);
            continue;
          }

          if (!q.correct || !q.correct.trim()) {
            results.failed++;
            results.errors.push(`Row ${q._row || '?'}: Missing correct answer`);
            continue;
          }

          const qid = `Q${Date.now()}${Math.floor(Math.random() * 10000)}${results.success}`;

          const payload = {
            qid: qid,
            test_id: "default_test",
            word: q.word.trim(),
            points: parseInt(q.points) || 1,
            question_type: q.question_type || "MCQ",
            optA: q.optA || "",
            optB: q.optB || "",
            optC: q.optC || "",
            optD: q.optD || "",
            correct: q.correct.trim(),
            department_id: q.department_id || null,
            pattern_id: q.pattern_id || null,
          };

          const res = await api.post("/api/questions", payload, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.data.ok) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push(`Row ${q._row || '?'}: ${res.data.error || 'Unknown server error'}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${q._row || '?'}: ${error.message}`);
        }
      }

      await fetchData();

      let message = `✅ Successfully imported ${results.success} questions!`;
      if (results.failed > 0) {
        message += `\n❌ ${results.failed} questions failed.`;
      }
      alert(message);

      return {
        ok: true,
        data: results
      };
    } catch (error) {
      console.error("Bulk import error:", error);
      alert("Failed to import questions. Please try again.");
      return {
        ok: false,
        error: error.message
      };
    }
  };

  const updateCameraSetting = async (value) => {
    setUi((prev) => ({ ...prev, cameraEnabled: value }));
    try {
      await api.post(
        "/api/test/camera-verification",
        { test_id: "default_test", camera_verification: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error("Update camera setting error:", error);
    }
  };

  const updateCompilerSetting = async (visible, language) => {
    setUi((prev) => ({
      ...prev,
      compilerVisible: visible,
      compilerLanguage: language,
    }));
    try {
      await api.post(
        "/api/test/compiler-setting",
        {
          test_id: "default_test",
          compiler_visible: visible,
          compiler_language: language,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error("Update compiler setting error:", error);
    }
  };

  const exportData = (type) => {
    let data = [];
    let headers = [];
    let filename = "";

    switch (type) {
      case "submissions":
        data = state.submissions;
        headers = [
          "User ID",
          "Score",
          "Percentage",
          "Malpractice Reason",
          "Test ID",
          "Started At",
          "Finished At",
        ];
        filename = `exam_results_${new Date().toISOString().split("T")[0]}`;
        break;
      case "questions":
        let filteredQs = state.questions;
        if (ui.selectedDepartment) {
          filteredQs = filteredQs.filter(
            (q) => q.department_id === parseInt(ui.selectedDepartment)
          );
        }
        if (ui.selectedPattern) {
          filteredQs = filteredQs.filter(
            (q) => q.pattern_id === parseInt(ui.selectedPattern)
          );
        }
        data = filteredQs;
        headers = [
          "QID",
          "Question",
          "Type",
          "Option A",
          "Option B",
          "Option C",
          "Option D",
          "Correct",
          "Points",
          "Department",
          "Pattern",
        ];
        filename = `questions_${new Date().toISOString().split("T")[0]}`;
        break;
      case "users":
        data = state.users;
        headers = [
          "User ID",
          "Name",
          "Email",
          "Registration No",
          "Department",
          "Pattern",
          "Login Count",
          "Face Registered",
        ];
        filename = `students_${new Date().toISOString().split("T")[0]}`;
        break;
      case "departments":
        data = state.departments;
        headers = [
          "ID",
          "Name",
          "Code",
          "Description",
          "Status",
          "Students",
          "Patterns",
          "Questions",
        ];
        filename = `departments_${new Date().toISOString().split("T")[0]}`;
        break;
      case "patterns":
        let filteredP = state.patterns;
        if (ui.selectedDepartment) {
          filteredP = filteredP.filter(
            (p) => p.department_id === parseInt(ui.selectedDepartment)
          );
        }
        data = filteredP;
        headers = [
          "ID",
          "Pattern No",
          "Department",
          "Total Questions",
          "Time Limit",
          "Passing %",
          "Status",
          "Actual Questions",
        ];
        filename = `patterns_${new Date().toISOString().split("T")[0]}`;
        break;
      default:
        return;
    }

    const rows = data.map((item) => {
      if (type === "submissions") {
        return [
          item.user_id,
          item.score,
          item.percentage,
          item.malpractice_reason || "Normal",
          item.test_id,
          new Date(item.started_at).toLocaleString(),
          new Date(item.finished_at).toLocaleString(),
        ];
      } else if (type === "questions") {
        const dept = state.departments.find((d) => d.id === item.department_id);
        const pattern = state.patterns.find((p) => p.id === item.pattern_id);
        return [
          item.qid,
          item.word,
          item.question_type,
          item.optA || "",
          item.optB || "",
          item.optC || "",
          item.optD || "",
          item.correct,
          item.points || 1,
          dept?.name || "",
          pattern?.pattern_no || "",
        ];
      } else if (type === "users") {
        const dept = state.departments.find((d) => d.id === item.department_id);
        const pattern = state.patterns.find((p) => p.id === item.pattern_id);
        return [
          item.user_id,
          item.name,
          item.email,
          item.reg_no,
          dept?.name || "N/A",
          pattern?.pattern_no || "N/A",
          item.login_count || 0,
          item.face_image_url ? "Yes" : "No",
        ];
      } else if (type === "departments") {
        const studentCount = state.users.filter(
          (u) => u.department_id === item.id
        ).length;
        const patternCount = state.patterns.filter(
          (p) => p.department_id === item.id
        ).length;
        const questionCount = state.questions.filter(
          (q) => q.department_id === item.id
        ).length;
        return [
          item.id,
          item.name,
          item.code,
          item.description || "",
          item.is_active !== false ? "Active" : "Inactive",
          studentCount,
          patternCount,
          questionCount,
        ];
      } else if (type === "patterns") {
        const dept = state.departments.find((d) => d.id === item.department_id);
        const questionCount = state.questions.filter(
          (q) => q.pattern_id === item.id
        ).length;
        return [
          item.id,
          item.pattern_no,
          dept?.name || "N/A",
          item.total_questions || 0,
          item.time_limit_minutes || 0,
          item.passing_percentage || 40,
          item.is_active !== false ? "Active" : "Inactive",
          questionCount,
        ];
      }
      return [];
    });

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==================== RENDER ====================
  const styles = {
    background: ui.darkMode ? "#0a0e1a" : "#eef2f7",
    cardBg: ui.darkMode ? "#151f33" : "#ffffff",
    text: ui.darkMode ? "#e8edf4" : "#1a2a4a",
    textMuted: ui.darkMode ? "#8899bb" : "#5a6a8a",
    shadow: ui.darkMode
      ? "0 8px 32px rgba(0,0,0,0.5)"
      : "0 8px 32px rgba(0,0,0,0.1)",
  };

  const tabs = [
    { id: "departments", label: "Departments", icon: <FaUniversity />, count: state.departments.length },
    { id: "patterns", label: "Patterns", icon: <FiLayers />, count: state.patterns.length },
    { id: "students", label: "Students", icon: <FaUserGraduate />, count: state.users.length },
    { id: "questions", label: "Questions", icon: <FaQuestionCircle />, count: state.questions.length },
    { id: "submissions", label: "Submissions", icon: <FaClipboardList />, count: state.submissions.length },
    { id: "snapshots", label: "Snapshots", icon: <FiCamera />, count: state.snapshots.length },
  ];


  // In AdminDashboard.jsx - Add this function

// ==================== BULK IMPORT STUDENTS ====================
// client/src/pages/AdminDashboard/AdminDashboard.jsx
// Add this function after the other operations

// ==================== BULK IMPORT STUDENTS ====================
const handleBulkImportStudents = async (studentsData) => {
  if (!studentsData || studentsData.length === 0) {
    alert("No students to import.");
    return { ok: false, error: "No students to import" };
  }

  try {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    console.log(`📥 Starting bulk import for ${studentsData.length} students`);

    for (const s of studentsData) {
      try {
        // Validate required fields
        if (!s.name || !s.name.trim()) {
          results.failed++;
          results.errors.push(`Row ${s._row || '?'}: Missing name`);
          continue;
        }

        if (!s.email || !s.email.trim()) {
          results.failed++;
          results.errors.push(`Row ${s._row || '?'}: Missing email`);
          continue;
        }

        if (!s.reg_no || !s.reg_no.trim()) {
          results.failed++;
          results.errors.push(`Row ${s._row || '?'}: Missing registration number`);
          continue;
        }

        // Check if user already exists
        const checkRes = await api.get(`/api/users`, {
          params: { email: s.email.trim(), reg_no: s.reg_no.trim() },
          headers: { Authorization: `Bearer ${token}` },
        });

        // Generate user_id
        const user_id = `U${Date.now()}${Math.floor(Math.random() * 10000)}${results.success}`;

        // Prepare payload
        const payload = {
          user_id: user_id,
          name: s.name.trim(),
          email: s.email.trim().toLowerCase(),
          reg_no: s.reg_no.trim(),
          password: s.password || 'student123',
          department_id: s.department_id || null,
        };

        console.log(`📝 Importing student ${results.success + results.failed + 1}:`, payload.name);

        const res = await api.post("/api/users", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.ok) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Row ${s._row || '?'}: ${res.data.error || 'Unknown error'}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${s._row || '?'}: ${error.message}`);
        console.error(`Error importing row ${s._row || '?'}:`, error);
      }
    }

    console.log("✅ Import complete:", results);

    // Refresh data after import
    await fetchData();

    // Show detailed results
    let message = `✅ Successfully imported ${results.success} students!`;
    if (results.failed > 0) {
      message += `\n❌ ${results.failed} students failed.`;
      if (results.errors.length > 0) {
        message += `\n\nErrors:\n${results.errors.slice(0, 5).join('\n')}`;
        if (results.errors.length > 5) {
          message += `\n... and ${results.errors.length - 5} more errors.`;
        }
      }
    }
    alert(message);

    return {
      ok: true,
      data: results
    };
  } catch (error) {
    console.error("Bulk import error:", error);
    alert("Failed to import students. Please try again.");
    return {
      ok: false,
      error: error.message
    };
  }
};

  return (
    <div style={{ minHeight: "100vh", background: styles.background, padding: 20 }}>
      {/* Preview Modal */}
      {ui.previewImage && (
        <div className="popup-bg" onClick={() => setUi((prev) => ({ ...prev, previewImage: null }))}>
          <img
            src={ui.previewImage}
            alt="Preview"
            style={{
              maxWidth: "90%",
              maxHeight: "90vh",
              borderRadius: 12,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              objectFit: "contain",
            }}
          />
        </div>
      )}

      {/* Edit Modals */}
      <EditDepartmentModal
        isOpen={!!ui.editingDepartment}
        department={ui.editingDepartment}
        onClose={() => setUi((prev) => ({ ...prev, editingDepartment: null }))}
        onSave={async (id, data) => {
          try {
            const res = await api.put(`/api/departments/${id}`, data, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.ok) {
              fetchData();
              setUi((prev) => ({ ...prev, editingDepartment: null }));
              alert("Department updated!");
            } else {
              alert(res.data.error || "Update failed");
            }
          } catch (error) {
            alert("Error updating department");
          }
        }}
        darkMode={ui.darkMode}
      />

      <EditPatternModal
        isOpen={!!ui.editingPattern}
        pattern={ui.editingPattern}
        onClose={() => setUi((prev) => ({ ...prev, editingPattern: null }))}
        onSave={async (id, data) => {
          try {
            const res = await api.put(`/api/patterns/${id}`, data, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.ok) {
              fetchData();
              setUi((prev) => ({ ...prev, editingPattern: null }));
              alert("Pattern updated!");
            } else {
              alert(res.data.error || "Update failed");
            }
          } catch (error) {
            alert("Error updating pattern");
          }
        }}
        darkMode={ui.darkMode}
      />

      <EditUserModal
        isOpen={!!ui.editingUser}
        user={ui.editingUser}
        onClose={() => setUi((prev) => ({ ...prev, editingUser: null }))}
        onSave={async (id, data) => {
          try {
            const res = await api.put(`/api/users/${id}`, data, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.ok) {
              fetchData();
              setUi((prev) => ({ ...prev, editingUser: null }));
              alert("User updated!");
            } else {
              alert(res.data.error || "Update failed");
            }
          } catch (error) {
            alert("Error updating user");
          }
        }}
        darkMode={ui.darkMode}
      />

      <EditQuestionModal
        isOpen={!!ui.editingQuestion}
        question={ui.editingQuestion}
        departments={state.departments}
        patterns={state.patterns}
        onClose={() => setUi((prev) => ({ ...prev, editingQuestion: null }))}
        onSave={updateQuestion}
        darkMode={ui.darkMode}
      />

      {/* Main Dashboard */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          background: styles.cardBg,
          borderRadius: 16,
          padding: 24,
          boxShadow: styles.shadow,
          color: styles.text,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: `1px solid ${ui.darkMode ? "#2a3a5a" : "#e5e7eb"}`,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: styles.text }}>
              <FiBarChart2 style={{ marginRight: 10, verticalAlign: "middle", color: "#3758f9" }} />
              Admin Dashboard
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: styles.textMuted }}>
              Department & Pattern Based Exam Management System
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setUi((prev) => ({ ...prev, darkMode: !prev.darkMode }))}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${ui.darkMode ? "#2a3a5a" : "#d0d7e8"}`,
                background: "transparent",
                color: styles.text,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                transition: "all 0.2s",
              }}
            >
              {ui.darkMode ? <FiSun size={16} /> : <FiMoon size={16} />}
              {ui.darkMode ? "Light" : "Dark"}
            </button>
            <button
              onClick={() => go("login")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#dc3545",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                transition: "all 0.2s",
              }}
            >
              <FiLogOut size={16} />
              Logout
            </button>
          </div>
        </div>

        {/* Stats */}
        <StatsCards
          departments={state.departments.length}
          patterns={state.patterns.length}
          students={state.users.length}
          questions={state.questions.length}
          submissions={state.submissions.length}
          snapshots={state.snapshots.length}
        />

        {/* Camera Toggle */}
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "12px 16px",
            background: ui.darkMode ? "#1a2332" : "#f8f9fa",
            borderRadius: 8,
            border: `1px solid ${ui.darkMode ? "#2a3a5a" : "#e5e7eb"}`,
          }}
        >
          <FiCamera size={18} color={styles.textMuted} />
          <label style={{ fontWeight: 600, color: styles.text }}>Camera Verification:</label>
          <select
            className="input-box"
            style={{ width: 120 }}
            value={ui.cameraEnabled}
            onChange={(e) => updateCameraSetting(e.target.value)}
          >
            <option value="no">OFF</option>
            <option value="yes">ON</option>
          </select>
          <span style={{ fontSize: 13, color: styles.textMuted }}>
            {ui.cameraEnabled === "yes" ? "● Active" : "○ Disabled"}
          </span>
        </div>

        {/* Tabs */}
        <div className="dashboard-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${ui.activeTab === tab.id ? "active" : ""}`}
              onClick={() => setUi((prev) => ({ ...prev, activeTab: tab.id }))}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
              {tab.count > 0 && <span className="tab-badge">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: 400 }}>
          {state.loading && (
            <div style={{ textAlign: "center", padding: 40, color: styles.textMuted }}>
              <FiRefreshCw size={32} style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ marginTop: 12 }}>Loading...</p>
            </div>
          )}
          {!state.loading && (
            <>
              {ui.activeTab === "departments" && (
                <DepartmentsTab
                  departments={paginatedData.departments}
                  allDepartments={state.departments}
                  users={state.users}
                  questions={state.questions}
                  patterns={state.patterns}
                  loading={state.loading}
                  pagination={pagination}
                  setPagination={setPagination}
                  onEdit={(dept) => setUi((prev) => ({ ...prev, editingDepartment: dept }))}
                  onDelete={deleteDepartment}
                  onViewPatterns={(id) => {
                    setUi((prev) => ({ ...prev, selectedDepartment: id, activeTab: "patterns" }));
                  }}
                  newDepartment={newDepartment}
                  setNewDepartment={setNewDepartment}
                  onAddDepartment={addDepartment}
                />
              )}
              {ui.activeTab === "patterns" && (
                <PatternsTab
                  patterns={paginatedData.patterns}
                  allPatterns={state.patterns}
                  departments={state.departments}
                  questions={state.questions}
                  selectedDepartment={ui.selectedDepartment}
                  loading={state.loading}
                  pagination={pagination}
                  setPagination={setPagination}
                  onEdit={(pattern) => setUi((prev) => ({ ...prev, editingPattern: pattern }))}
                  onDelete={deletePattern}
                  onViewQuestions={(deptId, patternId) => {
                    setUi((prev) => ({
                      ...prev,
                      selectedDepartment: deptId,
                      selectedPattern: patternId,
                      activeTab: "questions",
                    }));
                  }}
                  onFilterChange={(deptId) => {
                    setUi((prev) => ({ ...prev, selectedDepartment: deptId }));
                    setPagination((prev) => ({ ...prev, patterns: 1 }));
                  }}
                  newPattern={newPattern}
                  setNewPattern={setNewPattern}
                  onAddPattern={addPattern}
                />
              )}
              {ui.activeTab === "students" && (
                <StudentsTab
                  users={paginatedData.users}
                  allUsers={state.users}
                  departments={state.departments}
                  patterns={state.patterns}
                  loading={state.loading}
                  pagination={pagination}
                  setPagination={setPagination}
                  onEdit={(user) => setUi((prev) => ({ ...prev, editingUser: user }))}
                  onDelete={deleteUser}
                  onFaceUpload={handleFaceUpload}
                  onClearFace={clearFace}
                  uploadingUserId={ui.uploadingUserId}
                  onSearchChange={(search) => {
                    setUi((prev) => ({ ...prev, searchUser: search }));
                    setPagination((prev) => ({ ...prev, students: 1 }));
                  }}
                  searchUser={ui.searchUser}
                  newUser={newUser}
                  setNewUser={setNewUser}
                  onAddUser={addUser}
                      onBulkImportStudents={handleBulkImportStudents}  // ✅ Add this line

                />
              )}
              {ui.activeTab === "questions" && (
                <QuestionsTab
                  questions={paginatedData.questions}
                  allQuestions={state.questions}
                  departments={state.departments}
                  patterns={state.patterns}
                  selectedDepartment={ui.selectedDepartment}
                  selectedPattern={ui.selectedPattern}
                  loading={state.loading}
                  pagination={pagination}
                  setPagination={setPagination}
                  compilerVisible={ui.compilerVisible}
                  compilerLanguage={ui.compilerLanguage}
                  onEdit={(q) => setUi((prev) => ({ ...prev, editingQuestion: q }))}
                  onDelete={deleteQuestion}
                  onDeleteAll={deleteAllQuestions}
                  onFilterChange={(deptId, patternId) => {
                    setUi((prev) => ({
                      ...prev,
                      selectedDepartment: deptId,
                      selectedPattern: patternId,
                    }));
                    setPagination((prev) => ({ ...prev, questions: 1 }));
                  }}
                  onSearchChange={(search) => {
                    setUi((prev) => ({ ...prev, searchQ: search }));
                    setPagination((prev) => ({ ...prev, questions: 1 }));
                  }}
                  searchQ={ui.searchQ}
                  onExport={() => exportData("questions")}
                  onCompilerChange={updateCompilerSetting}
                  newQuestion={newQuestion}
                  setNewQuestion={setNewQuestion}
                  onAddQuestion={addQuestion}
                  onBulkImport={handleBulkImport}
                />
              )}
              {ui.activeTab === "submissions" && (
                <SubmissionsTab
                  submissions={paginatedData.submissions}
                  allSubmissions={state.submissions}
                  departments={state.departments}
                  patterns={state.patterns}
                  loading={state.loading}
                  pagination={pagination}
                  setPagination={setPagination}
                  onSearchChange={(search) => {
                    setUi((prev) => ({ ...prev, searchSub: search }));
                    setPagination((prev) => ({ ...prev, submissions: 1 }));
                  }}
                  searchSub={ui.searchSub}
                  onExport={() => exportData("submissions")}
                  onRefresh={fetchData}
                  token={token}
                />
              )}
              {ui.activeTab === "snapshots" && (
                <SnapshotsTab
                  snapshots={paginatedData.snapshots}
                  allSnapshots={state.snapshots}
                  loading={state.loading}
                  pagination={pagination}
                  setPagination={setPagination}
                  onPreview={(url) => setUi((prev) => ({ ...prev, previewImage: url }))}
                  onRefresh={fetchData}
                />
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}