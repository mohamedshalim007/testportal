// client/src/components/RealTerminal.jsx
import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

const COMPILER_WS_URL = import.meta.env.VITE_COMPILER_WS_URL || "ws://localhost:5000/compiler-ws";
const COMPILER_HTTP_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const DEFAULT_CODES = {
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

const LANGUAGES = [
  { id: "python", label: "Python", icon: "🐍", color: "#3776AB" },
  { id: "c", label: "C", icon: "⚡", color: "#A8B9CC" },
  { id: "cpp", label: "C++", icon: "⚡", color: "#00599C" },
  { id: "java", label: "Java", icon: "☕", color: "#007396" },
  { id: "javascript", label: "JavaScript", icon: "🟡", color: "#F7DF1E" },
];

export default function RealTerminal({ defaultLanguage = "python", onCompilerStatusChange, sessionId }) {
  const [language, setLanguage] = useState(defaultLanguage);
  const [code, setCode] = useState(DEFAULT_CODES[defaultLanguage] || DEFAULT_CODES.python);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState("Checking compiler...");
  const [isExpanded, setIsExpanded] = useState(false);
  const [lineCount, setLineCount] = useState(0);

  const wsRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const containerRef = useRef(null);
  const retryTimerRef = useRef(null);

  // Update line count
  useEffect(() => {
    setLineCount(code.split('\n').length);
  }, [code]);

  // ---- init xterm once ----
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: "#e6edf3",
        selection: "#264f78",
        black: "#0d1117",
        red: "#f85149",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39d2c0",
        white: "#e6edf3",
      },
      convertEol: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    
    // Small delay to ensure DOM is ready
    setTimeout(() => fit.fit(), 50);

    termRef.current = term;
    fitRef.current = fit;

    term.writeln("\x1b[1;36m╔═══════════════════════════════════════════╗\x1b[0m");
    term.writeln("\x1b[1;36m║  🚀 Welcome to the Interactive Terminal   ║\x1b[0m");
    term.writeln("\x1b[1;36m╚═══════════════════════════════════════════╝\x1b[0m");
    term.writeln("");
    term.writeln("\x1b[32m▶ Click \"Run\" to execute your program here.\x1b[0m");
    term.writeln("\x1b[36m💡 Type your answers directly in this terminal.\x1b[0m");
    term.writeln("");

    // Forward every keystroke straight to the running process.
    term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "stdin", data }));
      }
    });

    const handleResize = () => {
      try {
        fit.fit();
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      } catch (e) {
        // Ignore resize errors
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      try {
        term.dispose();
      } catch (e) {}
    };
  }, []);

  // ---- connect / reconnect websocket ----
  const connect = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    const token = localStorage.getItem("token") || "";
    if (!token || !sessionId) {
      setStatusText("Exam session required");
      setIsConnected(false);
      if (onCompilerStatusChange) onCompilerStatusChange(false);
      return;
    }

    setStatusText("Connecting...");
    const wsUrl = `${COMPILER_WS_URL}?token=${encodeURIComponent(token)}&session_id=${encodeURIComponent(sessionId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setStatusText("Connected");
      if (onCompilerStatusChange) onCompilerStatusChange(true);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      const term = termRef.current;
      if (term) {
        term.writeln("\x1b[32m✅ Connected to compiler server\x1b[0m");
      }
    };

    ws.onmessage = (event) => {
      const term = termRef.current;
      if (!term) return;
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "output":
          term.write(msg.data);
          break;
        case "error":
          term.write(`\x1b[31m${msg.data}\x1b[0m\r\n`);
          break;
        case "info":
          term.write(`\x1b[36m${msg.data}\x1b[0m\r\n`);
          break;
        case "queued":
          term.write(`\x1b[33m⏳ Queued (position ${msg.position})...\x1b[0m\r\n`);
          break;
        case "finished":
          const statusIcon = msg.code === 0 ? "✅" : "❌";
          const statusColor = msg.code === 0 ? "32" : "31";
          term.write(
            `\r\n\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n`,
          );
          term.write(
            `\x1b[${statusColor}m${statusIcon} Process exited with code ${msg.code}\x1b[0m\r\n`,
          );
          term.write(
            `\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\r\n`,
          );
          setIsRunning(false);
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsRunning(false);
      setStatusText("Disconnected - retrying...");
      if (onCompilerStatusChange) onCompilerStatusChange(false);
      const term = termRef.current;
      if (term) {
        term.writeln("\x1b[31m❌ Disconnected from server\x1b[0m");
      }
      retryTimerRef.current = setTimeout(checkAndConnect, 4000);
    };

    ws.onerror = () => {
      // onclose will fire right after; retry handled there
    };
  };

  const checkAndConnect = async () => {
    try {
      const res = await fetch(`${COMPILER_HTTP_URL}/health`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        connect();
        return;
      }
    } catch (e) {}
    setIsConnected(false);
    setStatusText("Compiler server not reachable");
    const term = termRef.current;
    if (term) {
      term.writeln("\x1b[31m⚠️ Compiler server not reachable\x1b[0m");
    }
    retryTimerRef.current = setTimeout(checkAndConnect, 4000);
  };

  useEffect(() => {
    checkAndConnect();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
      }
    };
  }, [sessionId]);

  const runCode = () => {
    if (!isConnected || !wsRef.current) {
      setStatusText("Not connected - retrying...");
      checkAndConnect();
      return;
    }
    if (isRunning) return;
    if (!code.trim()) {
      const term = termRef.current;
      if (term) {
        term.writeln("\x1b[31m⚠️ No code to run\x1b[0m");
      }
      return;
    }

    const term = termRef.current;
    if (term) {
      term.clear();
      term.writeln(`\x1b[32m┌─────────────────────────────────────────┐\x1b[0m`);
      term.writeln(`\x1b[32m│ ▶ Running ${language.toUpperCase()}...\x1b[0m`);
      term.writeln(`\x1b[32m└─────────────────────────────────────────┘\x1b[0m`);
      term.writeln("");
    }
    setIsRunning(true);

    wsRef.current.send(JSON.stringify({ language, code }));
  };

  const stopCode = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    const term = termRef.current;
    if (term) {
      term.writeln("\x1b[33m⏹️ Stopped by user\x1b[0m");
    }
    setIsRunning(false);
  };

  const handleLanguageChange = (langId) => {
    if (isRunning) {
      if (!window.confirm("Stop running program and change language?")) return;
      stopCode();
    }
    setLanguage(langId);
    setCode(DEFAULT_CODES[langId] || DEFAULT_CODES.python);
    const term = termRef.current;
    if (term) {
      term.clear();
      term.writeln(`\x1b[36m🔄 Switched to ${langId.toUpperCase()}\x1b[0m`);
      term.writeln(`\x1b[36m💡 Click "Run" to execute your program.\x1b[0m`);
    }
  };

  const clearTerminal = () => {
    const term = termRef.current;
    if (term) {
      term.clear();
      term.writeln("\x1b[36m🧹 Terminal cleared\x1b[0m");
      if (!isRunning) {
        term.writeln("\x1b[36m💡 Click \"Run\" to execute your program.\x1b[0m");
      }
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    setTimeout(() => {
      try {
        if (fitRef.current && termRef.current) {
          fitRef.current.fit();
        }
      } catch (e) {}
    }, 100);
  };

  const getCurrentLangColor = LANGUAGES.find(l => l.id === language)?.color || "#89b4fa";

  return (
    <div
      style={{
        backgroundColor: "#1e1e2e",
        color: "#cdd6f4",
        padding: 24,
        borderRadius: 16,
        border: "1px solid #313244",
        marginTop: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        transition: "all 0.3s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: `linear-gradient(135deg, ${getCurrentLangColor}22, transparent)`,
              padding: "6px 14px",
              borderRadius: 10,
            }}
          >
            <span style={{ fontSize: 22 }}>
              {LANGUAGES.find(l => l.id === language)?.icon || "💻"}
            </span>
            <h3 style={{ margin: 0, color: "#89b4fa", fontSize: 18, fontWeight: 700 }}>
              Compiler Terminal
            </h3>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: isConnected ? "#1a3a2a" : "#3a1a1a",
              color: isConnected ? "#a6e3a1" : "#f38ba8",
              border: `1px solid ${isConnected ? "#2a5a3a" : "#5a2a2a"}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isConnected ? "#a6e3a1" : "#f38ba8",
                display: "inline-block",
                animation: isConnected ? "none" : "pulse 1.5s ease-in-out infinite",
              }}
            />
            {statusText}
          </div>
          {isRunning && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: "#2a2a1a",
                color: "#d29922",
                border: "1px solid #4a4a2a",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#d29922",
                  display: "inline-block",
                  animation: "pulse 0.8s ease-in-out infinite",
                }}
              />
              Running...
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => handleLanguageChange(l.id)}
              disabled={isRunning}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: language === l.id ? 600 : 400,
                background: language === l.id ? l.color : "transparent",
                color: language === l.id ? "#ffffff" : "#9399b2",
                border: language === l.id ? "none" : "1px solid #313244",
                cursor: isRunning ? "not-allowed" : "pointer",
                opacity: isRunning ? 0.5 : 1,
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onMouseEnter={(e) => {
                if (!isRunning && language !== l.id) {
                  e.currentTarget.style.background = "#313244";
                }
              }}
              onMouseLeave={(e) => {
                if (!isRunning && language !== l.id) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {l.icon} {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Code Editor */}
      <div
        style={{
          position: "relative",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #313244",
          background: "#11111b",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            background: "#1a1a2e",
            borderBottom: "1px solid #313244",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14 }}>📝</span>
            <span style={{ fontSize: 13, color: "#6c7086", fontWeight: 500 }}>
              {language.toUpperCase()} • {lineCount} lines
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => {
                const textarea = document.getElementById("code-editor");
                if (textarea) textarea.focus();
              }}
              style={{
                padding: "2px 10px",
                borderRadius: 4,
                border: "none",
                background: "#313244",
                color: "#cdd6f4",
                fontSize: 11,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#45475a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#313244")}
            >
              Edit
            </button>
          </div>
        </div>
        <textarea
          id="code-editor"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck="false"
          style={{
            width: "100%",
            minHeight: 200,
            backgroundColor: "#11111b",
            color: "#cdd6f4",
            border: "none",
            padding: "14px 16px",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 14,
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            lineHeight: 1.7,
            tabSize: 2,
            scrollbarWidth: "thin",
            scrollbarColor: "#313244 transparent",
          }}
        />
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={runCode}
          disabled={isRunning || !isConnected}
          style={{
            padding: "10px 28px",
            borderRadius: 10,
            border: "none",
            background: isRunning || !isConnected ? "#45475a" : "#a6e3a1",
            color: isRunning || !isConnected ? "#6c7086" : "#1e1e2e",
            cursor: isRunning || !isConnected ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s ease",
            boxShadow: isRunning || !isConnected ? "none" : "0 4px 16px rgba(166, 227, 161, 0.25)",
          }}
          onMouseEnter={(e) => {
            if (!isRunning && isConnected) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 6px 24px rgba(166, 227, 161, 0.35)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isRunning && isConnected) {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(166, 227, 161, 0.25)";
            }
          }}
        >
          {isRunning ? (
            <>
              <span className="spinner" style={{ width: 18, height: 18, border: "2px solid #6c7086", borderTopColor: "#a6e3a1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Running...
            </>
          ) : (
            <>
              ▶️ Run Program
            </>
          )}
        </button>

        {isRunning && (
          <button
            onClick={stopCode}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: "#f38ba8",
              color: "#1e1e2e",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.2s ease",
              boxShadow: "0 4px 16px rgba(243, 139, 168, 0.25)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#eba0ac";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f38ba8";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            ⏹️ Stop
          </button>
        )}

        <button
          onClick={clearTerminal}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid #313244",
            background: "transparent",
            color: "#cdd6f4",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#313244";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          🧹 Clear
        </button>

        <button
          onClick={toggleExpand}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid #313244",
            background: "transparent",
            color: "#cdd6f4",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.2s ease",
            marginLeft: "auto",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#313244";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {isExpanded ? "🔽 Shrink" : "🔼 Expand"}
        </button>
      </div>

      {/* Terminal */}
      <div
        ref={containerRef}
        style={{
          height: isExpanded ? 480 : 320,
          border: "1px solid #313244",
          borderRadius: 10,
          overflow: "hidden",
          padding: 4,
          backgroundColor: "#0d1117",
          transition: "height 0.3s ease",
        }}
      />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .xterm {
          height: 100%;
          padding: 4px;
        }
        .xterm-viewport {
          scrollbar-width: thin;
          scrollbar-color: #313244 transparent;
        }
        .xterm-viewport::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .xterm-viewport::-webkit-scrollbar-track {
          background: transparent;
        }
        .xterm-viewport::-webkit-scrollbar-thumb {
          background: #313244;
          border-radius: 4px;
        }
        .xterm-viewport::-webkit-scrollbar-thumb:hover {
          background: #45475a;
        }
        .xterm-viewport {
          scroll-behavior: smooth;
        }
        textarea::-webkit-scrollbar {
          width: 6px;
        }
        textarea::-webkit-scrollbar-track {
          background: transparent;
        }
        textarea::-webkit-scrollbar-thumb {
          background: #313244;
          border-radius: 4px;
        }
        textarea::-webkit-scrollbar-thumb:hover {
          background: #45475a;
        }
      `}</style>
    </div>
  );
}