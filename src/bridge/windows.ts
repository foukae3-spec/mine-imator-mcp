import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveProjectPath } from "../core/project.js";
import { resolveInstallation } from "./installation.js";
import { stageProjectForLaunch } from "./recent.js";

export interface CaptureViewportResult {
  success: boolean;
  outputPath: string;
  fileSizeBytes: number;
  width?: number;
  height?: number;
  message: string;
}

export interface LiveReloadResult {
  success: boolean;
  projectPath: string;
  reloaded: boolean;
  mode: string;
  previewImagePath?: string;
  processPid?: number;
  message: string;
}

function runPowerShell(script: string, timeoutMs: number = 15000): string {
  const tempPs = path.join(
    os.tmpdir(),
    `mi_ps_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`
  );
  try {
    fs.writeFileSync(tempPs, script, "utf-8");
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tempPs],
      {
        encoding: "utf-8",
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    if (result.error) {
      throw result.error;
    }
    if (result.stderr && result.stderr.trim()) {
      console.error("PowerShell STDERR:", result.stderr);
    }
    return (result.stdout || "").trim();
  } finally {
    try {
      if (fs.existsSync(tempPs)) {
        fs.unlinkSync(tempPs);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

function toBase64String(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

export function captureMineimatorViewport(
  outputPath?: string,
  windowTitle: string = "Mine-imator",
  showRuleOfThirds: boolean = false
): CaptureViewportResult {
  const targetOut = outputPath || path.join(process.cwd(), "live_preview.png");
  const resolvedOut = path.resolve(targetOut);
  const outDir = path.dirname(resolvedOut);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const b64Title = toBase64String(windowTitle);
  const b64OutPath = toBase64String(resolvedOut);

  // Cross-desktop Win32 PrintWindow / GDI capture script: composites Direct3D 11 swapchains via DWM
  const psScript = `
$ProgressPreference = 'SilentlyContinue'
$targetTitle = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Title}'))
$outPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64OutPath}'))
$showOverlay = [bool]::Parse('${showRuleOfThirds ? "True" : "False"}')

$sig = @'
using System;
using System.Text;
using System.Drawing;
using System.Drawing.Imaging;
using System.Threading;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class CrossDesktopCapture {
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenWindowStation(string a, bool b, uint c);
    [DllImport("user32.dll")] public static extern bool SetProcessWindowStation(IntPtr h);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, int dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll")] public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr hDesktop);
    public delegate bool CallBackPtr(IntPtr hwnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int EnumDesktopWindows(IntPtr hDesktop, CallBackPtr callPtr, IntPtr lPar);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public static string ExecuteCapture(string queryTitle, string outFilePath, bool showOverlay) {
        string res = "ERROR: Window not found";
        Thread t = new Thread(() => {
            IntPtr hWinsta = OpenWindowStation("winsta0", false, 0x037F);
            if (hWinsta != IntPtr.Zero) SetProcessWindowStation(hWinsta);
            IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) {
                res = "ERROR: OpenDesktop failed";
                return;
            }
            if (!SetThreadDesktop(hDesk)) {
                res = "ERROR: SetThreadDesktop failed";
                CloseDesktop(hDesk);
                return;
            }

            IntPtr foundHwnd = IntPtr.Zero;
            string foundTitle = "";

            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                try {
                    var p = System.Diagnostics.Process.GetProcessById((int)pid);
                    if (p.ProcessName.IndexOf("Mine-imator", StringComparison.OrdinalIgnoreCase) < 0) {
                        return true; // Skip non-Mine-imator processes (Explorer, Chrome, etc.)
                    }
                } catch { return true; }

                var sb = new StringBuilder(512);
                GetWindowText(hWnd, sb, 512);
                string title = sb.ToString();
                if (!string.IsNullOrEmpty(title)) {
                    if (title.IndexOf("Mine-imator", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        title.IndexOf(queryTitle, StringComparison.OrdinalIgnoreCase) >= 0) {
                        foundHwnd = hWnd;
                        foundTitle = title;
                        return false;
                    }
                }
                return true;
            }, IntPtr.Zero);

            if (foundHwnd == IntPtr.Zero) {
                CloseDesktop(hDesk);
                return;
            }

            if (IsIconic(foundHwnd)) {
                ShowWindow(foundHwnd, 9); // SW_RESTORE
                Thread.Sleep(250);
            }

            // Unlock foreground activation in Windows interactive session
            keybd_event(0x12, 0, 0, 0); // Alt down
            keybd_event(0x12, 0, 2, 0); // Alt up

            IntPtr fg = GetForegroundWindow();
            uint unusedPid;
            uint fgThread = GetWindowThreadProcessId(fg, out unusedPid);
            uint curThread = GetCurrentThreadId();
            if (fgThread != curThread && fgThread != 0) {
                AttachThreadInput(curThread, fgThread, true);
            }

            SetWindowPos(foundHwnd, (IntPtr)(-1) /*HWND_TOPMOST*/, 0, 0, 0, 0, 0x0001 | 0x0002);
            SetWindowPos(foundHwnd, (IntPtr)(-2) /*HWND_NOTOPMOST*/, 0, 0, 0, 0, 0x0001 | 0x0002);
            BringWindowToTop(foundHwnd);
            SetForegroundWindow(foundHwnd);
            SwitchToThisWindow(foundHwnd, true);
            ShowWindow(foundHwnd, 5); // SW_SHOW

            if (fgThread != curThread && fgThread != 0) {
                AttachThreadInput(curThread, fgThread, false);
            }
            Thread.Sleep(400);

            RECT r;
            GetWindowRect(foundHwnd, out r);
            int w = r.Right - r.Left;
            int h = r.Bottom - r.Top;
            if (w <= 0 || h <= 0) {
                res = "ERROR: Invalid window bounds";
                CloseDesktop(hDesk);
                return;
            }

            using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb)) {
                using (Graphics g = Graphics.FromImage(bmp)) {
                    IntPtr hdc = g.GetHdc();
                    bool pwSuccess = false;
                    try {
                        // PrintWindow with PW_RENDERFULLCONTENT (0x02) composites Direct3D 11 hardware flip-model swapchains via DWM
                        pwSuccess = PrintWindow(foundHwnd, hdc, 0x00000002);
                        if (!pwSuccess) {
                            pwSuccess = PrintWindow(foundHwnd, hdc, 0x00000000);
                        }
                    } catch {
                        pwSuccess = false;
                    } finally {
                        if (hdc != IntPtr.Zero) {
                            g.ReleaseHdc(hdc);
                        }
                    }

                    if (!pwSuccess) {
                        try {
                            g.CopyFromScreen(r.Left, r.Top, 0, 0, new Size(w, h));
                        } catch {}
                    }

                    // Optional Rule-of-Thirds HUD grid overlay + power point markers
                    if (showOverlay) {
                        float x1 = w / 3.0f;
                        float x2 = 2.0f * w / 3.0f;
                        float y1 = h / 3.0f;
                        float y2 = 2.0f * h / 3.0f;

                        using (Pen gridPen = new Pen(Color.FromArgb(160, 255, 255, 255), 1.5f)) {
                            gridPen.DashStyle = System.Drawing.Drawing2D.DashStyle.Dash;
                            g.DrawLine(gridPen, x1, 0, x1, h);
                            g.DrawLine(gridPen, x2, 0, x2, h);
                            g.DrawLine(gridPen, 0, y1, w, y1);
                            g.DrawLine(gridPen, 0, y2, w, y2);
                        }

                        using (Pen markPen = new Pen(Color.FromArgb(220, 255, 215, 0), 2.0f)) {
                            float sz = 8.0f;
                            float[][] pts = new float[][] {
                                new float[] { x1, y1 }, new float[] { x1, y2 },
                                new float[] { x2, y1 }, new float[] { x2, y2 }
                            };
                            foreach (var pt in pts) {
                                g.DrawEllipse(markPen, pt[0] - sz / 2, pt[1] - sz / 2, sz, sz);
                            }
                        }
                    }
                }
                bmp.Save(outFilePath, ImageFormat.Png);
            }

            res = "OK:" + w + ":" + h + ":" + foundTitle;
            CloseDesktop(hDesk);
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return res;
    }
}
'@

Add-Type -TypeDefinition $sig -ReferencedAssemblies System.Drawing
[CrossDesktopCapture]::ExecuteCapture($targetTitle, $outPath, $showOverlay)
`;

  try {
    const output = runPowerShell(psScript, 12000);

    if (output.startsWith("OK:")) {
      const parts = output.split(":");
      const w = parseInt(parts[1], 10);
      const h = parseInt(parts[2], 10);
      const winTitle = parts.slice(3).join(":");
      const stat = fs.statSync(resolvedOut);
      return {
        success: true,
        outputPath: resolvedOut,
        fileSizeBytes: stat.size,
        width: w,
        height: h,
        message: `Captured ${winTitle || "Mine-imator"} viewport (${w}x${h}) successfully.`,
      };
    } else {
      return {
        success: false,
        outputPath: resolvedOut,
        fileSizeBytes: 0,
        message: output || "Mine-imator window not active",
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      outputPath: resolvedOut,
      fileSizeBytes: 0,
      message: `Failed to capture Mine-imator viewport: ${msg}`,
    };
  }
}

export function openViaDrop(
  projectPathInput: string,
  timeoutMs: number = 8000,
  dataDir?: string,
  windowTitle: string = "Mine-imator"
): { success: boolean; message: string; processFound: boolean } {
  const resolvedProject = resolveProjectPath(projectPathInput);
  if (!fs.existsSync(resolvedProject)) {
    throw new Error(`Project file does not exist: ${resolvedProject}`);
  }

  // Stage project across all installations so it's guaranteed at slot 0
  stageProjectForLaunch(resolvedProject, { dataDir, launchNow: false });

  const b64Title = toBase64String(windowTitle);
  const formattedProjectFile = resolvedProject.replace(/\//g, "\\");
  const b64Proj = toBase64String(formattedProjectFile);

  // PowerShell check, activate window across desktop stations, and send WM_DROPFILES with deadlock prevention
  const psScript = `
$ProgressPreference = 'SilentlyContinue'
$targetTitle = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Title}'))
$projPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Proj}'))

$sig = @'
using System;
using System.Text;
using System.IO;
using System.Threading;
using System.Runtime.InteropServices;

public class CrossDesktopFocus {
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenWindowStation(string a, bool b, uint c);
    [DllImport("user32.dll")] public static extern bool SetProcessWindowStation(IntPtr h);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, int dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll")] public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr hDesktop);
    public delegate bool CallBackPtr(IntPtr hwnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int EnumDesktopWindows(IntPtr hDesktop, CallBackPtr callPtr, IntPtr lPar);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(
        IntPtr hWnd,
        uint Msg,
        IntPtr wParam,
        IntPtr lParam,
        uint fuFlags,
        uint uTimeout,
        out IntPtr lpdwResult
    );
    [DllImport("user32.dll")] public static extern bool EnumThreadWindows(uint dwThreadId, CallBackPtr lpfn, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr GlobalAlloc(uint uFlags, UIntPtr dwBytes);
    [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr GlobalLock(IntPtr hMem);
    [DllImport("kernel32.dll", SetLastError = true)] public static extern bool GlobalUnlock(IntPtr hMem);
    [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr GlobalFree(IntPtr hMem);

    public const uint SMTO_ABORTIFHUNG = 0x0002;
    public const uint WM_DROPFILES = 0x0233;
    public const uint WM_CLOSE = 0x0010;
    public const uint WM_KEYDOWN = 0x0100;
    public const uint WM_KEYUP = 0x0101;
    public const int VK_ESCAPE = 0x1B;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DROPFILES {
        public int pFiles;
        public POINT pt;
        [MarshalAs(UnmanagedType.Bool)]
        public bool fNC;
        [MarshalAs(UnmanagedType.Bool)]
        public bool fWide;
    }

    public static void DismissModalDialogs(uint threadId, IntPtr mainHwnd) {
        if (threadId == 0) return;
        EnumThreadWindows(threadId, (hWnd, lParam) => {
            if (hWnd == mainHwnd) return true;

            var sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            var sbText = new StringBuilder(256);
            GetWindowText(hWnd, sbText, 256);
            string cls = sbClass.ToString();
            string txt = sbText.ToString();

            bool isDialog = cls.IndexOf("Dialog", StringComparison.OrdinalIgnoreCase) >= 0 ||
                            cls.IndexOf("Popup", StringComparison.OrdinalIgnoreCase) >= 0 ||
                            cls == "#32770" ||
                            cls.IndexOf("QWindowPopupSaveBits", StringComparison.OrdinalIgnoreCase) >= 0 ||
                            ((cls.IndexOf("Qt", StringComparison.OrdinalIgnoreCase) >= 0 || cls == "#32770") &&
                             (txt.IndexOf("Save", StringComparison.OrdinalIgnoreCase) >= 0 ||
                              txt.IndexOf("Unsaved", StringComparison.OrdinalIgnoreCase) >= 0 ||
                              txt.IndexOf("Changes", StringComparison.OrdinalIgnoreCase) >= 0));

            if (isDialog) {
                // Synthesize escape key and WM_CLOSE to safely dismiss prompt without blocking
                PostMessage(hWnd, WM_KEYDOWN, (IntPtr)VK_ESCAPE, IntPtr.Zero);
                PostMessage(hWnd, WM_KEYUP, (IntPtr)VK_ESCAPE, IntPtr.Zero);
                PostMessage(hWnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
            }
            return true;
        }, IntPtr.Zero);
    }

    public static string ActivateAndDrop(string queryTitle, string filePath) {
        string res = "NOT_RUNNING";
        Thread t = new Thread(() => {
            IntPtr hWinsta = OpenWindowStation("winsta0", false, 0x037F);
            if (hWinsta != IntPtr.Zero) SetProcessWindowStation(hWinsta);
            IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) {
                CloseDesktop(hDesk);
                return;
            }

            IntPtr targetHwnd = IntPtr.Zero;
            string foundProcessName = "";
            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                try {
                    var p = System.Diagnostics.Process.GetProcessById((int)pid);
                    if (p.ProcessName.IndexOf("Mine-imator", StringComparison.OrdinalIgnoreCase) < 0) {
                        return true; // Skip non-Mine-imator processes (Explorer, Chrome, etc.)
                    }
                    foundProcessName = p.ProcessName;
                } catch { return true; }

                var sb = new StringBuilder(512);
                GetWindowText(hWnd, sb, 512);
                string tStr = sb.ToString();
                if (!string.IsNullOrEmpty(tStr) &&
                   (tStr.IndexOf("Mine-imator", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    tStr.IndexOf(queryTitle, StringComparison.OrdinalIgnoreCase) >= 0)) {
                    targetHwnd = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);

            if (targetHwnd != IntPtr.Zero) {
                if (IsIconic(targetHwnd)) {
                    ShowWindow(targetHwnd, 9); // SW_RESTORE
                    Thread.Sleep(200);
                }

                keybd_event(0x12, 0, 0, 0); // Alt down
                keybd_event(0x12, 0, 2, 0); // Alt up

                IntPtr fg = GetForegroundWindow();
                uint unusedPid;
                uint fgThread = GetWindowThreadProcessId(fg, out unusedPid);
                uint curThread = GetCurrentThreadId();
                if (fgThread != curThread && fgThread != 0) {
                    AttachThreadInput(curThread, fgThread, true);
                }

                SetWindowPos(targetHwnd, (IntPtr)(-1) /*HWND_TOPMOST*/, 0, 0, 0, 0, 0x0001 | 0x0002);
                SetWindowPos(targetHwnd, (IntPtr)(-2) /*HWND_NOTOPMOST*/, 0, 0, 0, 0, 0x0001 | 0x0002);
                BringWindowToTop(targetHwnd);
                SetForegroundWindow(targetHwnd);
                SwitchToThisWindow(targetHwnd, true);
                ShowWindow(targetHwnd, 5); // SW_SHOW

                if (fgThread != curThread && fgThread != 0) {
                    AttachThreadInput(curThread, fgThread, false);
                }
                Thread.Sleep(250);

                uint targetProcessId;
                uint targetThreadId = GetWindowThreadProcessId(targetHwnd, out targetProcessId);

                // Dismiss any lingering modal prompts before drop
                DismissModalDialogs(targetThreadId, targetHwnd);

                // Send WM_DROPFILES to the active Mine-imator window with timeout protection
                if (!string.IsNullOrEmpty(filePath) && File.Exists(filePath)) {
                    try {
                        byte[] pathRaw = Encoding.Unicode.GetBytes(filePath);
                        byte[] pathBytes = new byte[pathRaw.Length + 4]; // double null-terminated (4 zero bytes in UTF-16)
                        Buffer.BlockCopy(pathRaw, 0, pathBytes, 0, pathRaw.Length);

                        int structSize = Marshal.SizeOf(typeof(DROPFILES));
                        int totalBytes = structSize + pathBytes.Length;

                        IntPtr hGlobal = GlobalAlloc(0x0042 /* GMEM_MOVEABLE | GMEM_ZEROINIT */, (UIntPtr)totalBytes);
                        if (hGlobal != IntPtr.Zero) {
                            IntPtr pMem = GlobalLock(hGlobal);
                            if (pMem != IntPtr.Zero) {
                                DROPFILES df = new DROPFILES();
                                df.pFiles = structSize;
                                df.pt = new POINT { x = 200, y = 200 };
                                df.fNC = false;
                                df.fWide = true;

                                Marshal.StructureToPtr(df, pMem, false);
                                Marshal.Copy(pathBytes, 0, new IntPtr(pMem.ToInt64() + structSize), pathBytes.Length);
                                GlobalUnlock(hGlobal);

                                // Background watcher thread to dismiss any confirmation dialog spawned by the drop
                                Thread watcher = new Thread(() => {
                                    Thread.Sleep(150);
                                    DismissModalDialogs(targetThreadId, targetHwnd);
                                });
                                watcher.IsBackground = true;
                                watcher.Start();

                                IntPtr result;
                                IntPtr sendRet = SendMessageTimeout(
                                    targetHwnd,
                                    WM_DROPFILES,
                                    hGlobal,
                                    IntPtr.Zero,
                                    SMTO_ABORTIFHUNG,
                                    3000,
                                    out result
                                );

                                if (sendRet == IntPtr.Zero) {
                                    // Timed out or hung: post message asynchronously as fallback
                                    PostMessage(targetHwnd, WM_DROPFILES, hGlobal, IntPtr.Zero);
                                }
                            }
                        }
                    } catch {}
                }

                res = "RUNNING:" + foundProcessName;
            }
            CloseDesktop(hDesk);
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return res;
    }
}
'@

Add-Type -TypeDefinition $sig
[CrossDesktopFocus]::ActivateAndDrop($targetTitle, $projPath)
`;

  try {
    const res = runPowerShell(psScript, timeoutMs);
    const isRunning = res.includes("RUNNING") && !res.includes("NOT_RUNNING");
    return {
      success: true,
      processFound: isRunning,
      message: isRunning
        ? `Mine-imator window brought to foreground and project drop posted. Project staged at slot 0 for seamless load.`
        : `Project staged at slot 0 in recent.midata. Mine-imator is not currently running; start Mine-imator to open the staged project.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      processFound: false,
      message: `Drop/activation error: ${msg}`,
    };
  }
}

export function liveReloadAutomation(
  projectPathInput: string,
  options?: {
    mode?: "auto" | "relaunch" | "drop" | "focus";
    dataDir?: string;
    mineimatorExe?: string;
    captureAfter?: boolean;
  }
): LiveReloadResult {
  const resolvedProject = resolveProjectPath(projectPathInput);
  if (!fs.existsSync(resolvedProject)) {
    throw new Error(`Project file does not exist: ${resolvedProject}`);
  }

  const inst = resolveInstallation({
    dataDir: options?.dataDir,
    mineimatorExe: options?.mineimatorExe,
  });

  // 1. Stage across all installations
  stageProjectForLaunch(resolvedProject, {
    dataDir: options?.dataDir,
    mineimatorExe: options?.mineimatorExe,
    launchNow: false,
  });

  const mode = options?.mode || "auto";
  const formattedProjectFile = resolvedProject.replace(/\//g, "\\");
  const b64Exe = toBase64String(inst.executablePath);
  const b64Proj = toBase64String(formattedProjectFile);
  const b64ProcName = toBase64String(inst.processName);

  let reloaded = false;
  let pid: number | undefined;

  const isRunning = inst.isRunning;

  if (mode === "relaunch" || mode === "auto" || (!isRunning && (mode === "drop" || mode === "focus"))) {
    // Launch or cleanly relaunch with ShellExecute
    const psRelaunchScript = `
$ProgressPreference = 'SilentlyContinue'
$procName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64ProcName}'))
$exePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Exe}'))
$projPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Proj}'))
$exeDir = Split-Path -Parent $exePath

# If relaunch requested or auto reload, terminate existing instances
Get-Process | Where-Object { $_.ProcessName -like "*Mine-imator*" } | ForEach-Object {
    try {
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    } catch {}
}

Start-Sleep -Milliseconds 400

if (Test-Path -LiteralPath $exePath) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exePath
    $psi.WorkingDirectory = $exeDir
    $psi.Arguments = ('"' + $projPath + '"')
    $psi.UseShellExecute = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    Start-Sleep -Milliseconds 2500
    Write-Output "LAUNCHED:$($p.Id)"
} else {
    Write-Output "EXE_NOT_FOUND"
}
`;

    try {
      const out = runPowerShell(psRelaunchScript, 10000);
      if (out.includes("LAUNCHED:")) {
        reloaded = true;
        const match = out.match(/LAUNCHED:(\d+)/);
        if (match) pid = parseInt(match[1], 10);
      }
    } catch {
      reloaded = false;
    }
  } else {
    // Already running: bring to foreground and post drop / focus staged project
    const dropRes = openViaDrop(resolvedProject, 5000, options?.dataDir);
    reloaded = dropRes.success && dropRes.processFound;
  }

  // Optional preview capture
  let previewPath: string | undefined;
  if (options?.captureAfter !== false) {
    const previewOut = path.join(path.dirname(resolvedProject), "live_preview.png");
    try {
      const cap = captureMineimatorViewport(previewOut);
      if (cap.success) {
        previewPath = cap.outputPath;
      }
    } catch {
      // Ignore preview capture failures during reload
    }
  }

  return {
    success: true,
    projectPath: resolvedProject,
    reloaded,
    mode,
    previewImagePath: previewPath,
    processPid: pid,
    message: reloaded
      ? `Project live-reloaded in ${inst.name} (PID: ${pid || "active"}). Changes are now visible live.`
      : `Project staged for ${inst.name}. Bring Mine-imator window to foreground or relaunch to view changes.`,
  };
}

export function exportVideoAutomation(
  projectPathInput: string,
  outputPath: string,
  format: "mp4" | "wmv" | "png_sequence" = "mp4",
  includeAudio: boolean = true,
  mineimatorExe?: string,
  dataDir?: string
): {
  success: boolean;
  staged: boolean;
  outputPath: string;
  automationStatus: string;
} {
  const resolvedProject = resolveProjectPath(projectPathInput);
  const resolvedOut = path.resolve(outputPath);

  const inst = resolveInstallation({ dataDir, mineimatorExe });

  // Stage project so Mine-imator loads it directly
  const stageResult = stageProjectForLaunch(resolvedProject, {
    dataDir: inst.dataDir,
    mineimatorExe: inst.executablePath,
    launchNow: false,
  });

  const message = `Project staged for export to '${resolvedOut}'. Format: ${format}, Audio: ${includeAudio}. Note: Mine-imator desktop requires GUI export dialog confirmation or patched CLI binary. Project is staged at slot 0 for ${inst.name}.`;

  return {
    success: true,
    staged: stageResult.success,
    outputPath: resolvedOut,
    automationStatus: message,
  };
}
