// client/src/pages/AdminDashboard/components/StatsCards.jsx
import React from "react";
import { FaUniversity, FaUserGraduate, FaQuestionCircle, FaClipboardList } from "react-icons/fa";
import { FiLayers, FiCamera } from "react-icons/fi";

export default function StatsCards({
  departments,
  patterns,
  students,
  questions,
  submissions,
  snapshots,
}) {
  const stats = [
    { label: "Departments", count: departments, icon: <FaUniversity />, color: "#e3f2fd", iconColor: "#1976d2" },
    { label: "Patterns", count: patterns, icon: <FiLayers />, color: "#e8f5e9", iconColor: "#388e3c" },
    { label: "Students", count: students, icon: <FaUserGraduate />, color: "#fff3e0", iconColor: "#f57c00" },
    { label: "Questions", count: questions, icon: <FaQuestionCircle />, color: "#f3e5f5", iconColor: "#7b1fa2" },
    { label: "Submissions", count: submissions, icon: <FaClipboardList />, color: "#e0f7fa", iconColor: "#00838f" },
    { label: "Snapshots", count: snapshots, icon: <FiCamera />, color: "#fce4ec", iconColor: "#c62828" },
  ];

  return (
    <div className="stats-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card" style={{ background: stat.color }}>
          <div className="stat-icon" style={{ color: stat.iconColor }}>{stat.icon}</div>
          <div className="stat-label">{stat.label}</div>
          <div className="stat-count">{stat.count}</div>
        </div>
      ))}
    </div>
  );
}