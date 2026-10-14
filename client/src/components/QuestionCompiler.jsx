// client/src/components/QuestionCompiler.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Editor from "@monaco-editor/react";
import {
  FiPlay,
  FiX,
  FiTerminal,
  FiRefreshCw,
  FiWifi,
  FiWifiOff,
  FiLoader,
  FiSend,
  FiMaximize2,
  FiMinimize2,
  FiCopy,
  FiCheck,
  FiTrash2,
  FiCode,
  FiCpu,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";

// WebSocket URL
const COMPILER_WS_URL = "ws://localhost:5000/compiler-ws";

// Default code for each language
const defaultCodes = {
  python: `# Python Program
name = input("Enter your name: ")
age = int(input("Enter your age: "))
print(f"Hello {name}! You are {age} years old.")`,

  c: `#include <stdio.h>

int main() {
    char name[50];
    int age;
    printf("Enter your name: ");
    scanf("%49s", name);
    printf("Enter your age: ");
    scanf("%d", &age);
    printf("Hello %s! You are %d years old.\\n", name, age);
    return 0;
}`,

  cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    int age;
    cout << "Enter your name: ";
    cin >> name;
    cout << "Enter your age: ";
    cin >> age;
    cout << "Hello " << name << "! You are " << age << " years old." << endl;
    return 0;
}`,

  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = sc.nextLine();
        System.out.print("Enter your age: ");
        int age = sc.nextInt();
        System.out.println("Hello " + name + "! You are " + age + " years old.");
        sc.close();
    }
}`,

  javascript: `// JavaScript Program
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter your name: ', (name) => {
    rl.question('Enter your age: ', (age) => {
        console.log('Hello ' + name + '! You are ' + age + ' years old.');
        rl.close();
    });
});`,
};

const languages = [
  { id: "python", label: "Python", icon: "🐍", color: "#3776AB", bg: "#e8f0fe" },
  { id: "c", label: "C", icon: "⚡", color: "#A8B9CC", bg: "#f0f2f5" },
  { id: "cpp", label: "C++", icon: "⚡", color: "#00599C", bg: "#e6edf5" },
  { id: "java", label: "Java", icon: "☕", color: "#007396", bg: "#e8f0f5" },
  { id: "javascript", label: "JavaScript", icon: "🟡", color: "#F7DF1E", bg: "#fef9e7" },
];

export default function QuestionCompiler({ 
  defaultLanguage = "python",
  readOnly = false,
  onAnswerSubmit,
  questions = [],
}) {
  const [language, setLanguage] = useState(defaultLanguage);
  const [code, setCode] = useState(defaultCodes[defaultLanguage]);
  const [terminal, setTerminal] = useState("");
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [inputBuffer, setInputBuffer] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [editorHeight, setEditorHeight] = useState(350);
  const [copied, setCopied] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [executionTime, setExecutionTime] = useState(null);
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  const wsRef = useRef(null);
  const terminalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const executionStartRef = useRef(null);
  const answerRefs = useRef({});

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    if (!isMountedRef.current) return;

    setIsConnecting(true);

    try {
      console.log('🔄 Connecting to WebSocket:', COMPILER_WS_URL);
      const ws = new WebSocket(COMPILER_WS_URL);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log('⏰ Connection timeout');
          try {
            ws.close();
          } catch (e) {}
          if (isMountedRef.current) {
            addTerminalMessage("❌ Connection timeout. Retrying...", "error");
            setIsConnecting(false);
            setIsConnected(false);
            scheduleReconnect();
          }
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected!');
        if (isMountedRef.current) {
          setIsConnected(true);
          setIsConnecting(false);
          setReconnectAttempts(0);
          addTerminalMessage("✅ Connected to compiler server", "success");
          addTerminalMessage("💡 Ready to run code. Click 'Run' to start.", "info");
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('📨 Received:', msg.type);
          
          if (!isMountedRef.current) return;

          switch (msg.type) {
            case 'output':
              addTerminalMessage(msg.data, "output");
              break;
            case 'error':
              addTerminalMessage(`❌ ${msg.data}`, "error");
              break;
            case 'finished':
              setIsRunning(false);
              setIsWaitingForInput(false);
              setInputPrompt("");
              const status = msg.code === 0 ? '✅ Success' : '❌ Error';
              const elapsed = executionStartRef.current 
                ? ((Date.now() - executionStartRef.current) / 1000).toFixed(2)
                : '?';
              addTerminalMessage(`\n${status} (exit code: ${msg.code})`, msg.code === 0 ? "success" : "error");
              addTerminalMessage(`⏱️ Execution time: ${elapsed}s`, "info");
              setExecutionTime(elapsed);
              executionStartRef.current = null;
              break;
            case 'connection':
              addTerminalMessage(`✅ ${msg.message}`, "success");
              break;
            case 'info':
              addTerminalMessage(`ℹ️ ${msg.data}`, "info");
              break;
            case 'queue':
              addTerminalMessage(`⏳ Queue position: ${msg.position}`, "info");
              break;
            case 'input_required':
              setIsWaitingForInput(true);
              addTerminalMessage(`⏳ Waiting for input...`, "info");
              if (inputRef.current) {
                setTimeout(() => inputRef.current.focus(), 100);
              }
              break;
            default:
              console.log('Unknown message type:', msg.type);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        addTerminalMessage("⚠️ WebSocket error occurred", "error");
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`🔌 WebSocket closed: ${event.code}`);
        if (isMountedRef.current) {
          setIsConnected(false);
          setIsConnecting(false);
          setIsRunning(false);
          setIsWaitingForInput(false);
          setInputPrompt("");
          executionStartRef.current = null;
          
          if (event.code === 1000) {
            addTerminalMessage("🔌 Disconnected from server", "error");
            return;
          }
          
          scheduleReconnect();
        }
      };

    } catch (error) {
      console.error('❌ Connection error:', error);
      if (isMountedRef.current) {
        setIsConnected(false);
        setIsConnecting(false);
        addTerminalMessage(`❌ Connection error: ${error.message}`, "error");
        scheduleReconnect();
      }
    }
  }, []);

  // Add message to terminal with timestamp
  const addTerminalMessage = useCallback((message, type = "output") => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = message;
    
    setTerminal(prev => prev + formattedMessage + '\n');
    setTerminalHistory(prev => [...prev, { 
      id: Date.now(), 
      message: formattedMessage, 
      type, 
      timestamp 
    }]);
  }, []);

  // Schedule reconnect with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (!isMountedRef.current) return;

    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
    setReconnectAttempts(prev => prev + 1);
    console.log(`⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);
    
    addTerminalMessage(`⚠️ Disconnected. Reconnecting in ${(delay/1000).toFixed(1)}s...`, "error");

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        connectWebSocket();
      }
    }, delay);
  }, [connectWebSocket, reconnectAttempts, addTerminalMessage]);

  // Initial connection
  useEffect(() => {
    isMountedRef.current = true;
    addTerminalMessage("🚀 Welcome! Click 'Run' to execute your program here.", "info");
    addTerminalMessage("💡 Type your answers directly in this terminal, right after the prompt.", "info");
    
    const timer = setTimeout(() => {
      connectWebSocket();
    }, 500);

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, "Component unmounting");
        } catch (e) {}
        wsRef.current = null;
      }
      clearTimeout(timer);
    };
  }, [connectWebSocket, addTerminalMessage]);

  // Auto-scroll terminal with smooth behavior
  useEffect(() => {
    if (terminalRef.current) {
      const shouldScroll = terminalRef.current.scrollHeight - terminalRef.current.scrollTop - terminalRef.current.clientHeight < 50;
      if (shouldScroll) {
        terminalRef.current.scrollTo({
          top: terminalRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [terminal]);

  // Update line count
  useEffect(() => {
    setLineCount(code.split('\n').length);
  }, [code]);

  const inputRef = useRef(null);

  // Send input to running process
  const sendInput = useCallback(() => {
    if (!inputBuffer.trim()) return;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "stdin",
        data: inputBuffer + "\n"
      }));
      addTerminalMessage(`📥 ${inputBuffer}`, "input");
      setInputBuffer("");
      setIsWaitingForInput(false);
      setInputPrompt("");
    }
  }, [inputBuffer, addTerminalMessage]);

  // Handle Enter key for input
  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && inputBuffer.trim()) {
      e.preventDefault();
      sendInput();
    }
  };

  // Run code
  const runCode = useCallback(() => {
    if (!isConnected) {
      addTerminalMessage("❌ Not connected. Attempting to reconnect...", "error");
      connectWebSocket();
      return;
    }

    if (isRunning) {
      addTerminalMessage("⚠️ Program is already running...", "info");
      return;
    }

    if (!code || !code.trim()) {
      addTerminalMessage("❌ No code to run.", "error");
      return;
    }

    addTerminalMessage(`▶️ Running ${language} program...`, "info");
    setIsRunning(true);
    setIsWaitingForInput(false);
    setInputPrompt("");
    setInputBuffer("");
    executionStartRef.current = Date.now();

    try {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          language: language,
          code: code,
          input: "",
        }));
      } else {
        addTerminalMessage("❌ WebSocket is not open. Please refresh.", "error");
        setIsRunning(false);
        connectWebSocket();
      }
    } catch (error) {
      addTerminalMessage(`❌ Error: ${error.message}`, "error");
      setIsRunning(false);
    }
  }, [isConnected, isRunning, code, language, connectWebSocket, addTerminalMessage]);

  // Stop execution
  const stopExecution = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    setIsRunning(false);
    setIsWaitingForInput(false);
    setInputPrompt("");
    executionStartRef.current = null;
    addTerminalMessage("⏹️ Stopped by user", "error");
  }, [addTerminalMessage]);

  // Clear terminal
  const clearTerminal = useCallback(() => {
    setTerminal("");
    setTerminalHistory([]);
    if (isConnected) {
      addTerminalMessage("✅ Connected to compiler server", "success");
      addTerminalMessage("💡 Ready to run code. Click 'Run' to start.", "info");
    } else if (isConnecting) {
      addTerminalMessage("🔄 Connecting to compiler server...", "info");
    } else {
      addTerminalMessage("❌ Disconnected from server", "error");
    }
    setInputBuffer("");
    setIsWaitingForInput(false);
    setInputPrompt("");
  }, [isConnected, isConnecting, addTerminalMessage]);

  // Change language
  const changeLanguage = useCallback((langId) => {
    if (isRunning) {
      if (!window.confirm("Stop running program and change language?")) {
        return;
      }
      stopExecution();
    }
    setLanguage(langId);
    setCode(defaultCodes[langId] || defaultCodes.python);
    clearTerminal();
  }, [isRunning, stopExecution, clearTerminal]);

  // Reconnect manually
  const handleReconnect = useCallback(() => {
    setReconnectAttempts(0);
    connectWebSocket();
  }, [connectWebSocket]);

  // Copy code to clipboard
  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  // Format code
  const formatCode = useCallback(() => {
    const formatted = code
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n');
    setCode(formatted);
    addTerminalMessage("✅ Code formatted", "success");
  }, [code, addTerminalMessage]);

  // Toggle terminal size
  const toggleTerminal = useCallback(() => {
    setIsTerminalMaximized(prev => !prev);
  }, []);

  // Handle answer submission
  const handleAnswerSubmit = useCallback((questionId, answer) => {
    setAnsweredQuestions(prev => {
      const exists = prev.find(q => q.id === questionId);
      if (exists) {
        return prev.map(q => q.id === questionId ? { ...q, answer } : q);
      }
      return [...prev, { id: questionId, answer }];
    });
    addTerminalMessage(`✅ Answer submitted for question ${questionId}`, "success");
  }, [addTerminalMessage]);

  // Submit all answers
  const submitAllAnswers = useCallback(() => {
    if (questions.length === 0) {
      addTerminalMessage("ℹ️ No questions to submit", "info");
      return;
    }

    setShowSubmitModal(true);
  }, [questions, addTerminalMessage]);

  const confirmSubmission = useCallback(() => {
    const answered = answeredQuestions.length;
    const total = questions.length;
    
    if (answered < total) {
      addTerminalMessage(`⚠️ Only ${answered}/${total} questions answered`, "error");
      setSubmissionStatus('incomplete');
      return;
    }

    setSubmissionStatus('submitting');
    // Simulate submission
    setTimeout(() => {
      setSubmissionStatus('success');
      addTerminalMessage(`✅ All ${total} answers submitted successfully!`, "success");
      if (onAnswerSubmit) {
        onAnswerSubmit(answeredQuestions);
      }
    }, 1500);
  }, [answeredQuestions, questions, onAnswerSubmit, addTerminalMessage]);

  // Get terminal message color
  const getMessageColor = useCallback((type) => {
    switch (type) {
      case 'error': return '#f87171';
      case 'success': return '#34d399';
      case 'info': return '#60a5fa';
      case 'input': return '#fbbf24';
      default: return '#e2e8f0';
    }
  }, []);

  // Get current language color
  const currentLangColor = useMemo(() => 
    languages.find(l => l.id === language)?.color || '#3758f9',
    [language]
  );

  return (
    <div style={{
      marginTop: 18,
      padding: 24,
      borderRadius: 16,
      border: "1px solid #1e293b",
      background: "#0f172a",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      transition: "all 0.3s ease",
      maxWidth: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <div style={{ 
            fontWeight: 700, 
            fontSize: 18, 
            display: "flex", 
            alignItems: "center", 
            gap: 10,
            color: '#f1f5f9'
          }}>
            <span style={{ 
              background: currentLangColor,
              padding: '6px 10px',
              borderRadius: 8,
              color: 'white',
              fontSize: 14
            }}>
              {languages.find(l => l.id === language)?.icon || '🖥️'}
            </span>
            <span style={{ color: '#e2e8f0' }}>Online Compiler</span>
            {isConnecting ? (
              <span style={{ 
                fontSize: 11, 
                color: "#f59e0b", 
                display: "flex", 
                alignItems: "center", 
                gap: 4,
                background: '#fef3c7',
                padding: '2px 10px',
                borderRadius: 12,
              }}>
                <FiLoader size={12} style={{ animation: "spin 1s linear infinite" }} />
                Connecting...
              </span>
            ) : isConnected ? (
              <span style={{ 
                fontSize: 11, 
                color: "#10b981", 
                display: "flex", 
                alignItems: "center", 
                gap: 4,
                background: '#d1fae5',
                padding: '2px 10px',
                borderRadius: 12,
              }}>
                <FiWifi size={12} />
                Connected
              </span>
            ) : (
              <span style={{ 
                fontSize: 11, 
                color: "#ef4444", 
                display: "flex", 
                alignItems: "center", 
                gap: 4,
                background: '#fee2e2',
                padding: '2px 10px',
                borderRadius: 12,
              }}>
                <FiWifiOff size={12} />
                Disconnected
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Python • C • C++ • Java • JavaScript
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={copyCode}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#94a3b8",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            {copied ? <FiCheck size={16} color="#10b981" /> : <FiCopy size={16} />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={formatCode}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#94a3b8",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <FiRefreshCw size={16} />
            Format
          </button>
          <button
            onClick={runCode}
            disabled={isRunning || !isConnected}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: isRunning || !isConnected ? "#334155" : "#3758f9",
              color: "white",
              cursor: isRunning || !isConnected ? "not-allowed" : "pointer",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s",
              boxShadow: isRunning || !isConnected ? "none" : "0 4px 12px rgba(55, 88, 249, 0.3)",
            }}
          >
            {isRunning ? (
              <>
                <FiRefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                Running...
              </>
            ) : (
              <>
                <FiPlay size={16} />
                Run
              </>
            )}
          </button>
          {isRunning && (
            <button
              onClick={stopExecution}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#ef4444",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#dc2626"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#ef4444"}
            >
              <FiX size={16} />
              Stop
            </button>
          )}
          {!isConnected && !isConnecting && (
            <button
              onClick={handleReconnect}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#f59e0b",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FiRefreshCw size={16} />
              Reconnect
            </button>
          )}
        </div>
      </div>

      {/* Language Buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {languages.map((lang) => (
          <button
            key={lang.id}
            onClick={() => changeLanguage(lang.id)}
            disabled={isRunning}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: language === lang.id ? 600 : 400,
              background: language === lang.id ? lang.color : "#1e293b",
              color: language === lang.id ? "#ffffff" : "#94a3b8",
              border: language === lang.id ? "none" : "1px solid #334155",
              cursor: isRunning ? "not-allowed" : "pointer",
              opacity: isRunning ? 0.6 : 1,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 4,
              boxShadow: language === lang.id ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
            }}
            onMouseEnter={(e) => {
              if (!isRunning && language !== lang.id) {
                e.currentTarget.style.background = "#334155";
              }
            }}
            onMouseLeave={(e) => {
              if (!isRunning && language !== lang.id) {
                e.currentTarget.style.background = "#1e293b";
              }
            }}
          >
            {lang.icon} {lang.label}
          </button>
        ))}
        <span style={{ 
          marginLeft: 'auto', 
          fontSize: 12, 
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}>
          <FiCode size={14} />
          {lineCount} lines
        </span>
      </div>

      {/* Editor */}
      <div style={{
        border: "1px solid #1e293b",
        borderRadius: 10,
        overflow: "hidden",
        height: isTerminalMaximized ? `${editorHeight * 0.4}px` : `${editorHeight}px`,
        transition: "height 0.3s ease",
        position: "relative",
      }}>
        <Editor
          height="100%"
          theme="vs-dark"
          language={language === "cpp" ? "cpp" : language}
          value={code}
          onChange={(value) => setCode(value || "")}
          options={{
            fontSize: 14,
            minimap: { 
              enabled: true,
              maxColumn: 80,
              showSlider: 'mouseover',
            },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: "on",
            readOnly: readOnly,
            tabSize: 2,
            insertSpaces: true,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            renderWhitespace: "selection",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      {/* Terminal Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <FiTerminal size={16} color="#64748b" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Terminal</span>
          {isRunning && (
            <span style={{ 
              fontSize: 11, 
              color: "#f59e0b", 
              background: '#fef3c7',
              padding: '2px 10px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <FiRefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />
              Executing...
            </span>
          )}
          {isWaitingForInput && (
            <span style={{ 
              fontSize: 11, 
              color: "#f59e0b", 
              background: '#fef3c7',
              padding: '2px 10px',
              borderRadius: 12,
              animation: "pulse 1s infinite"
            }}>
              ⏳ Waiting for input...
            </span>
          )}
          {executionTime && !isRunning && (
            <span style={{ 
              fontSize: 11, 
              color: "#60a5fa", 
              background: '#1e293b',
              padding: '2px 10px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <FiClock size={12} />
              {executionTime}s
            </span>
          )}
          {!isConnected && !isConnecting && (
            <span style={{ 
              fontSize: 11, 
              color: "#ef4444", 
              background: '#fee2e2',
              padding: '2px 10px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <FiWifiOff size={12} />
              Disconnected
            </span>
          )}
          {questions.length > 0 && (
            <span style={{ 
              fontSize: 11, 
              color: "#34d399", 
              background: '#d1fae5',
              padding: '2px 10px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <FiCheckCircle size={12} />
              Answered: {answeredQuestions.length} / {questions.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={clearTerminal}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #334155",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "#94a3b8",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <FiTrash2 size={14} />
            Clear
          </button>
          <button
            onClick={toggleTerminal}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #334155",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "#94a3b8",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            {isTerminalMaximized ? (
              <>
                <FiMinimize2 size={14} />
                Shrink
              </>
            ) : (
              <>
                <FiMaximize2 size={14} />
                Expand
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div style={{
        border: "1px solid #1e293b",
        borderRadius: 10,
        overflow: "hidden",
        background: "#0a0f1a",
        height: isTerminalMaximized ? "400px" : "180px",
        transition: "height 0.3s ease",
      }}>
        <div style={{
          padding: "8px 14px",
          background: "#1a2332",
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid #2a3a5a",
        }}>
          <FiTerminal size={14} />
          <span style={{ color: '#e2e8f0' }}>Output</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>
            {terminalHistory.length} messages
          </span>
        </div>
        <div
          ref={terminalRef}
          style={{
            height: "calc(100% - 37px)",
            overflowY: "auto",
            background: "#0a0f1a",
            color: "#e2e8f0",
            padding: "12px 16px",
            margin: 0,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            scrollbarWidth: "thin",
            scrollbarColor: "#2a3a5a transparent",
          }}
        >
          {terminal.split('\n').map((line, index) => {
            if (!line.trim()) return <div key={index}>&nbsp;</div>;
            // Check if line contains emoji indicators
            const isError = line.includes('❌') || line.includes('⚠️') || line.includes('🔌');
            const isSuccess = line.includes('✅') || line.includes('🎉');
            const isInfo = line.includes('ℹ️') || line.includes('💡') || line.includes('📥');
            const color = isError ? '#f87171' : isSuccess ? '#34d399' : isInfo ? '#60a5fa' : '#e2e8f0';
            
            return (
              <div key={index} style={{ color }}>
                {line}
              </div>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div style={{
        marginTop: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: '4px 0',
      }}>
        <span style={{ 
          fontSize: 13, 
          fontWeight: 600, 
          color: "#94a3b8",
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          ⌨️ Input:
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputBuffer}
          onChange={(e) => setInputBuffer(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={isRunning ? (isWaitingForInput ? "Type input and press Enter..." : "Program running...") : "Run the program first..."}
          disabled={!isRunning}
          style={{
            flex: 1,
            padding: "8px 14px",
            borderRadius: 8,
            border: `2px solid ${isRunning ? (isWaitingForInput ? "#f59e0b" : "#3758f9") : "#1e293b"}`,
            fontSize: 14,
            background: isRunning ? "#1e293b" : "#0f172a",
            color: '#e2e8f0',
            outline: "none",
            transition: "all 0.2s",
            boxShadow: isWaitingForInput ? "0 0 0 3px rgba(245, 158, 11, 0.15)" : "none",
          }}
        />
        <button
          onClick={sendInput}
          disabled={!isRunning || !inputBuffer.trim()}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            border: "none",
            background: isRunning && inputBuffer.trim() ? "#3758f9" : "#1e293b",
            color: isRunning && inputBuffer.trim() ? "white" : "#475569",
            cursor: isRunning && inputBuffer.trim() ? "pointer" : "not-allowed",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.2s",
            boxShadow: isRunning && inputBuffer.trim() ? "0 4px 12px rgba(55, 88, 249, 0.3)" : "none",
          }}
        >
          <FiSend size={14} />
          Send
        </button>
        {questions.length > 0 && (
          <button
            onClick={submitAllAnswers}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: "#10b981",
              color: "white",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#059669"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#10b981"}
          >
            <FiCheckCircle size={14} />
            Submit Answers
          </button>
        )}
      </div>

      {/* Submission Modal */}
      {showSubmitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
        }} onClick={() => setShowSubmitModal(false)}>
          <div style={{
            background: '#1a2332',
            borderRadius: 16,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            border: '1px solid #2a3a5a',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#e2e8f0', marginBottom: 16 }}>
              {submissionStatus === 'success' ? '✅ Submission Successful!' : 
               submissionStatus === 'submitting' ? '⏳ Submitting...' : 
               '📝 Submit Answers'}
            </h3>
            
            {submissionStatus === 'success' ? (
              <div>
                <p style={{ color: '#94a3b8', marginBottom: 20 }}>
                  All {questions.length} answers have been submitted successfully.
                </p>
                <button
                  onClick={() => {
                    setShowSubmitModal(false);
                    setSubmissionStatus(null);
                  }}
                  style={{
                    padding: "8px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: "#3758f9",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Close
                </button>
              </div>
            ) : submissionStatus === 'submitting' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <FiLoader size={48} style={{ animation: 'spin 1s linear infinite', color: '#3758f9' }} />
                <p style={{ color: '#94a3b8', marginTop: 16 }}>Submitting your answers...</p>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ color: '#94a3b8', marginBottom: 8 }}>
                    You have answered {answeredQuestions.length} out of {questions.length} questions.
                  </p>
                  {answeredQuestions.length < questions.length && (
                    <p style={{ color: '#f59e0b', fontSize: 13 }}>
                      ⚠️ {questions.length - answeredQuestions.length} question(s) remaining
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setShowSubmitModal(false);
                      setSubmissionStatus(null);
                    }}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 8,
                      border: "1px solid #334155",
                      background: "transparent",
                      color: "#94a3b8",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSubmission}
                    disabled={answeredQuestions.length === 0}
                    style={{
                      padding: "8px 24px",
                      borderRadius: 8,
                      border: "none",
                      background: answeredQuestions.length === 0 ? "#334155" : "#10b981",
                      color: answeredQuestions.length === 0 ? "#475569" : "white",
                      cursor: answeredQuestions.length === 0 ? "not-allowed" : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {answeredQuestions.length === 0 ? 'No Answers' : 'Submit All'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        /* Custom scrollbar for terminal */
        pre::-webkit-scrollbar,
        div[ref="${terminalRef}"]::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        pre::-webkit-scrollbar-track,
        div[ref="${terminalRef}"]::-webkit-scrollbar-track {
          background: transparent;
        }
        pre::-webkit-scrollbar-thumb,
        div[ref="${terminalRef}"]::-webkit-scrollbar-thumb {
          background: #2a3a5a;
          border-radius: 4px;
        }
        pre::-webkit-scrollbar-thumb:hover,
        div[ref="${terminalRef}"]::-webkit-scrollbar-thumb:hover {
          background: #3a4a6a;
        }
        /* Focus styles */
        input:focus {
          border-color: #3758f9 !important;
          box-shadow: 0 0 0 3px rgba(55, 88, 249, 0.15) !important;
        }
        /* Smooth scrolling */
        * {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}