// server/src/controllers/CompilerController.js
import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Queue management for multiple users
const requestQueue = [];
let isProcessing = false;
const maxConcurrent = 10;
const activeProcesses = new Map();
let compilerServiceProcess = null; // Track the compiler service process

export class CompilerController {
  
  // ===== COMPILER SERVICE MANAGEMENT =====
  
  // Start the CompilerService.exe
  static startCompilerService() {
    return new Promise((resolve, reject) => {
      // Check if already running
      if (compilerServiceProcess && !compilerServiceProcess.killed) {
        resolve({ success: true, message: 'Compiler service already running' });
        return;
      }

      // Path to CompilerService.exe
      const compilerPath = 'D:\\testcompiler\\full_project\\compiler-service\\publish\\CompilerService.exe';
      const compilerDir = 'D:\\testcompiler\\full_project\\compiler-service\\publish\\';
      
      // Check if file exists
      if (!fs.existsSync(compilerPath)) {
        reject(new Error(`CompilerService.exe not found at: ${compilerPath}`));
        return;
      }

      console.log('🚀 Starting CompilerService.exe...');
      
      // Start the compiler service
      compilerServiceProcess = spawn(compilerPath, [], {
        cwd: compilerDir,
        detached: true, // Run in background
        stdio: 'pipe',
        windowsHide: false
      });

      // Log output
      compilerServiceProcess.stdout.on('data', (data) => {
        console.log(`[CompilerService] ${data.toString().trim()}`);
      });

      compilerServiceProcess.stderr.on('data', (data) => {
        console.error(`[CompilerService Error] ${data.toString().trim()}`);
      });

      compilerServiceProcess.on('error', (err) => {
        console.error('Failed to start compiler service:', err);
        reject(err);
      });

      compilerServiceProcess.on('exit', (code) => {
        console.log(`CompilerService exited with code: ${code}`);
        compilerServiceProcess = null;
      });

      // Wait a moment for the service to start
      setTimeout(() => {
        resolve({ 
          success: true, 
          message: 'Compiler service started successfully',
          pid: compilerServiceProcess.pid
        });
      }, 2000);
    });
  }

  // Stop the CompilerService.exe
  static stopCompilerService() {
    return new Promise((resolve) => {
      if (compilerServiceProcess && !compilerServiceProcess.killed) {
        compilerServiceProcess.kill('SIGTERM');
        compilerServiceProcess = null;
        resolve({ success: true, message: 'Compiler service stopped' });
      } else {
        resolve({ success: false, message: 'Compiler service not running' });
      }
    });
  }

  // Check if CompilerService is running
  static checkCompilerServiceStatus() {
    // Check if process exists
    const isRunning = compilerServiceProcess !== null && !compilerServiceProcess.killed;
    
    // Also check if the file exists
    const compilerPath = 'D:\\testcompiler\\full_project\\compiler-service\\publish\\CompilerService.exe';
    const fileExists = fs.existsSync(compilerPath);
    
    // Try to ping the compiler service health endpoint
    return new Promise((resolve) => {
      // Simple file-based check since we might not have the health endpoint
      resolve({
        running: isRunning,
        fileExists: fileExists,
        pid: isRunning ? compilerServiceProcess.pid : null,
        path: compilerPath
      });
    });
  }

  // API endpoint to start compiler
  static async startCompiler(req, res) {
    try {
      const result = await CompilerController.startCompilerService();
      res.json({
        success: true,
        message: result.message,
        pid: result.pid
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // API endpoint to stop compiler
  static async stopCompiler(req, res) {
    const result = await CompilerController.stopCompilerService();
    res.json(result);
  }

  // API endpoint to check compiler status
  static async getCompilerStatus(req, res) {
    const status = await CompilerController.checkCompilerServiceStatus();
    res.json(status);
  }

  // Download the compiler service exe
  static downloadCompiler(req, res) {
    const compilerPath = 'D:\\testcompiler\\full_project\\compiler-service\\publish\\CompilerService.exe';
    
    if (!fs.existsSync(compilerPath)) {
      return res.status(404).json({
        success: false,
        message: 'CompilerService.exe not found'
      });
    }

    res.download(compilerPath, 'CompilerService.exe', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }
    });
  }

  // ===== ORIGINAL CODE EXECUTION METHODS =====
  
  // Setup WebSocket server for compiler
  static setupWebSocketServer(wss) {
    wss.on('connection', (ws) => {
      const clientId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      
      ws.send(JSON.stringify({ 
        type: 'connection', 
        data: 'Connected to compiler server' 
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, clientId, data);
        } catch (error) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            data: 'Invalid message format' 
          }));
        }
      });

      ws.on('close', () => {
        // Clean up running processes
        if (activeProcesses.has(clientId)) {
          const process = activeProcesses.get(clientId);
          if (process) {
            process.kill();
          }
          activeProcesses.delete(clientId);
        }
      });
    });

    console.log('🔌 WebSocket compiler server initialized');
    return wss;
  }

  static handleMessage(ws, clientId, data) {
    if (data.type === 'stdin') {
      // Handle stdin for running process
      if (activeProcesses.has(clientId)) {
        const process = activeProcesses.get(clientId);
        if (process) {
          process.stdin.write(data.data);
        }
      }
      return;
    }

    if (data.type === 'stop') {
      if (activeProcesses.has(clientId)) {
        const process = activeProcesses.get(clientId);
        if (process) {
          process.kill();
        }
        activeProcesses.delete(clientId);
      }
      ws.send(JSON.stringify({ 
        type: 'info', 
        data: 'Execution stopped by user' 
      }));
      return;
    }

    // Add to queue
    requestQueue.push({
      ws,
      clientId,
      language: data.language || 'python',
      code: data.code || '',
      input: data.input || ''
    });

    this.processQueue();
  }

  static async processQueue() {
    if (isProcessing || requestQueue.length === 0) return;

    const runningCount = Array.from(activeProcesses.values()).filter(p => p).length;
    if (runningCount >= maxConcurrent) {
      setTimeout(() => this.processQueue(), 1000);
      return;
    }

    isProcessing = true;
    const task = requestQueue.shift();

    // Send queue position
    task.ws.send(JSON.stringify({ 
      type: 'queue', 
      position: requestQueue.length + 1 
    }));

    try {
      await this.executeCode(task.ws, task.clientId, task);
    } catch (error) {
      task.ws.send(JSON.stringify({ 
        type: 'error', 
        data: error.message 
      }));
    }

    isProcessing = false;
    this.processQueue();
  }

  static async executeCode(ws, clientId, { language, code, input }) {
    return new Promise((resolve) => {
      const tempDir = os.tmpdir();
      const fileName = `temp_${Date.now()}_${clientId}`;
      const filePath = path.join(tempDir, fileName);
      
      let command, args, fileExtension;
      
      // Setup for different languages
      switch(language) {
        case 'python':
          fileExtension = '.py';
          fs.writeFileSync(filePath + fileExtension, code);
          command = 'python3';
          args = [filePath + fileExtension];
          break;
        case 'javascript':
          fileExtension = '.js';
          fs.writeFileSync(filePath + fileExtension, code);
          command = 'node';
          args = [filePath + fileExtension];
          break;
        case 'c':
          fileExtension = '.c';
          fs.writeFileSync(filePath + fileExtension, code);
          command = 'gcc';
          args = [filePath + fileExtension, '-o', filePath];
          break;
        case 'cpp':
          fileExtension = '.cpp';
          fs.writeFileSync(filePath + fileExtension, code);
          command = 'g++';
          args = [filePath + fileExtension, '-o', filePath];
          break;
        case 'java':
          fileExtension = '.java';
          fs.writeFileSync(filePath + fileExtension, code);
          command = 'javac';
          args = [filePath + fileExtension];
          break;
        default:
          ws.send(JSON.stringify({ 
            type: 'error', 
            data: 'Unsupported language' 
          }));
          resolve();
          return;
      }

      // Compile if needed
      if (['c', 'cpp', 'java'].includes(language)) {
        const compile = spawn(command, args);
        let compileError = '';
        
        compile.stderr.on('data', (data) => {
          compileError += data.toString();
        });

        compile.on('close', (code) => {
          if (code !== 0) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              data: `Compilation failed:\n${compileError}` 
            }));
            resolve();
            return;
          }
          this.runExecutable(ws, clientId, language, filePath, input, resolve);
        });
      } else {
        // Interpreted languages
        this.runExecutable(ws, clientId, language, filePath + fileExtension, input, resolve);
      }
    });
  }

  static runExecutable(ws, clientId, language, filePath, input, resolve) {
    let command, args;
    
    if (['python', 'javascript'].includes(language)) {
      command = language === 'python' ? 'python3' : 'node';
      args = [filePath];
    } else if (language === 'java') {
      command = 'java';
      args = ['-cp', path.dirname(filePath), 'Main'];
    } else {
      command = filePath;
      args = [];
    }

    const process = spawn(command, args);
    activeProcesses.set(clientId, process);

    process.stdout.on('data', (data) => {
      const text = data.toString();
      ws.send(JSON.stringify({ type: 'output', data: text }));
    });

    process.stderr.on('data', (data) => {
      const text = data.toString();
      ws.send(JSON.stringify({ type: 'error', data: text }));
    });

    if (input) {
      process.stdin.write(input);
      process.stdin.end();
    }

    process.on('close', (code) => {
      activeProcesses.delete(clientId);
      ws.send(JSON.stringify({ 
        type: 'finished', 
        code: code 
      }));
      
      // Cleanup
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        if (language === 'c' || language === 'cpp') {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        if (language === 'java') {
          if (fs.existsSync(filePath + '.java')) {
            fs.unlinkSync(filePath + '.java');
          }
          if (fs.existsSync(filePath + '.class')) {
            fs.unlinkSync(filePath + '.class');
          }
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      
      resolve();
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (process && !process.killed) {
        process.kill();
        ws.send(JSON.stringify({ 
          type: 'error', 
          data: 'Execution timeout (15 seconds)' 
        }));
        activeProcesses.delete(clientId);
        resolve();
      }
    }, 15000);
  }

  // Get default code for language
  static getDefaultCode(language) {
    const defaultCodes = {
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
    if (scanf("%49s", name) != 1) {
        printf("Error reading name\\n");
        return 1;
    }
    printf("Enter your age: ");
    if (scanf("%d", &age) != 1) {
        printf("Error reading age\\n");
        return 1;
    }
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
    if (!(cin >> name)) {
        cout << "Error reading name" << endl;
        return 1;
    }
    cout << "Enter your age: ";
    if (!(cin >> age)) {
        cout << "Error reading age" << endl;
        return 1;
    }
    cout << "Hello " << name << "! You are " << age << " years old." << endl;
    
    return 0;
}`,

      java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        try (Scanner sc = new Scanner(System.in)) {
            System.out.print("Enter your name: ");
            String name = sc.nextLine();
            System.out.print("Enter your age: ");
            int age = sc.nextInt();
            System.out.println("Hello " + name + "! You are " + age + " years old.");
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
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
});`
    };

    return defaultCodes[language] || defaultCodes.python;
  }
}