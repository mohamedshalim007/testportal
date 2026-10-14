using System;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using System.Text.Json;
using System.Net.Http.Json;
namespace JMCCompilerService;

class Program
{
    private static bool _isShuttingDown = false;
    private static Dictionary<string, string> _detectedPaths = new();
    private static Dictionary<string, string> _executablePaths = new(StringComparer.OrdinalIgnoreCase);

    public static async Task Main(string[] args)
    {
        if (args.Length > 0 && args[0].ToLower() == "--version")
        {
            Console.WriteLine("JMC Compiler Service v1.0.0");
            return;
        }

        Console.WriteLine("========================================");
        Console.WriteLine("  DETECTING LANGUAGES...");
        Console.WriteLine("========================================");
        DetectAllLanguages();

        var builder = WebApplication.CreateBuilder();

        // Make JSON return camelCase
        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        });

        builder.Configuration.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowAll", policy =>
            {
                policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
            });
        });

        var urls = builder.Configuration.GetValue<string>("Urls");
        if (string.IsNullOrEmpty(urls))
        {
            urls = "http://localhost:5001";
        }
        builder.WebHost.UseUrls(urls);

        var app = builder.Build();
        app.UseCors("AllowAll");

        app.MapGet("/health", async context =>
        {
            if (_isShuttingDown)
            {
                context.Response.StatusCode = 503;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { status = "shutting_down" }));
                return;
            }

            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                status = "running",
                version = "1.0.0",
                timestamp = DateTime.Now.ToString("o"),
                uptime = (DateTime.Now - Process.GetCurrentProcess().StartTime).ToString(@"hh\:mm\:ss"),
                detected = _detectedPaths
            }));
        });

      app.MapPost("/run", async (HttpContext context) =>
{
    if (_isShuttingDown)
    {
        return Results.Json(new
        {
            error = "Service is shutting down"
        }, statusCode: 503);
    }

    RunRequest? request;

    try
    {
        request = await context.Request.ReadFromJsonAsync<RunRequest>();
    }
    catch (Exception ex)
    {
        return Results.Json(new
        {
            error = "Invalid JSON",
            details = ex.Message
        }, statusCode: 400);
    }

    if (request == null)
    {
        return Results.Json(new
        {
            error = "Request body is null"
        }, statusCode: 400);
    }

    Console.WriteLine("========== REQUEST ==========");
    Console.WriteLine($"Language : {request.Language}");
    Console.WriteLine($"Code     : {request.Code}");
    Console.WriteLine($"Input    : {request.Input}");
    Console.WriteLine("=============================");

    if (string.IsNullOrWhiteSpace(request.Code))
    {
        return Results.Json(new
        {
            error = "No code provided"
        }, statusCode: 400);
    }

    var result = await ExecuteCode(
        request.Language ?? "python",
        request.Code,
        request.Input ?? ""
    );

    return Results.Json(result);
});

        app.MapPost("/shutdown", async context =>
        {
            _isShuttingDown = true;
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                status = "shutting_down",
                message = "Compiler service is stopping..."
            }));

            _ = Task.Run(async () =>
            {
                await Task.Delay(2000);
                Environment.Exit(0);
            });
        });

        app.MapGet("/status", async context =>
        {
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                status = _isShuttingDown ? "shutting_down" : "running",
                uptime = (DateTime.Now - Process.GetCurrentProcess().StartTime).ToString(@"hh\:mm\:ss"),
                pid = Environment.ProcessId,
                version = "1.0.0",
                detected = _detectedPaths
            }));
        });

        Console.WriteLine("");
        Console.WriteLine($"JMC Compiler Service running on {urls}");
        Console.WriteLine("Press Ctrl+C to stop");
        Console.WriteLine("");

        await app.RunAsync();
    }

    static void DetectAllLanguages()
    {
        var languages = new (string Name, string[] Commands, string[] Paths)[]
        {
            ("Python", new[] { "python", "python3" }, new[] {
                @"C:\Python*\python.exe",
                @"C:\Python3*\python.exe",
                @"C:\Users\*\AppData\Local\Programs\Python\Python*\python.exe",
                @"C:\Program Files\Python*\python.exe",
                @"C:\Users\*\AppData\Local\Microsoft\WindowsApps\python.exe"
            }),
            ("Node.js", new[] { "node" }, new[] {
                @"C:\Program Files\nodejs\node.exe",
                @"C:\Program Files (x86)\nodejs\node.exe",
                @"C:\Users\*\AppData\Local\Programs\nodejs\node.exe",
                @"C:\Users\*\AppData\Local\Microsoft\WindowsApps\node.exe"
            }),
            ("Java (javac)", new[] { "javac" }, new[] {
                @"C:\Program Files\Java\jdk*\bin\javac.exe",
                @"C:\Program Files\Eclipse Adoptium\jdk*\bin\javac.exe",
                @"C:\Program Files\Amazon Corretto\jdk*\bin\javac.exe",
                @"C:\Program Files\OpenJDK\*\bin\javac.exe",
                @"C:\Program Files (x86)\Java\jdk*\bin\javac.exe"
            }),
            ("Java (java)", new[] { "java" }, new[] {
                @"C:\Program Files\Java\jdk*\bin\java.exe",
                @"C:\Program Files\Java\jre*\bin\java.exe",
                @"C:\Program Files\Eclipse Adoptium\jdk*\bin\java.exe",
                @"C:\Program Files\Amazon Corretto\jdk*\bin\java.exe",
                @"C:\Program Files\OpenJDK\*\bin\java.exe",
                @"C:\Program Files (x86)\Java\jdk*\bin\java.exe"
            }),
            ("GCC (C)", new[] { "gcc" }, new[] {
                @"C:\MinGW\bin\gcc.exe",
                @"C:\msys64\mingw64\bin\gcc.exe",
                @"C:\msys64\ucrt64\bin\gcc.exe",
                @"C:\Program Files\mingw-w64\*\mingw64\bin\gcc.exe",
                @"C:\cygwin64\bin\gcc.exe"
            }),
            ("G++ (C++)", new[] { "g++" }, new[] {
                @"C:\MinGW\bin\g++.exe",
                @"C:\msys64\mingw64\bin\g++.exe",
                @"C:\msys64\ucrt64\bin\g++.exe",
                @"C:\Program Files\mingw-w64\*\mingw64\bin\g++.exe",
                @"C:\cygwin64\bin\g++.exe"
            })
        };

        foreach (var lang in languages)
        {
            string foundPath = null;

            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            string[] pathExtensions = (Environment.GetEnvironmentVariable("PATHEXT") ?? ".exe;.com;.cmd;.bat")
                .Split(';', StringSplitOptions.RemoveEmptyEntries);

            foreach (var cmd in lang.Commands)
            {
                foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
                {
                    if (string.IsNullOrEmpty(dir)) continue;

                    foreach (var ext in pathExtensions)
                    {
                        string fullPath = Path.Combine(dir.Trim(), cmd + ext);
                        if (File.Exists(fullPath))
                        {
                            foundPath = fullPath;
                            break;
                        }
                    }
                    if (!string.IsNullOrEmpty(foundPath)) break;
                }

                if (!string.IsNullOrEmpty(foundPath))
                {
                    _executablePaths[cmd] = foundPath;
                    break;
                }
            }

            if (string.IsNullOrEmpty(foundPath))
            {
                foreach (var pattern in lang.Paths)
                {
                    if (pattern.Contains("*"))
                    {
                        try
                        {
                            string baseDir = pattern.Split('*')[0];
                            if (Directory.Exists(baseDir))
                            {
                                var matchingDirs = Directory.GetDirectories(baseDir, "*", SearchOption.AllDirectories);
                                foreach (var dir in matchingDirs)
                                {
                                    string exeName = Path.GetFileName(pattern).Replace("*", "");
                                    string fullPath = Path.Combine(dir, exeName);
                                    if (File.Exists(fullPath))
                                    {
                                        foundPath = fullPath;
                                        break;
                                    }

                                    string binPath = Path.Combine(dir, "bin", exeName);
                                    if (File.Exists(binPath))
                                    {
                                        foundPath = binPath;
                                        break;
                                    }
                                }
                            }
                        }
                        catch { }
                    }
                    else
                    {
                        string expandedPath = Environment.ExpandEnvironmentVariables(pattern);
                        if (File.Exists(expandedPath))
                        {
                            foundPath = expandedPath;
                        }
                    }
                    if (!string.IsNullOrEmpty(foundPath)) break;
                }

                if (!string.IsNullOrEmpty(foundPath))
                {
                    _executablePaths[lang.Commands[0]] = foundPath;
                }
            }

            if (!string.IsNullOrEmpty(foundPath))
            {
                _detectedPaths[lang.Name] = foundPath;
                Console.WriteLine($"  [OK] {lang.Name}: {foundPath}");
            }
            else
            {
                Console.WriteLine($"  [X] {lang.Name}: NOT FOUND");
            }
        }
    }

    static string FindExecutable(string executableName)
    {
        if (_executablePaths.TryGetValue(executableName, out var known))
        {
            return known;
        }

        string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        string[] pathExtensions = (Environment.GetEnvironmentVariable("PATHEXT") ?? ".exe;.com;.cmd;.bat")
            .Split(';', StringSplitOptions.RemoveEmptyEntries);

        foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            if (string.IsNullOrEmpty(dir)) continue;

            foreach (var ext in pathExtensions)
            {
                string fullPath = Path.Combine(dir.Trim(), executableName + ext);
                if (File.Exists(fullPath))
                {
                    _executablePaths[executableName] = fullPath;
                    return fullPath;
                }
            }

            string noExtPath = Path.Combine(dir.Trim(), executableName);
            if (File.Exists(noExtPath))
            {
                _executablePaths[executableName] = noExtPath;
                return noExtPath;
            }
        }

        try
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "where",
                    Arguments = executableName,
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };
            process.Start();
            string output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();

            if (!string.IsNullOrEmpty(output))
            {
                string firstPath = output.Trim().Split('\n')[0].Trim();
                if (File.Exists(firstPath))
                {
                    _executablePaths[executableName] = firstPath;
                    return firstPath;
                }
            }
        }
        catch { }

        return null;
    }

    static string QuotePath(string path)
    {
        if (string.IsNullOrEmpty(path)) return path;
        if (path.Contains(" ") || path.Contains("(") || path.Contains(")") || path.Contains("&"))
        {
            return $"\"{path}\"";
        }
        return path;
    }

    static ProcessStartInfo NewStart(string fileName, string args, string workDir)
    {
        return new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = args,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = workDir
        };
    }

    static async Task<RunResult> ExecuteCode(string language, string code, string input)
    {
        var result = new RunResult();
        var tempDir = Path.Combine(Path.GetTempPath(), "jmc_compiler", Guid.NewGuid().ToString());
        Directory.CreateDirectory(tempDir);

        try
        {
            string filePath;
            ProcessStartInfo startInfo;
            Process? compileProcess;

            switch (language?.ToLower())
            {
                case "python":
                {
                    filePath = Path.Combine(tempDir, "main.py");
                    await File.WriteAllTextAsync(filePath, code);

                    string pythonPath = FindExecutable("python");
                    if (string.IsNullOrEmpty(pythonPath))
                    {
                        pythonPath = FindExecutable("python3");
                    }
                    if (string.IsNullOrEmpty(pythonPath))
                    {
                        result.Error = "Python not found. Please install Python and add it to PATH.";
                        result.Success = false;
                        return result;
                    }
                    Console.WriteLine($"Using Python: {pythonPath}");
                    startInfo = NewStart(pythonPath, QuotePath(filePath), tempDir);
                    break;
                }

                case "javascript":
                case "node":
                {
                    filePath = Path.Combine(tempDir, "main.js");
                    await File.WriteAllTextAsync(filePath, code);

                    string nodePath = FindExecutable("node");
                    if (string.IsNullOrEmpty(nodePath))
                    {
                        result.Error = "Node.js not found. Please install Node.js and add it to PATH.";
                        result.Success = false;
                        return result;
                    }
                    Console.WriteLine($"Using Node.js: {nodePath}");
                    startInfo = NewStart(nodePath, QuotePath(filePath), tempDir);
                    break;
                }

                case "c":
                {
                    filePath = Path.Combine(tempDir, "main.c");
                    var exePath = Path.Combine(tempDir, "program.exe");
                    await File.WriteAllTextAsync(filePath, code);

                    string gccPath = FindExecutable("gcc");
                    if (string.IsNullOrEmpty(gccPath))
                    {
                        result.Error = "GCC (C compiler) not found. Please install MinGW/GCC.";
                        result.Success = false;
                        return result;
                    }
                    Console.WriteLine($"Using GCC: {gccPath}");

                    compileProcess = new Process
                    {
                        StartInfo = NewStart(gccPath, $"{QuotePath(filePath)} -o {QuotePath(exePath)} -Wall -O2", tempDir)
                    };
                    compileProcess.Start();
                    await compileProcess.WaitForExitAsync();

                    if (compileProcess.ExitCode != 0)
                    {
                        var compileError = await compileProcess.StandardError.ReadToEndAsync();
                        result.Error = string.IsNullOrEmpty(compileError) ? "Compilation failed" : compileError;
                        result.Success = false;
                        return result;
                    }

                    startInfo = NewStart(exePath, "", tempDir);
                    break;
                }

                case "cpp":
                case "c++":
                {
                    filePath = Path.Combine(tempDir, "main.cpp");
                    var exePath = Path.Combine(tempDir, "program.exe");
                    await File.WriteAllTextAsync(filePath, code);

                    string gppPath = FindExecutable("g++");
                    if (string.IsNullOrEmpty(gppPath))
                    {
                        result.Error = "G++ (C++ compiler) not found. Please install MinGW/GCC.";
                        result.Success = false;
                        return result;
                    }
                    Console.WriteLine($"Using G++: {gppPath}");

                    compileProcess = new Process
                    {
                        StartInfo = NewStart(gppPath, $"{QuotePath(filePath)} -o {QuotePath(exePath)} -Wall -O2 -std=c++17", tempDir)
                    };
                    compileProcess.Start();
                    await compileProcess.WaitForExitAsync();

                    if (compileProcess.ExitCode != 0)
                    {
                        var compileError = await compileProcess.StandardError.ReadToEndAsync();
                        result.Error = string.IsNullOrEmpty(compileError) ? "Compilation failed" : compileError;
                        result.Success = false;
                        return result;
                    }

                    startInfo = NewStart(exePath, "", tempDir);
                    break;
                }

                case "java":
                {
                    string className = "Main";
                    var classMatch = Regex.Match(code, @"public\s+class\s+(\w+)");
                    if (classMatch.Success)
                    {
                        className = classMatch.Groups[1].Value;
                    }

                    filePath = Path.Combine(tempDir, $"{className}.java");
                    await File.WriteAllTextAsync(filePath, code);

                    Console.WriteLine($"Compiling Java: {filePath}");
                    Console.WriteLine($"Class name: {className}");

                    string javacPath = FindExecutable("javac");
                    if (string.IsNullOrEmpty(javacPath))
                    {
                        result.Error = "Java compiler (javac) not found. Please install JDK.";
                        result.Success = false;
                        return result;
                    }
                    Console.WriteLine($"Using javac: {javacPath}");

                    compileProcess = new Process
                    {
                        StartInfo = NewStart(javacPath, QuotePath(filePath), tempDir)
                    };
                    compileProcess.Start();

                    var compileError = new StringBuilder();
                    compileProcess.ErrorDataReceived += (s, e) => { if (e.Data != null) compileError.AppendLine(e.Data); };
                    compileProcess.BeginErrorReadLine();

                    await compileProcess.WaitForExitAsync();

                    if (compileProcess.ExitCode != 0)
                    {
                        result.Error = compileError.ToString();
                        result.Success = false;
                        Console.WriteLine($"Java compilation failed: {result.Error}");
                        return result;
                    }

                    Console.WriteLine($"Java compilation successful for {className}");

                    string javaPath = FindExecutable("java");
                    if (string.IsNullOrEmpty(javaPath))
                    {
                        result.Error = "Java runtime (java) not found. Please install JRE/JDK.";
                        result.Success = false;
                        return result;
                    }
                    Console.WriteLine($"Using java: {javaPath}");

                    string javaArgs = $"-cp {QuotePath(tempDir)} {className}";
                    startInfo = NewStart(javaPath, javaArgs, tempDir);
                    break;
                }

                default:
                    result.Error = $"Unsupported language: {language}";
                    result.Success = false;
                    return result;
            }

            using var process = new Process();
            process.StartInfo = startInfo;

            var output = new StringBuilder();
            var errorOutput = new StringBuilder();

            process.OutputDataReceived += (s, e) => { if (e.Data != null) output.AppendLine(e.Data); };
            process.ErrorDataReceived += (s, e) => { if (e.Data != null) errorOutput.AppendLine(e.Data); };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            if (!string.IsNullOrEmpty(input))
            {
                await process.StandardInput.WriteLineAsync(input);
                await process.StandardInput.FlushAsync();
            }
            process.StandardInput.Close();

            var cts = new CancellationTokenSource();
            cts.CancelAfter(15000);

            try
            {
                await process.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                try { process.Kill(true); } catch { }
                result.Output = output.ToString();
                result.Error = "Execution timeout (15 seconds)";
                result.Success = false;
                return result;
            }

            result.Output = output.ToString();
            result.Error = errorOutput.ToString();
            result.ExitCode = process.ExitCode;
            result.Success = process.ExitCode == 0;

            if (!result.Success && string.IsNullOrEmpty(result.Error))
            {
                result.Error = $"Program exited with code: {process.ExitCode}";
            }
        }
        catch (Exception ex)
        {
            result.Error = $"Exception: {ex.Message}";
            result.Success = false;
        }
        finally
        {
            try
            {
                if (Directory.Exists(tempDir))
                {
                    Directory.Delete(tempDir, true);
                }
            }
            catch { }
        }

        return result;
    }

    public class RunRequest
    {
        public string? Language { get; set; }
        public string? Code { get; set; }
        public string? Input { get; set; }
    }

    public class RunResult
    {
        public string Output { get; set; } = "";
        public string Error { get; set; } = "";
        public int ExitCode { get; set; }
        public bool Success { get; set; }
    }
}