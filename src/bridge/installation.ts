import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

export interface MineimatorInstallation {
  name: string;
  flavor: "vexel" | "standard" | "custom";
  appDir: string;
  dataDir: string;
  executablePath: string;
  projectsDir: string;
  processName: string;
  isRunning: boolean;
  defaultAssetVersion: string;
}

const KNOWN_CANDIDATES = [
  {
    name: "Mine-imator Vexel Build",
    flavor: "vexel" as const,
    appDir: "C:\\Users\\RocKeR\\Mine-imator Vexel Build",
    executableName: "Mine-imator Vexel Build.exe",
    processName: "Mine-imator Vexel Build",
    defaultAssetVersion: "26.3",
  },
  {
    name: "Mine-imator Standard 2.0.2",
    flavor: "standard" as const,
    appDir: "D:\\Mine-imator",
    executableName: "Mine-imator.exe",
    processName: "Mine-imator",
    defaultAssetVersion: "1.20.2",
  },
];

function isProcessRunning(processName: string): boolean {
  try {
    const cmd = `powershell.exe -NoProfile -Command "@(Get-Process | Where-Object { $_.ProcessName -like '*${processName}*' }).Count"`;
    const count = parseInt(execSync(cmd, { encoding: "utf-8", timeout: 3000 }).trim(), 10);
    return !isNaN(count) && count > 0;
  } catch {
    return false;
  }
}

export function detectInstalledVersions(): MineimatorInstallation[] {
  const list: MineimatorInstallation[] = [];

  for (const c of KNOWN_CANDIDATES) {
    const exe = path.join(c.appDir, c.executableName);
    const data = path.join(c.appDir, "Data");
    const proj = path.join(c.appDir, "Projects");

    if (fs.existsSync(exe) || fs.existsSync(data)) {
      // Find highest available Minecraft asset version in this data directory
      let assetVer = c.defaultAssetVersion;
      const mcDir = path.join(data, "Minecraft");
      if (fs.existsSync(mcDir)) {
        const files = fs.readdirSync(mcDir).filter((f) => f.endsWith(".midata"));
        if (files.length > 0) {
          // Sort descending
          files.sort().reverse();
          assetVer = files[0].replace(/\.midata$/, "");
        }
      }

      list.push({
        name: c.name,
        flavor: c.flavor,
        appDir: c.appDir,
        dataDir: data,
        executablePath: exe,
        projectsDir: proj,
        processName: c.processName,
        isRunning: isProcessRunning(c.processName),
        defaultAssetVersion: assetVer,
      });
    }
  }

  return list;
}

export function resolveInstallation(options?: {
  dataDir?: string;
  mineimatorExe?: string;
}): MineimatorInstallation {
  const detected = detectInstalledVersions();

  // If explicit exe or dataDir provided:
  if (options?.mineimatorExe || options?.dataDir) {
    const customExe = options.mineimatorExe || (options.dataDir ? path.join(options.dataDir, "..", "Mine-imator.exe") : "");
    const customData = options.dataDir || (options.mineimatorExe ? path.join(path.dirname(options.mineimatorExe), "Data") : "");
    const customApp = path.dirname(customExe || customData);

    const match = detected.find(
      (d) =>
        d.dataDir.toLowerCase() === customData.toLowerCase() ||
        d.executablePath.toLowerCase() === customExe.toLowerCase()
    );

    if (match) {
      return match;
    }

    return {
      name: "Custom Mine-imator Installation",
      flavor: "custom",
      appDir: customApp,
      dataDir: customData,
      executablePath: customExe,
      projectsDir: path.join(customApp, "Projects"),
      processName: path.basename(customExe, ".exe") || "Mine-imator",
      isRunning: false,
      defaultAssetVersion: "1.20.2",
    };
  }

  // Priority 1: Pick currently running installation (e.g. Vexel Build if user has it open)
  const running = detected.find((d) => d.isRunning);
  if (running) {
    return running;
  }

  // Priority 2: Vexel Build if present
  const vexel = detected.find((d) => d.flavor === "vexel");
  if (vexel) {
    return vexel;
  }

  // Priority 3: First available detected
  if (detected.length > 0) {
    return detected[0];
  }

  // Fallback defaults
  return {
    name: "Mine-imator Standard 2.0.2 (Default)",
    flavor: "standard",
    appDir: "D:\\Mine-imator",
    dataDir: "D:\\Mine-imator\\Data",
    executablePath: "D:\\Mine-imator\\Mine-imator.exe",
    projectsDir: "D:\\Mine-imator\\Projects",
    processName: "Mine-imator",
    isRunning: false,
    defaultAssetVersion: "1.20.2",
  };
}
