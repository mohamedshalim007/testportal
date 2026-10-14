 // client/src/App.jsx
import React, { useState } from "react";
import Login from "./Pages/Login";
import Instructions from "./Pages/Instructions";
import Instruction2 from "./Pages/Instruction2";
import CameraCheck from "./Pages/CameraCheck";
import Exam from "./Pages/Exam";
import Score from "./Pages/Score";
import AdminDashboard from "./Pages/AdminDashboard/AdminDashboard"; // Updated path

export default function App() {
  const [route, setRoute] = useState("login");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const go = (page) => setRoute(page);

  const routes = {
    login: <Login go={go} setUser={setUser} setToken={setToken} />,
    instructions: <Instructions go={go} user={user} token={token} />,
    cameraCheck: <CameraCheck go={go} user={user} token={token} />,
    instruction2: <Instruction2 go={go} user={user} token={token} />,
    exam: <Exam go={go} user={user} token={token} setTestResult={setTestResult} />,
    score: <Score go={go} testResult={testResult} user={user} token={token} />,
    adminDashboard: <AdminDashboard go={go} token={token} />,
  };

  return (
    <div className="app-container">
      {routes[route] || routes.login}
    </div>
  );
}