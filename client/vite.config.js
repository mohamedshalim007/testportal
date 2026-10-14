import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    base: './',
  plugins: [react()],
})



// Student opens

// https://exam.jmc.edu

//         │

// React Website

//         │

// Fetch("http://localhost:5001/run")

//         │

// Local Compiler Service
// (Installed once on every lab PC)

//         │

// child_process.spawn()

//         │

// Python
// GCC
// Java
// Node

//         │

// Output

//         │

// Back to Browser


//questioncompiler.js
 // client/src/components/QuestionCompiler.jsx
// import React, { useState, useRef, useEffect, useCallback } from "react";
// import Editor from "@monaco-editor/react";
// import {
//   FiPlay,
//   FiX,
//   FiTerminal,
//   FiRefreshCw,
//   FiWifi,
//   FiWifiOff,
// } from "react-icons/fi";

// const defaultCodes = {
//   python: `# Python Program
// print("Hello World!")
// name = input("Enter your name: ")
// print(f"Hello {name}!")`,

//   c: `#include <stdio.h>

// int main() {
//     printf("Hello World!\\n");
//     return 0;
// }`,

//   cpp: `#include <iostream>
// using namespace std;

// int main() {
//     cout << "Hello World!" << endl;
//     return 0;
// }`,

//   java: `public class Main {
//     public static void main(String[] args) {
//         System.out.println("Hello World!");
//     }
// }`,

//   javascript: `// JavaScript Program
// console.log("Hello World!");`,
// };

// const languages = [
//   { id: "python", label: "Python", icon: "🐍" },
//   { id: "c", label: "C", icon: "⚡" },
//   { id: "cpp", label: "C++", icon: "⚡" },
//   { id: "java", label: "Java", icon: "☕" },
//   { id: "javascript", label: "JavaScript", icon: "🟡" },
// ];

// function makeRequestId() {
//   return Date.now().toString(36) + Math.random().toString(36).slice(2);
// }

// export default function QuestionCompiler({
//   defaultLanguage = "python",
//   readOnly = false,
// }) {
//   const [language, setLanguage] = useState(defaultLanguage);
//   const [code, setCode] = useState(defaultCodes[defaultLanguage]);
//   const [terminal, setTerminal] = useState("");
//   const [inputBuffer, setInputBuffer] = useState("");
//   const [isRunning, setIsRunning] = useState(false);

//   const isElectron = typeof window !== "undefined" && !!window.electronAPI;
//   const currentRequestId = useRef(null);
//   const terminalRef = useRef(null);
//   const unsubscribeRef = useRef(null);

//   // Set up the output listener once
//   useEffect(() => {
//     if (!isElectron) {
//       setTerminal(
//         "❌ Local compiler is only available in the desktop app.\nPlease run this test using the installed application, not a web browser."
//       );
//       return;
//     }

//     setTerminal("✅ Local compiler ready.\nClick 'Run' to execute your code on this computer.");

//     unsubscribeRef.current = window.electronAPI.onOutput(({ requestId, type, data }) => {
//       // Ignore stale output from a previous run
//       if (requestId !== currentRequestId.current) return;

//       if (type === "output") {
//         setTerminal((prev) => prev + data);
//       } else if (type === "error") {
//         setTerminal((prev) => prev + `❌ ${data}`);
//       } else if (type === "info") {
//         setTerminal((prev) => prev + `ℹ️ ${data}`);
//       } else if (type === "finished") {
//         setIsRunning(false);
//         const code = data?.code;
//         const status = code === 0 ? "✅ Success" : "❌ Error";
//         setTerminal((prev) => prev + `\n${status} (exit code: ${code})\n`);
//       }
//     });

//     return () => {
//       if (unsubscribeRef.current) unsubscribeRef.current();
//     };
//   }, [isElectron]);

//   // Auto-scroll terminal
//   useEffect(() => {
//     if (terminalRef.current) {
//       terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
//     }
//   }, [terminal]);

//   const runCode = () => {
//     if (!isElectron) {
//       setTerminal("❌ Local compiler is only available in the desktop app.");
//       return;
//     }

//     if (isRunning) {
//       setTerminal((prev) => prev + "\n⚠️ Program is already running...\n");
//       return;
//     }

//     if (!code || !code.trim()) {
//       setTerminal("❌ No code to run.");
//       return;
//     }

//     const requestId = makeRequestId();
//     currentRequestId.current = requestId;

//     setTerminal(`▶️ Running ${language} program...\n`);
//     setIsRunning(true);

//     window.electronAPI.runCode({
//       requestId,
//       language,
//       code,
//       input: inputBuffer || "",
//     });
//   };

//   const stopExecution = () => {
//     if (!isElectron || !currentRequestId.current) return;
//     window.electronAPI.stopExecution({ requestId: currentRequestId.current });
//     setIsRunning(false);
//   };

//   const clearTerminal = () => {
//     setTerminal(
//       isElectron
//         ? "✅ Local compiler ready.\nClick 'Run' to execute your code on this computer."
//         : "❌ Local compiler is only available in the desktop app."
//     );
//     setInputBuffer("");
//   };

//   const sendInput = () => {
//     if (isRunning && isElectron && currentRequestId.current) {
//       window.electronAPI.sendInput({
//         requestId: currentRequestId.current,
//         data: inputBuffer + "\n",
//       });
//       setTerminal((prev) => prev + inputBuffer + "\n");
//       setInputBuffer("");
//     }
//   };

//   const handleKeyDown = (e) => {
//     if (e.key === "Enter") {
//       sendInput();
//     }
//   };

//   const changeLanguage = (langId) => {
//     if (isRunning) {
//       if (!confirm("Stop running program and change language?")) {
//         return;
//       }
//       stopExecution();
//     }
//     setLanguage(langId);
//     setCode(defaultCodes[langId] || defaultCodes.python);
//     clearTerminal();
//   };

//   return (
//     <div style={{
//       marginTop: 18,
//       padding: 20,
//       borderRadius: 12,
//       border: "1px solid #d0d7e9",
//       background: "#ffffff",
//       boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
//     }}>
//       {/* Header */}
//       <div style={{
//         display: "flex",
//         justifyContent: "space-between",
//         alignItems: "center",
//         marginBottom: 12,
//         flexWrap: "wrap",
//         gap: 8,
//       }}>
//         <div>
//           <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
//             🖥️ Local Compiler
//             {isElectron ? (
//               <span style={{ fontSize: 11, color: "#28a745", display: "flex", alignItems: "center", gap: 4 }}>
//                 <FiWifi size={12} />
//                 Ready
//               </span>
//             ) : (
//               <span style={{ fontSize: 11, color: "#dc3545", display: "flex", alignItems: "center", gap: 4 }}>
//                 <FiWifiOff size={12} />
//                 Desktop app required
//               </span>
//             )}
//           </div>
//           <div style={{ fontSize: 12, color: "#6b7280" }}>
//             Python • C • C++ • Java • JavaScript — runs on your own PC
//           </div>
//         </div>
//         <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
//           <button
//             onClick={runCode}
//             disabled={isRunning || !isElectron}
//             style={{
//               padding: "8px 16px",
//               borderRadius: 8,
//               border: "none",
//               background: isRunning || !isElectron ? "#ccc" : "#3758f9",
//               color: "white",
//               cursor: isRunning || !isElectron ? "not-allowed" : "pointer",
//               fontWeight: 600,
//               display: "flex",
//               alignItems: "center",
//               gap: 6,
//             }}
//           >
//             {isRunning ? (
//               <>
//                 <FiRefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
//                 Running...
//               </>
//             ) : (
//               <>
//                 <FiPlay size={16} />
//                 Run
//               </>
//             )}
//           </button>
//           {isRunning && (
//             <button
//               onClick={stopExecution}
//               style={{
//                 padding: "8px 16px",
//                 borderRadius: 8,
//                 border: "none",
//                 background: "#dc3545",
//                 color: "white",
//                 cursor: "pointer",
//                 fontWeight: 600,
//                 display: "flex",
//                 alignItems: "center",
//                 gap: 6,
//               }}
//             >
//               <FiX size={16} />
//               Stop
//             </button>
//           )}
//           <button
//             onClick={clearTerminal}
//             style={{
//               padding: "8px 16px",
//               borderRadius: 8,
//               border: "1px solid #d0d7e8",
//               background: "transparent",
//               cursor: "pointer",
//               display: "flex",
//               alignItems: "center",
//               gap: 6,
//             }}
//           >
//             <FiTerminal size={16} />
//             Clear
//           </button>
//         </div>
//       </div>

//       {/* Language Buttons */}
//       <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
//         {languages.map((lang) => (
//           <button
//             key={lang.id}
//             onClick={() => changeLanguage(lang.id)}
//             disabled={isRunning}
//             style={{
//               padding: "6px 14px",
//               borderRadius: 8,
//               fontSize: 13,
//               fontWeight: language === lang.id ? 600 : 400,
//               background: language === lang.id ? "#3758f9" : "#f0f4ff",
//               color: language === lang.id ? "#ffffff" : "#3758f9",
//               border: language === lang.id ? "none" : "1px solid #d0d7e8",
//               cursor: isRunning ? "not-allowed" : "pointer",
//               opacity: isRunning ? 0.6 : 1,
//             }}
//           >
//             {lang.icon} {lang.label}
//           </button>
//         ))}
//       </div>

//       {/* Editor */}
//       <div style={{
//         border: "1px solid #e5e7eb",
//         borderRadius: 8,
//         overflow: "hidden",
//         height: "320px",
//       }}>
//         <Editor
//           height="100%"
//           theme="vs-dark"
//           language={language === "cpp" ? "cpp" : language}
//           value={code}
//           onChange={(value) => setCode(value || "")}
//           options={{
//             fontSize: 14,
//             minimap: { enabled: false },
//             scrollBeyondLastLine: false,
//             automaticLayout: true,
//             lineNumbers: "on",
//             readOnly: readOnly,
//           }}
//         />
//       </div>

//       {/* Terminal */}
//       <div style={{
//         marginTop: 12,
//         border: "1px solid #e5e7eb",
//         borderRadius: 8,
//         overflow: "hidden",
//         background: "#1a1a2e",
//         height: "180px",
//       }}>
//         <div style={{
//           padding: "6px 12px",
//           background: "#16213e",
//           color: "#8899bb",
//           fontSize: 12,
//           fontWeight: 600,
//           display: "flex",
//           alignItems: "center",
//           gap: 8,
//           borderBottom: "1px solid #2a3a5a",
//         }}>
//           <FiTerminal size={14} />
//           Output
//           {isRunning && (
//             <span style={{ marginLeft: "auto", fontSize: 11, color: "#fbbf24" }}>
//               <FiRefreshCw size={12} style={{ animation: "spin 1s linear infinite", marginRight: 4 }} />
//               Executing...
//             </span>
//           )}
//         </div>
//         <pre
//           ref={terminalRef}
//           style={{
//             height: "calc(100% - 35px)",
//             overflowY: "auto",
//             background: "#0d1117",
//             color: "#e6edf3",
//             padding: "12px 16px",
//             margin: 0,
//             fontSize: 13,
//             fontFamily: "'JetBrains Mono', monospace",
//             lineHeight: 1.6,
//             whiteSpace: "pre-wrap",
//             wordBreak: "break-word",
//           }}
//         >
//           {terminal}
//         </pre>
//       </div>

//       {/* Input */}
//       <div style={{
//         marginTop: 10,
//         display: "flex",
//         gap: 8,
//         alignItems: "center",
//       }}>
//         <span style={{ fontSize: 13, fontWeight: 600, color: "#4a5c80" }}>
//           ⌨️ Input:
//         </span>
//         <input
//           type="text"
//           value={inputBuffer}
//           onChange={(e) => setInputBuffer(e.target.value)}
//           onKeyDown={handleKeyDown}
//           placeholder={isRunning ? "Type input and press Enter..." : "Run the program first..."}
//           disabled={!isRunning}
//           style={{
//             flex: 1,
//             padding: "8px 12px",
//             borderRadius: 6,
//             border: `1px solid ${isRunning ? "#3758f9" : "#d0d7e8"}`,
//             fontSize: 14,
//             background: isRunning ? "#ffffff" : "#f5f7fa",
//             outline: "none",
//             transition: "border-color 0.2s",
//           }}
//         />
//         {isRunning && (
//           <button
//             onClick={sendInput}
//             style={{
//               padding: "6px 16px",
//               borderRadius: 6,
//               border: "none",
//               background: "#3758f9",
//               color: "white",
//               cursor: "pointer",
//               fontSize: 13,
//               fontWeight: 600,
//             }}
//           >
//             Send
//           </button>
//         )}
//       </div>

//       <style>{`
//         @keyframes spin {
//           from { transform: rotate(0deg); }
//           to { transform: rotate(360deg); }
//         }
//       `}</style>
//     </div>
//   );
// }