import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { readProjectFile, resolveProjectPath } from "../core/project.js";
import { detectInstalledVersions, resolveInstallation } from "./installation.js";

export interface RecentItem {
  name: string;
  author: string;
  description: string;
  thumbnail: number;
  filename: string;
  last_opened: number;
  pinned: boolean;
}

export interface RecentMidata {
  list: RecentItem[];
}

export function getDelphiNow(): number {
  // Days since December 30, 1899
  const unixEpochDays = 25569.0;
  const msPerDay = 86400000.0;
  return Date.now() / msPerDay + unixEpochDays;
}

export function stageProjectForLaunch(
  projectPathInput: string,
  options?: {
    dataDir?: string;
    mineimatorExe?: string;
    launchNow?: boolean;
    pinned?: boolean;
  }
): {
  success: boolean;
  stagedFile: string;
  recentMidataPath: string;
  launched: boolean;
  processPid?: number;
  message: string;
} {
  const resolvedProject = resolveProjectPath(projectPathInput);
  if (!fs.existsSync(resolvedProject)) {
    throw new Error(`Project file does not exist: ${resolvedProject}`);
  }

  // Load project details for metadata
  let projectName = path.basename(resolvedProject, ".miproject");
  let author = "";
  let description = "";

  try {
    const proj = readProjectFile(resolvedProject);
    if (proj.project?.name) projectName = proj.project.name;
    if (proj.project?.author) author = proj.project.author;
    if (proj.project?.description) description = proj.project.description;
  } catch {
    // Fall back to filename
  }

  // Resolve installation and candidate data dirs
  const primaryInstallation = resolveInstallation({
    dataDir: options?.dataDir,
    mineimatorExe: options?.mineimatorExe,
  });

  const allInstallations = detectInstalledVersions();
  const targetDataDirs = new Set<string>();

  if (options?.dataDir) {
    targetDataDirs.add(options.dataDir);
  } else {
    targetDataDirs.add(primaryInstallation.dataDir);
    for (const inst of allInstallations) {
      targetDataDirs.add(inst.dataDir);
    }
  }

  // Windows path formatting
  const formattedProjectFile = resolvedProject.replace(/\//g, "\\");

  const newEntry: RecentItem = {
    name: projectName,
    author,
    description,
    thumbnail: 0,
    filename: formattedProjectFile,
    last_opened: getDelphiNow(),
    pinned: options?.pinned ?? true,
  };

  let primaryRecentPath = path.join(primaryInstallation.dataDir, "recent.midata");

  // Stage across all target directories
  for (const dir of targetDataDirs) {
    const recentPath = path.join(dir, "recent.midata");
    let recentData: RecentMidata = { list: [] };

    if (fs.existsSync(recentPath)) {
      try {
        const content = fs.readFileSync(recentPath, "utf-8");
        recentData = JSON.parse(content) as RecentMidata;
        if (!Array.isArray(recentData.list)) {
          recentData.list = [];
        }
      } catch {
        recentData = { list: [] };
      }
    }

    // Remove existing entry if present
    recentData.list = recentData.list.filter(
      (item) =>
        item.filename.replace(/\//g, "\\").toLowerCase() !==
        formattedProjectFile.toLowerCase()
    );

    // Prepend to index 0
    recentData.list.unshift(newEntry);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(recentPath, JSON.stringify(recentData, null, "\t"), "utf-8");
      if (dir === primaryInstallation.dataDir || !primaryRecentPath) {
        primaryRecentPath = recentPath;
      }
    } catch {
      // Ignore write errors on non-primary directories
    }

    // Also update settings.midata recent_files if present
    const settingsPath = path.join(dir, "settings.midata");
    if (fs.existsSync(settingsPath)) {
      try {
        const sRaw = fs.readFileSync(settingsPath, "utf-8");
        const sData = JSON.parse(sRaw);
        if (Array.isArray(sData.recent_files)) {
          sData.recent_files = sData.recent_files.filter(
            (rf: any) =>
              (rf.filename || "").replace(/\//g, "\\").toLowerCase() !==
              formattedProjectFile.toLowerCase()
          );
          sData.recent_files.unshift({
            filename: formattedProjectFile.replace(/\\/g, "/"),
            name: projectName,
            author,
            description,
          });
          fs.writeFileSync(settingsPath, JSON.stringify(sData, null, "\t"), "utf-8");
        }
      } catch {
        // Ignore settings update error
      }
    }
  }

  let launched = false;
  let pid: number | undefined;

  if (options?.launchNow) {
    const exePath = options?.mineimatorExe || primaryInstallation.executablePath;
    if (fs.existsSync(exePath)) {
      const child = spawn(exePath, [formattedProjectFile], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      launched = true;
      pid = child.pid;
    }
  }

  return {
    success: true,
    stagedFile: formattedProjectFile,
    recentMidataPath: primaryRecentPath,
    launched,
    processPid: pid,
    message: `Project '${projectName}' successfully staged at slot 0 for ${primaryInstallation.name}.${
      launched ? ` Launched with PID ${pid}.` : ""
    }`,
  };
}
