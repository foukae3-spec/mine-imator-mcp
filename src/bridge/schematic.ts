import * as fs from "node:fs";
import * as path from "node:path";
import { createDefaultInheritanceSettings } from "../core/defaults.js";
import { save_id_create } from "../core/id.js";
import { readProjectFile, resolveProjectPath, writeProjectFile } from "../core/project.js";
import { ResourceNode, TemplateNode, TimelineNode } from "../types/miproject.js";

export interface ImportSchematicOptions {
  project_path: string;
  schematic_path: string;
  name?: string;
  position?: [number, number, number];
  copy_to_project?: boolean;
}

export function importSchematic(options: ImportSchematicOptions): {
  resourceId: string;
  templateId: string;
  timelineId: string;
  schematicFileName: string;
} {
  const projectFile = resolveProjectPath(options.project_path);
  const project = readProjectFile(projectFile);
  const projectDir = path.dirname(projectFile);

  const sourceSchematic = path.resolve(options.schematic_path);
  if (!fs.existsSync(sourceSchematic)) {
    throw new Error(`Schematic file not found at: ${sourceSchematic}`);
  }

  const baseName = path.basename(sourceSchematic);
  let targetRelativeFilename = baseName;

  if (options.copy_to_project !== false) {
    const targetPath = path.join(projectDir, baseName);
    if (path.resolve(targetPath) !== sourceSchematic) {
      fs.copyFileSync(sourceSchematic, targetPath);
    }
    // Also copy companion .meshcache if it exists
    const companionMeshcache = `${sourceSchematic}.meshcache`;
    if (fs.existsSync(companionMeshcache)) {
      const targetMeshcache = path.join(projectDir, `${baseName}.meshcache`);
      if (path.resolve(targetMeshcache) !== companionMeshcache) {
        fs.copyFileSync(companionMeshcache, targetMeshcache);
      }
    }
  } else {
    targetRelativeFilename = sourceSchematic;
  }

  const resourceId = save_id_create();
  const templateId = save_id_create();
  const timelineId = save_id_create();

  const formattedFilename = targetRelativeFilename.replace(/\//g, "\\");

  const resourceNode: ResourceNode = {
    id: resourceId,
    type: "schematic",
    filename: formattedFilename,
    scenery_tl_add: true,
  };

  const templateNode: TemplateNode = {
    id: templateId,
    type: "scenery",
    name: options.name || path.basename(baseName, path.extname(baseName)),
    scenery: resourceId,
    block: {
      tex: "default",
      repeat_enable: false,
      repeat: [1, 1, 1],
    },
  };

  const pos = options.position || [0, 0, 0];
  const rootIndex = project.timelines.filter((t) => t.parent === "root").length;

  const timelineNode: TimelineNode = {
    id: timelineId,
    type: "scenery",
    name: options.name || "",
    temp: templateId,
    color_tag: "null",
    hide: false,
    lock: false,
    ghost: false,
    depth: 0,
    default_values: {
      POS_X: pos[0],
      POS_Y: pos[1],
      POS_Z: pos[2],
    },
    keyframes: {},
    parent: "root",
    parent_tree_index: rootIndex,
    lock_bend: true,
    tree_extend: false,
    inherit: createDefaultInheritanceSettings(false),
    scale_resize: true,
  };

  project.resources.push(resourceNode);
  project.templates.push(templateNode);
  project.timelines.push(timelineNode);

  writeProjectFile(projectFile, project);

  return {
    resourceId,
    templateId,
    timelineId,
    schematicFileName: targetRelativeFilename,
  };
}
