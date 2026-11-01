import * as fs from "node:fs";
import * as path from "node:path";
import { MiProject } from "../types/miproject.js";
import {
  createDefaultBackgroundSettings,
  createDefaultProjectSettings,
  createDefaultRenderSettings,
} from "./defaults.js";

export interface CreateProjectOptions {
  project_path: string;
  name?: string;
  author?: string;
  description?: string;
  tempo?: number;
  video_width?: number;
  video_height?: number;
  render_settings?: "performance" | "high" | "custom";
}

/**
 * Resolves the actual .miproject file path.
 * If given a directory or path without extension, handles project directory structure:
 * e.g., "Projects/MyProj" -> "Projects/MyProj/MyProj.miproject"
 */
export function resolveProjectPath(targetPath: string): string {
  const normalized = path.resolve(targetPath);
  if (normalized.endsWith(".miproject")) {
    return normalized;
  }
  
  // Check if it's an existing directory containing a .miproject file
  if (fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()) {
    const dirName = path.basename(normalized);
    const candidate = path.join(normalized, `${dirName}.miproject`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    // Search for any .miproject in the directory
    const files = fs.readdirSync(normalized);
    const found = files.find((f) => f.endsWith(".miproject"));
    if (found) {
      return path.join(normalized, found);
    }
    return candidate;
  }

  // Otherwise assume it's a folder to be created with ProjectName.miproject inside
  const baseName = path.basename(normalized);
  return path.join(normalized, `${baseName}.miproject`);
}

export function readProjectFile(targetPath: string): MiProject {
  const filePath = resolveProjectPath(targetPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Project file does not exist: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(content) as MiProject;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse .miproject JSON at ${filePath}: ${msg}`);
  }
}

export function writeProjectFile(targetPath: string, project: MiProject): string {
  const filePath = resolveProjectPath(targetPath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const json = JSON.stringify(project, null, "\t");
  fs.writeFileSync(filePath, json, "utf-8");
  return filePath;
}

export function createNewProject(options: CreateProjectOptions): {
  projectFilePath: string;
  project: MiProject;
} {
  const resolvedFile = resolveProjectPath(options.project_path);
  const projectName =
    options.name || path.basename(resolvedFile, ".miproject") || "New Project";

  const project: MiProject = {
    format: 34,
    created_in: "2.0.2",
    project: createDefaultProjectSettings(
      projectName,
      options.author || "",
      options.description || "",
      options.tempo ?? 24,
      options.video_width ?? 1280,
      options.video_height ?? 720,
      options.render_settings || "performance"
    ),
    render: createDefaultRenderSettings(options.render_settings || "performance"),
    background: createDefaultBackgroundSettings(),
    templates: [],
    timelines: [],
    resources: [],
  };

  const savedPath = writeProjectFile(resolvedFile, project);
  return { projectFilePath: savedPath, project };
}
