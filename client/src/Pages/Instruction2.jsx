 // client/src/pages/Instruction2.jsx
import React, { useState, useEffect } from "react";
import api from "../api";
import "../styles/portal.css";
import { 
  FiCheckCircle, 
  FiAlertCircle, 
  FiDownload, 
  FiRefreshCw, 
  FiPlay, 
  FiHelpCircle,
  FiX
} from "react-icons/fi";

const COMPILER_URL = "http://localhost:5001";

export default function Instruction2({ go, user, token, testId: propTestId }) {
  const [compilerStatus, setCompilerStatus] = useState('checking');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [canStartExam, setCanStartExam] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [compilerEnabled, setCompilerEnabled] = useState(null); // ✅ Start with null
  const [loadingSetting, setLoadingSetting] = useState(true);

  // ✅ FETCH COMPILER SETTING FROM BACKEND
  useEffect(() => {
    const fetchCompilerSetting = async () => {
      try {
        // Get testId from props or URL
        let testId = propTestId;
        if (!testId) {
          const urlParams = new URLSearchParams(window.location.search);
          testId = urlParams.get('testId') || urlParams.get('test_id');
        }
        
        // If still no testId, use 'default_test'
        if (!testId) {
          testId = 'default_test';
          console.log('ℹ️ Using default test_id:', testId);
        }

        console.log('📋 Fetching compiler setting for test:', testId);
        
        // ✅ CALL YOUR BACKEND ROUTE
        const response = await api.get("/api/tests/compiler-setting/public", { params: { test_id: testId } });
        
        if (response?.data?.ok) {
          const data = response.data;
          console.log('📋 Compiler setting loaded:', data);
          // ✅ Set the actual value from database
          setCompilerEnabled(data.compiler_visible || 'no');
        } else {
          console.warn('⚠️ API returned error, checking localStorage');
          // Try localStorage as fallback
          const saved = localStorage.getItem('compilerVisible');
          if (saved) {
            setCompilerEnabled(saved);
          } else {
            setCompilerEnabled('no');
          }
        }
      } catch (error) {
        console.error('⚠️ Failed to fetch compiler setting:', error);
        // Try localStorage as fallback
        const saved = localStorage.getItem('compilerVisible');
        if (saved) {
          setCompilerEnabled(saved);
        } else {
          setCompilerEnabled('no');
        }
      } finally {
        setLoadingSetting(false);
      }
    };

    fetchCompilerSetting();
  }, [propTestId]);

  // Check if compiler service is running (ONLY if enabled)
  const checkCompiler = async () => {
    // ✅ If compiler is disabled
    if (compilerEnabled === 'no') {
      console.log('⛔ Compiler is disabled - skipping check');
      setCompilerStatus('disabled');
      setCanStartExam(true);
      setShowManualInstructions(false);
      setErrorMessage('');
      return true;
    }

    // ✅ If compiler is enabled but not yet checked
    console.log('🔍 Checking local compiler at:', COMPILER_URL);
    setErrorMessage('');

    try {
      const endpoints = ['/health', '/status', '/'];
      let isRunning = false;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${COMPILER_URL}${endpoint}`, {
            signal: AbortSignal.timeout(2000)
          });
          
          if (response.ok) {
            console.log(`✅ Compiler responded on ${endpoint}`);
            isRunning = true;
            break;
          }
        } catch (e) {
          console.log(`⏳ Endpoint ${endpoint} failed`);
        }
      }

      if (isRunning) {
        console.log('✅ Compiler is running');
        setCompilerStatus('running');
        setCanStartExam(true);
        setShowManualInstructions(false);
        setIsStarting(false);
        return true;
      }

      console.log('❌ Compiler not responding');
      setCompilerStatus('not_installed');
      setCanStartExam(false);
      setShowManualInstructions(true);
      setErrorMessage('Compiler service is not running. Please start it first.');
      return false;

    } catch (error) {
      console.log('❌ Compiler check failed:', error.message);
      setCompilerStatus('not_installed');
      setCanStartExam(false);
      setShowManualInstructions(true);
      setErrorMessage('Could not connect to compiler. Please start the compiler service.');
      return false;
    }
  };

  // ✅ Run check when setting loads
  useEffect(() => {
    if (!loadingSetting && compilerEnabled !== null) {
      checkCompiler();
    }
  }, [loadingSetting, compilerEnabled]);

  // Ping compiler (quick check)
  const pingCompiler = async () => {
    try {
      const response = await fetch(`${COMPILER_URL}/health`, {
        signal: AbortSignal.timeout(1500)
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  // Download compiler package
  const downloadCompilerPackage = () => {
    console.log('📥 Starting download...');
    setIsInstalling(true);
    setCompilerStatus('installing');
    setShowManualInstructions(false);
    setErrorMessage('');

    const link = document.createElement('a');
    link.href = '/downloads/compiler-service.zip';
    link.download = 'compiler-service.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setInstallProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(interval);
        setIsInstalling(false);
        setCompilerStatus('not_installed');

        alert(
          '✅ Download complete!\n\n' +
          '📂 Extract the ZIP file to any folder\n' +
          '▶️ Right-click "start-compiler.bat" and select "Run as administrator"\n' +
          '🔄 Keep the window open and refresh this page\n\n' +
          '💡 The service will run on: http://localhost:5001'
        );
        setShowManualInstructions(true);
        setTimeout(checkCompiler, 3000);
      }
    }, 200);
  };

  // Start compiler
  const startCompiler = async () => {
    if (isStarting) return;

    setIsStarting(true);
    setShowManualInstructions(false);
    setCompilerStatus('starting');
    setErrorMessage('');

    try {
      const isRunning = await pingCompiler();
      
      if (isRunning) {
        setCompilerStatus('running');
        setCanStartExam(true);
        setIsStarting(false);
        return;
      }
    } catch (e) {
      console.log('Compiler not running, proceeding with download');
    }

    const downloadConfirm = window.confirm(
      '⚠️ Compiler service is not running on your computer.\n\n' +
      'To use the compiler, you need to download and run it locally.\n\n' +
      'Would you like to download the compiler package now?\n\n' +
      '(You will need to extract and run it manually)'
    );

    if (downloadConfirm) {
      downloadCompilerPackage();
    } else {
      setShowManualInstructions(true);
      setCompilerStatus('not_installed');
      setErrorMessage('Please download and start the compiler to continue.');
    }

    setIsStarting(false);
  };

  // Download start script
  const downloadStartScript = () => {
    const link = document.createElement('a');
    link.href = '/downloads/start-compiler.bat';
    link.download = 'start-compiler.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(
      '✅ Batch file downloaded!\n\n' +
      '⚠️ IMPORTANT:\n' +
      'This batch file needs CompilerService.exe in the same folder.\n\n' +
      'If you don\'t have the exe:\n' +
      '1. Click "Download Package" button first\n' +
      '2. Extract the ZIP\n' +
      '3. Then use this batch file\n\n' +
      'Run as Administrator.'
    );
  };

  // Start exam
  async function startExam() {
    // ✅ Allow if compiler is disabled OR running
    if (compilerEnabled === 'no' || canStartExam) {
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) await el.msRequestFullscreen();
      } catch (e) {
        console.warn("Fullscreen blocked:", e);
      }
      go("exam");
    } else {
      alert('Please ensure the compiler service is running before starting the exam.');
    }
  }

  // ✅ Render compiler status
  const renderCompilerStatus = () => {
    // Show loading while fetching
    if (loadingSetting || compilerEnabled === null) {
      return (
        <div className="compiler-status-box info">
          <FiRefreshCw size={24} style={{ color: '#3758f9', animation: 'spin 1s linear infinite' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#004085' }}>⏳ Loading compiler settings...</div>
          </div>
        </div>
      );
    }

    // ✅ COMPILER DISABLED
    if (compilerEnabled === 'no') {
      return (
        <div className="compiler-status-box info">
          <FiX size={24} style={{ color: '#6c757d' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#495057' }}>⛔ Compiler Disabled</div>
            <div style={{ fontSize: 13, color: '#495057' }}>
              The online compiler is turned OFF. You can start your exam without it.
            </div>
          </div>
        </div>
      );
    }

    // ✅ COMPILER ENABLED - Show status
    switch (compilerStatus) {
      case 'running':
        return (
          <div className="compiler-status-box success">
            <FiCheckCircle size={24} style={{ color: '#28a745' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#155724' }}>✅ Compiler Service Running</div>
              <div style={{ fontSize: 13, color: '#155724' }}>You can start your exam</div>
            </div>
          </div>
        );
      case 'starting':
        return (
          <div className="compiler-status-box warning">
            <FiRefreshCw size={24} style={{ color: '#ff9800', animation: 'spin 1s linear infinite' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#856404' }}>
                ⏳ {isStarting ? 'Starting Compiler Service...' : 'Checking compiler...'}
              </div>
            </div>
          </div>
        );
      case 'installing':
        return (
          <div className="compiler-status-box info">
            <FiRefreshCw size={24} style={{ color: '#3758f9', animation: 'spin 1s linear infinite' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#004085' }}>📦 Downloading Compiler Package...</div>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${installProgress}%` }} />
                <span className="progress-text">{installProgress}%</span>
              </div>
            </div>
          </div>
        );
      case 'checking':
        return (
          <div className="compiler-status-box info">
            <FiRefreshCw size={24} style={{ color: '#3758f9', animation: 'spin 1s linear infinite' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#004085' }}>⏳ Checking Compiler Service...</div>
            </div>
          </div>
        );
      default:
        return (
          <div className="compiler-status-box error">
            <FiAlertCircle size={24} style={{ color: '#dc3545' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#721c24' }}>❌ Compiler Service Not Found</div>
              <div style={{ fontSize: 13, color: '#721c24' }}>
                {errorMessage || 'Install the compiler to run code during the exam'}
              </div>
              <div className="action-buttons">
                <button
                  className="btn-primary"
                  onClick={startCompiler}
                  disabled={isInstalling || isStarting}
                >
                  <FiPlay size={14} style={{ marginRight: 6 }} />
                  {isStarting ? 'Starting...' : 'Download & Start Compiler'}
                </button>
                <button
                  className="btn-success"
                  onClick={downloadCompilerPackage}
                  disabled={isInstalling}
                >
                  <FiDownload size={14} style={{ marginRight: 6 }} />
                  {isInstalling ? 'Downloading...' : 'Download Package'}
                </button>
                <button
                  className="btn-warning"
                  onClick={downloadStartScript}
                >
                  📜 Get Start Script
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                ⚠️ One-time installation. Admin rights may be required.
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="inst-fullscreen">
      <div className="inst3-wrapper-no-scroll">
        <h1 className="inst3-title">Important Instructions Before You Start</h1>
        <h3 className="inst3-sub">Please understand every point carefully 👇</h3>

        <div style={{ marginBottom: 20 }}>
          {renderCompilerStatus()}

          {showManualInstructions && compilerEnabled === 'yes' && (
            <div className="compiler-status-box warning" style={{ marginTop: 10 }}>
              <FiHelpCircle size={24} style={{ color: '#856404' }} />
              <div>
                <div style={{ fontWeight: 600, color: '#856404' }}>
                  ⚠️ Manual Start Required
                </div>
                <div style={{ fontSize: 13, color: '#856404' }}>
                  <p style={{ margin: '4px 0' }}><strong>Step-by-Step Guide:</strong></p>
                  <ol style={{ textAlign: 'left', paddingLeft: 20, margin: '4px 0' }}>
                    <li>Click <strong>"Download Package"</strong> button above</li>
                    <li>Extract the ZIP file to any folder</li>
                    <li>Navigate to the extracted folder</li>
                    <li><strong>Right-click</strong> <code>start-compiler.bat</code></li>
                    <li>Select <strong>"Run as administrator"</strong></li>
                    <li>Keep the window open</li>
                    <li>Refresh this page</li>
                  </ol>
                  <div style={{ marginTop: 8, fontSize: 12, background: '#d4edda', padding: 8, borderRadius: 4 }}>
                    💡 <strong>Tip:</strong> The compiler will run on <code>http://localhost:5001</code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="inst3-row">
          <div className="inst3-box">
            <img src="/win.jpg" alt="No tab switch" />
            <p>Do NOT switch tabs or open other windows</p>
          </div>
          <div className="inst3-box">
            <img src="/esc.png" alt="ESC Key" />
            <p>Do NOT press the ESC key (exiting fullscreen auto-submits)</p>
          </div>
          <div className="inst3-box">
            <img src="/wifi.png" alt="Internet" />
            <p>Internet must stay connected throughout the exam</p>
          </div>
        </div>

        <div className="inst3-user">
          👤 {user?.name} — {user?.email}
        </div>

        <button
          className="inst3-start"
          onClick={startExam}
          disabled={!loadingSetting && compilerEnabled !== null && !canStartExam && compilerEnabled !== 'no'}
          style={{
            opacity: (loadingSetting || compilerEnabled === null || (!canStartExam && compilerEnabled !== 'no')) ? 0.6 : 1,
            cursor: (loadingSetting || compilerEnabled === null || (!canStartExam && compilerEnabled !== 'no')) ? 'not-allowed' : 'pointer'
          }}
        >
          {loadingSetting || compilerEnabled === null ? '⏳ Loading...' : 
           compilerEnabled === 'no' ? '✅ I have read the instructions — Start Exam' :
           canStartExam ? '✅ I have read the instructions — Start Exam' : 
           '⏳ Waiting for Compiler...'}
        </button>

        <style>{`
          .compiler-status-box {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 18px;
            border-radius: 10px;
            text-align: left;
            max-width: 650px;
            margin: 0 auto;
          }
          .compiler-status-box.success {
            background: #d4edda;
            border: 1px solid #28a745;
          }
          .compiler-status-box.error {
            background: #f8d7da;
            border: 1px solid #dc3545;
          }
          .compiler-status-box.warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
          }
          .compiler-status-box.info {
            background: #cce5ff;
            border: 1px solid #007bff;
          }
          .action-buttons {
            display: flex;
            gap: 8px;
            margin-top: 6px;
            flex-wrap: wrap;
          }
          .btn-success {
            background: #28a745;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            padding: 6px 14px;
            display: inline-flex;
            align-items: center;
            transition: all 0.2s;
          }
          .btn-success:hover {
            background: #218838;
            transform: translateY(-1px);
          }
          .btn-success:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .btn-primary {
            background: #3758f9;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            padding: 6px 14px;
            display: inline-flex;
            align-items: center;
            transition: all 0.2s;
          }
          .btn-primary:hover {
            background: #2a45d9;
            transform: translateY(-1px);
          }
          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .btn-warning {
            background: #ffc107;
            color: #212529;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            padding: 6px 14px;
            display: inline-flex;
            align-items: center;
            transition: all 0.2s;
          }
          .btn-warning:hover {
            background: #e0a800;
            transform: translateY(-1px);
          }
          .progress-bar-container {
            width: 200px;
            height: 6px;
            background: #e5e7eb;
            border-radius: 3px;
            overflow: hidden;
            position: relative;
            margin-top: 4px;
          }
          .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #3758f9, #28a745);
            transition: width 0.3s ease;
            border-radius: 3px;
          }
          .progress-text {
            font-size: 11px;
            color: #004085;
            margin-left: 8px;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @media (max-width: 600px) {
            .compiler-status-box {
              flex-direction: column;
              text-align: center;
            }
            .action-buttons {
              justify-content: center;
            }
            .progress-bar-container {
              width: 100%;
            }
          }
          code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
          }
        `}</style>
      </div>
    </div>
  );
}