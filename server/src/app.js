 // server/src/app.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFile, execFileSync } from "child_process";
import pty from "node-pty";
import { db, dbPromise } from "./db.js";
import { verifyWsToken } from "./middleware/auth.js";

// ROUTES
import authRouter from "./routes/auth.js";
import userRoutes from "./routes/userRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import snapshotRoutes from "./routes/snapshotRoutes.js";
import faceRoutes from "./routes/faceRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import patternRoutes from "./routes/patternRoutes.js";
import examSessionRoutes from "./routes/examSessionRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.BASE_URL || "http://localhost:5173")
  .split(",").map((x) => x.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files
const rootUploads = path.join(__dirname, "..", "uploads");
const srcUploads = path.join(__dirname, "uploads");

if (!fs.existsSync(rootUploads)) fs.mkdirSync(rootUploads, { recursive: true });
if (!fs.existsSync(srcUploads)) fs.mkdirSync(srcUploads, { recursive: true });

const rootFaces = path.join(rootUploads, "faces");
const srcFaces = path.join(srcUploads, "faces");
if (!fs.existsSync(rootFaces)) fs.mkdirSync(rootFaces, { recursive: true });
if (!fs.existsSync(srcFaces)) fs.mkdirSync(srcFaces, { recursive: true });

const tempRoot = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempRoot)) fs.mkdirSync(tempRoot, { recursive: true });

app.use("/uploads", express.static(srcUploads));
app.use("/uploads", express.static(rootUploads));

console.log(`✅ Static files served from: ${srcUploads}`);
console.log(`✅ Static files served from: ${rootUploads}`);
console.log(`📁 Temp directory: ${tempRoot}`);

app.get("/", (req, res) => res.send("Exam Portal API + Compiler Running"));

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// COMPILER DOWNLOAD ROUTES
// ============================================

app.get("/api/compiler/status", (req, res) => {
  const downloadPath = path.join(process.cwd(), "..", "client", "public", "downloads", "CompilerService.exe");
  const exists = fs.existsSync(downloadPath);
  res.json({
    success: true,
    installed: exists,
    running: exists,
    path: downloadPath,
    message: exists ? "Compiler is available for download" : "Compiler not installed",
  });
});

app.get("/api/compiler/download-standalone", async (req, res) => {
  const zipPath = path.join(process.cwd(), "..", "client", "public", "downloads", "compiler-service.zip");
  try {
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ success: false, error: "compiler-service.zip not found." });
    }
    res.download(zipPath, "compiler-service.zip", (err) => {
      if (err) res.status(500).json({ error: "Download failed" });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to download package: " + error.message });
  }
});

app.get("/api/compiler/download-exe", (req, res) => {
  const exePath = path.join(process.cwd(), "..", "client", "public", "downloads", "CompilerService.exe");
  try {
    if (!fs.existsSync(exePath)) return res.status(404).json({ error: "CompilerService.exe not found" });
    res.download(exePath, "CompilerService.exe");
  } catch (error) {
    res.status(500).json({ error: "Download failed" });
  }
});

app.get("/api/compiler/download-batch", (req, res) => {
  const batchPath = path.join(process.cwd(), "..", "client", "public", "downloads", "start-compiler.bat");
  try {
    if (!fs.existsSync(batchPath)) return res.status(404).json({ error: "start-compiler.bat not found" });
    res.download(batchPath, "start-compiler.bat");
  } catch (error) {
    res.status(500).json({ error: "Download failed" });
  }
});

app.post("/api/compiler/start", (req, res) => {
  res.json({
    success: false,
    message: "The compiler must be started manually on your machine. Please download and run the compiler package.",
  });
});

// ============================================
// ✅ API ROUTES - FIXED
// ============================================

app.use("/auth", authRouter);
app.use("/api/users", userRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/patterns", patternRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/snapshots", snapshotRoutes);
app.use("/api/face", faceRoutes);
app.use("/api/exam-sessions", examSessionRoutes);

// ✅ FIX: Use both routes for compatibility
app.use("/api/test", testRoutes);    // Keep for backward compatibility
app.use("/api/tests", testRoutes);   // ✅ NEW - This is what frontend uses!

console.log('✅ Test routes registered at: /api/test and /api/tests');

// ============================================
// DB Connection
// ============================================

db.getConnection((err, conn) => {
  if (err) {
    console.error("❌ DB Error:", err);
  } else {
    console.log("🟢 MySQL Connected");
    conn.release();
  }
});

const server = http.createServer(app);

// ============================================
// COMPILER WEBSOCKET
// ============================================

const wss = new WebSocketServer({ server, path: "/compiler-ws" });

console.log("🟢 Compiler WebSocket Ready (pty-backed real terminal)");
console.log("🔌 WebSocket endpoint: ws://localhost:5000/compiler-ws");

// socketId -> pty process
const activeProcesses = new Map();
const processMetadata = new Map();

const MAX_CONCURRENT_EXECUTIONS = 20;
const EXECUTION_TIMEOUT = 60000;
const CLEANUP_INTERVAL = 60000;

const executionQueue = [];

const DEFAULT_CODE_TEMPLATES = {
  python: `# Python Program
try:
    name = input("Enter your name: ")
    age = int(input("Enter your age: "))
    print(f"Hello {name}! You are {age} years old.")
except Exception as e:
    print(f"Error: {e}")`,

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

function getDefaultCode(language) {
  return DEFAULT_CODE_TEMPLATES[language] || DEFAULT_CODE_TEMPLATES.python;
}

function cleanupTempDir(dir) {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {}
}

// Periodic cleanup
setInterval(() => {
  if (!fs.existsSync(tempRoot)) return;
  try {
    const entries = fs.readdirSync(tempRoot);
    const now = Date.now();
    entries.forEach((entry) => {
      const full = path.join(tempRoot, entry);
      try {
        const stats = fs.statSync(full);
        if (now - stats.mtimeMs > 10 * 60 * 1000) {
          fs.rmSync(full, { recursive: true, force: true });
        }
      } catch (e) {}
    });
  } catch (e) {}
}, CLEANUP_INTERVAL);

// Resolve executables
const _resolvedExeCache = new Map();

function resolveExecutable(cmd) {
  if (_resolvedExeCache.has(cmd)) return _resolvedExeCache.get(cmd);
  if (path.isAbsolute(cmd)) {
    _resolvedExeCache.set(cmd, cmd);
    return cmd;
  }

  try {
    const lookupCmd = process.platform === "win32" ? "where" : "which";
    const out = execFileSync(lookupCmd, [cmd], { encoding: "utf8" });
    const firstPath = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0];
    if (firstPath && fs.existsSync(firstPath)) {
      _resolvedExeCache.set(cmd, firstPath);
      return firstPath;
    }
  } catch (e) {}

  _resolvedExeCache.set(cmd, cmd);
  return cmd;
}

function compile(cmd, args, cwd) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd }, (err, stdout, stderr) => {
      resolve({ success: !err, stderr: stderr || (err ? err.message : "") });
    });
  });
}

async function runInteractive({ socket, socketId, language, code }) {
  const sessionDir = path.join(tempRoot, `${socketId}_${Date.now()}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  const send = (obj) => {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(obj));
    }
  };

  const lang = (language || "python").toLowerCase();
  let cmd, args;

  try {
    if (lang === "python") {
      const file = path.join(sessionDir, "main.py");
      fs.writeFileSync(file, code);
      cmd = process.platform === "win32" ? "python" : "python3";
      args = ["-u", file];
    } else if (lang === "javascript" || lang === "node") {
      const file = path.join(sessionDir, "main.js");
      fs.writeFileSync(file, code);
      cmd = "node";
      args = [file];
    } else if (lang === "c" || lang === "cpp") {
      const ext = lang === "c" ? ".c" : ".cpp";
      const compiler = lang === "c" ? "gcc" : "g++";
      const file = path.join(sessionDir, `main${ext}`);
      const exe = path.join(sessionDir, process.platform === "win32" ? "program.exe" : "program");
      fs.writeFileSync(file, code);

      const compileArgs = lang === "c"
        ? [file, "-o", exe, "-Wall", "-O2"]
        : [file, "-o", exe, "-Wall", "-O2", "-std=c++17"];

      send({ type: "info", data: `Compiling with ${compiler}...` });
      const { success, stderr } = await compile(compiler, compileArgs, sessionDir);
      if (!success) {
        send({ type: "error", data: `Compilation failed:\n${stderr}` });
        send({ type: "finished", code: 1 });
        cleanupTempDir(sessionDir);
        return;
      }
      cmd = exe;
      args = [];
    } else if (lang === "java") {
      let className = "Main";
      const m = code.match(/public\s+class\s+(\w+)/);
      if (m) className = m[1];
      const file = path.join(sessionDir, `${className}.java`);
      fs.writeFileSync(file, code);

      send({ type: "info", data: "Compiling with javac..." });
      const { success, stderr } = await compile("javac", [file], sessionDir);
      if (!success) {
        send({ type: "error", data: `Compilation failed:\n${stderr}` });
        send({ type: "finished", code: 1 });
        cleanupTempDir(sessionDir);
        return;
      }
      cmd = "java";
      args = ["-cp", sessionDir, className];
    } else {
      send({ type: "error", data: `Unsupported language: ${lang}` });
      send({ type: "finished", code: 1 });
      cleanupTempDir(sessionDir);
      return;
    }

    const resolvedCmd = resolveExecutable(cmd);
    send({ type: "info", data: "Starting program..." });

    const term = pty.spawn(resolvedCmd, args, {
      name: "xterm-color",
      cols: 100,
      rows: 30,
      cwd: sessionDir,
      env: {
        PATH: process.env.PATH || "",
        SystemRoot: process.env.SystemRoot || "",
        ComSpec: process.env.ComSpec || "",
        HOME: sessionDir,
        USERPROFILE: sessionDir,
        TEMP: sessionDir,
        TMP: sessionDir,
      },
    });

    activeProcesses.set(socketId, term);
    processMetadata.set(socketId, { language: lang, sessionDir, startTime: Date.now() });

    const idleTimeout = setTimeout(() => {
      try { term.kill(); } catch (e) {}
      send({ type: "error", data: `Execution timeout (${EXECUTION_TIMEOUT / 1000}s)` });
    }, EXECUTION_TIMEOUT);

    term.onData((data) => {
      send({ type: "output", data });
    });

    term.onExit(({ exitCode }) => {
      clearTimeout(idleTimeout);
      activeProcesses.delete(socketId);
      processMetadata.delete(socketId);
      send({ type: "finished", code: exitCode });
      setTimeout(() => cleanupTempDir(sessionDir), 1000);
      processQueue();
    });
  } catch (error) {
    send({ type: "error", data: `Execution error: ${error.message}` });
    send({ type: "finished", code: 1 });
    cleanupTempDir(sessionDir);
  }
}

function processQueue() {
  if (executionQueue.length === 0) return;
  if (activeProcesses.size >= MAX_CONCURRENT_EXECUTIONS) {
    setTimeout(processQueue, 500);
    return;
  }
  const task = executionQueue.shift();
  if (task.socket.readyState === 1) {
    task.socket.send(JSON.stringify({ type: "info", data: "Starting..." }));
  }
  runInteractive(task).catch((e) => console.error("Execution error:", e));
  setImmediate(processQueue);
}

// WebSocket connection
wss.on("connection", async (socket, request) => {
  const requestUrl = new URL(request.url || "/compiler-ws", `http://${request.headers.host || "localhost"}`);
  const token = requestUrl.searchParams.get("token") || "";
  const sessionId = requestUrl.searchParams.get("session_id") || "";
  const wsUser = verifyWsToken(token);

  if (!wsUser || wsUser.role !== "student") {
    socket.close(1008, "Authentication required");
    return;
  }

  if (!sessionId) {
    socket.close(1008, "Exam session required");
    return;
  }

  try {
    const [sessions] = await dbPromise.query(
      `SELECT session_id FROM exam_sessions WHERE session_id=? AND user_id=? AND status='active' AND expires_at > NOW(3) LIMIT 1`,
      [sessionId, wsUser.id]
    );
    if (!sessions.length) {
      socket.close(1008, "Active exam session required");
      return;
    }
  } catch (error) {
    console.error("Compiler WebSocket session validation failed:", error);
    socket.close(1011, "Session validation failed");
    return;
  }

  const socketId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  console.log(`🟢 Authenticated compiler client connected: ${socketId}`);

  socket.send(JSON.stringify({
    type: "connection",
    message: "Connected to Compiler Backend ✔",
    socketId,
    maxConcurrent: MAX_CONCURRENT_EXECUTIONS,
  }));

  socket.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch {
      socket.send(JSON.stringify({ type: "error", data: "Invalid JSON input" }));
      return;
    }

    const { language, code, type } = msg;

    if (type === "stdin") {
      const term = activeProcesses.get(socketId);
      if (term) {
        try { term.write(msg.data || ""); } catch (e) {}
      }
      return;
    }

    if (type === "resize") {
      const term = activeProcesses.get(socketId);
      if (term && msg.cols && msg.rows) {
        try { term.resize(msg.cols, msg.rows); } catch (e) {}
      }
      return;
    }

    if (type === "stop") {
      const term = activeProcesses.get(socketId);
      if (term) {
        try { term.kill(); } catch (e) {}
        activeProcesses.delete(socketId);
        processMetadata.delete(socketId);
        socket.send(JSON.stringify({ type: "info", data: "⏹️ Execution stopped by user" }));
      }
      return;
    }

    if (type === "getDefaultCode") {
      socket.send(JSON.stringify({
        type: "defaultCode",
        language: language || "python",
        code: getDefaultCode(language || "python"),
      }));
      return;
    }

    if (!code) {
      socket.send(JSON.stringify({ type: "error", data: "No code provided" }));
      return;
    }

    if (typeof code !== "string" || code.length > 50000) {
      socket.send(JSON.stringify({ type: "error", data: "Code is too large (maximum 50,000 characters)." }));
      return;
    }

    const allowedLanguages = new Set(["python", "c", "cpp", "java", "javascript", "node"]);
    if (!allowedLanguages.has(String(language || "python").toLowerCase())) {
      socket.send(JSON.stringify({ type: "error", data: "Unsupported language" }));
      return;
    }

    if (activeProcesses.has(socketId)) {
      socket.send(JSON.stringify({
        type: "error",
        data: "⚠️ A program is already running. Please stop it first.",
      }));
      return;
    }

    executionQueue.push({ socket, socketId, language: language || "python", code });
    socket.send(JSON.stringify({
      type: "queued",
      position: executionQueue.length,
      message: "Queued..."
    }));
    processQueue();
  });

  socket.on("close", () => {
    console.log(`🔴 Client disconnected: ${socketId}`);
    const term = activeProcesses.get(socketId);
    if (term) {
      try { term.kill(); } catch (e) {}
    }
    activeProcesses.delete(socketId);
    const meta = processMetadata.get(socketId);
    if (meta) cleanupTempDir(meta.sessionDir);
    processMetadata.delete(socketId);
  });

  socket.on("error", (error) => {
    console.error(`WebSocket error for ${socketId}:`, error);
    const term = activeProcesses.get(socketId);
    if (term) {
      try { term.kill(); } catch (e) {}
    }
    activeProcesses.delete(socketId);
    processMetadata.delete(socketId);
  });
});

// 404 handler
app.use((req, res) => res.status(404).json({ ok: false, error: "Route not found" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ ok: false, error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/compiler-ws`);
  console.log(`⚡ Max concurrent: ${MAX_CONCURRENT_EXECUTIONS}`);
});

export default app;