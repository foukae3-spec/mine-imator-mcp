import {
  MiProject,
  TemplateNode,
  TimelineNode,
} from "../types/miproject.js";
import { createDefaultInheritanceSettings } from "./defaults.js";
import { save_id_create } from "./id.js";

export interface BlockSpec {
  name: string;
  position: [number, number, number];
  state?: Record<string, string>;
  repeat?: [number, number, number];
}

export type StructurePresetName =
  | "cottage_porch"
  | "birch_forest_hill"
  | "ruined_cottage"
  | "griefer_skybase"
  | "bedrock_void";

/**
 * Builds an authentic Minecraft cottage porch:
 * Oak plank porch platform, oak fence railings, hanging lanterns, cobblestone steps, flower beds with Blue Orchids.
 */
export function buildCottagePorch(origin: [number, number, number]): BlockSpec[] {
  const [ox, oy, oz] = origin;
  const blocks: BlockSpec[] = [];

  // 1. Porch floor: 5x4 oak planks (16 units per block)
  blocks.push({
    name: "oak_planks",
    position: [ox - 32, oy - 16, oz],
    repeat: [5, 4, 1],
  });

  // 2. Cobblestone steps at front
  blocks.push({
    name: "cobblestone",
    position: [ox - 16, oy - 32, oz],
    repeat: [3, 1, 1],
  });

  // 3. Oak fence railings along left, right, and back
  // Left railing
  for (let y = -16; y <= 32; y += 16) {
    blocks.push({
      name: "oak_fence",
      position: [ox - 32, oy + y, oz + 16],
    });
  }
  // Right railing
  for (let y = -16; y <= 32; y += 16) {
    blocks.push({
      name: "oak_fence",
      position: [ox + 32, oy + y, oz + 16],
    });
  }
  // Back wall railing / posts
  blocks.push({
    name: "oak_fence",
    position: [ox - 16, oy + 32, oz + 16],
  });
  blocks.push({
    name: "oak_fence",
    position: [ox + 16, oy + 32, oz + 16],
  });

  // 4. Lantern posts at front corners
  blocks.push({
    name: "oak_fence",
    position: [ox - 32, oy - 16, oz + 32],
  });
  blocks.push({
    name: "lantern",
    position: [ox - 32, oy - 16, oz + 48],
    state: { hanging: "true" },
  });

  blocks.push({
    name: "oak_fence",
    position: [ox + 32, oy - 16, oz + 32],
  });
  blocks.push({
    name: "lantern",
    position: [ox + 32, oy - 16, oz + 48],
    state: { hanging: "true" },
  });

  // 5. Flower beds at sides
  blocks.push({
    name: "grass_block",
    position: [ox - 48, oy - 16, oz],
    repeat: [1, 3, 1],
  });
  blocks.push({
    name: "blue_orchid",
    position: [ox - 48, oy - 16, oz + 16],
  });
  blocks.push({
    name: "blue_orchid",
    position: [ox - 48, oy, oz + 16],
  });
  blocks.push({
    name: "poppy",
    position: [ox - 48, oy + 16, oz + 16],
  });

  blocks.push({
    name: "grass_block",
    position: [ox + 48, oy - 16, oz],
    repeat: [1, 3, 1],
  });
  blocks.push({
    name: "dandelion",
    position: [ox + 48, oy - 16, oz + 16],
  });
  blocks.push({
    name: "blue_orchid",
    position: [ox + 48, oy, oz + 16],
  });

  return blocks;
}

/**
 * Builds a natural birch forest hill:
 * Stepped grass hill terrain, birch trees with authentic trunks and foliage, wildflowers.
 */
export function buildBirchForestHill(
  origin: [number, number, number],
  treeCount: number = 4
): BlockSpec[] {
  const [ox, oy, oz] = origin;
  const blocks: BlockSpec[] = [];

  // 1. Stepped hill terrain
  blocks.push({
    name: "grass_block",
    position: [ox - 64, oy - 64, oz],
    repeat: [9, 9, 1], // Base tier (144x144 units)
  });
  blocks.push({
    name: "grass_block",
    position: [ox - 48, oy - 48, oz + 16],
    repeat: [7, 7, 1], // Second tier
  });
  blocks.push({
    name: "grass_block",
    position: [ox - 32, oy - 32, oz + 32],
    repeat: [5, 5, 1], // Plateau
  });

  // 2. Birch trees with logs and leaf canopies
  const allOffsets: [number, number, number][] = [
    [-32, -16, 32],
    [16, -24, 32],
    [-24, 24, 32],
    [24, 16, 32],
  ];
  const treeOffsets = allOffsets.slice(0, Math.max(1, treeCount));

  for (const [tx, ty, tz] of treeOffsets) {
    const wx = ox + tx;
    const wy = oy + ty;
    const wz = oz + tz;

    // Trunk: 4 birch logs
    blocks.push({
      name: "birch_log",
      position: [wx, wy, wz + 16],
      repeat: [1, 1, 4],
    });

    // Foliage: 3x3 leaves at trunk top
    blocks.push({
      name: "birch_leaves",
      position: [wx - 16, wy - 16, wz + 64],
      repeat: [3, 3, 1],
    });
    // Top foliage cross
    blocks.push({
      name: "birch_leaves",
      position: [wx, wy, wz + 80],
    });
  }

  // 3. Wildflowers
  blocks.push({ name: "dandelion", position: [ox - 16, oy, oz + 48] });
  blocks.push({ name: "poppy", position: [ox + 16, oy - 16, oz + 48] });
  blocks.push({ name: "cornflower", position: [ox, oy + 16, oz + 48] });

  return blocks;
}

/**
 * Builds a charred, destroyed cottage ruin:
 * Burnt dark oak pillars, charred cobblestone fireplace, rubble slabs, ash/coal ground, fire blocks.
 */
export function buildRuinedCottage(origin: [number, number, number]): BlockSpec[] {
  const [ox, oy, oz] = origin;
  const blocks: BlockSpec[] = [];

  // 1. Ash and charred foundation
  blocks.push({
    name: "coal_block",
    position: [ox - 48, oy - 32, oz],
    repeat: [6, 5, 1],
  });
  blocks.push({
    name: "blackstone",
    position: [ox - 32, oy - 16, oz],
    repeat: [4, 3, 1],
  });

  // 2. Ruined fireplace / chimney
  blocks.push({
    name: "cobblestone",
    position: [ox - 16, oy + 32, oz + 16],
    repeat: [2, 1, 3],
  });
  blocks.push({
    name: "netherrack",
    position: [ox - 16, oy + 16, oz + 16],
  });
  blocks.push({
    name: "fire",
    position: [ox - 16, oy + 16, oz + 32],
  });

  // 3. Burnt pillar stumps (broken dark oak logs)
  // Corner 1: intact stump
  blocks.push({
    name: "dark_oak_log",
    position: [ox - 48, oy - 32, oz + 16],
    repeat: [1, 1, 3],
  });
  // Corner 2: short burnt stump
  blocks.push({
    name: "dark_oak_log",
    position: [ox + 32, oy - 32, oz + 16],
    repeat: [1, 1, 1],
  });
  // Corner 3: broken burnt stump
  blocks.push({
    name: "dark_oak_log",
    position: [ox + 32, oy + 32, oz + 16],
    repeat: [1, 1, 2],
  });

  // 4. Scattered dark oak slabs and rubble
  blocks.push({
    name: "dark_oak_slab",
    position: [ox - 32, oy, oz + 16],
  });
  blocks.push({
    name: "dark_oak_slab",
    position: [ox, oy - 16, oz + 16],
  });
  blocks.push({
    name: "dark_oak_slab",
    position: [ox + 16, oy + 16, oz + 16],
  });

  return blocks;
}

/**
 * Builds a griefer flex skybase platform:
 * Diamond blocks, obsidian platform, chest arrays, flowing lava column, TNT stockpiles.
 */
export function buildGrieferSkybase(origin: [number, number, number]): BlockSpec[] {
  const [ox, oy, oz] = origin;
  const blocks: BlockSpec[] = [];

  // 1. High diamond block and obsidian floating platform (6x6)
  blocks.push({
    name: "diamond_block",
    position: [ox - 48, oy - 48, oz],
    repeat: [6, 6, 1],
  });
  // Obsidian inner rim
  blocks.push({
    name: "obsidian",
    position: [ox - 32, oy - 32, oz + 16],
    repeat: [4, 4, 1],
  });

  // 2. Chest arrays for stolen loot
  blocks.push({
    name: "chest",
    position: [ox - 32, oy + 16, oz + 32],
    repeat: [4, 1, 1],
  });

  // 3. TNT stockpile
  blocks.push({
    name: "tnt",
    position: [ox + 16, oy - 32, oz + 32],
    repeat: [2, 2, 2],
  });

  // 4. Flowing lava trap column
  blocks.push({
    name: "lava",
    position: [ox - 48, oy, oz],
    repeat: [1, 1, 1],
  });

  // 5. Gold & Beacon pedestal
  blocks.push({
    name: "gold_block",
    position: [ox, oy, oz + 32],
  });
  blocks.push({
    name: "beacon",
    position: [ox, oy, oz + 48],
  });

  return blocks;
}

/**
 * Builds the bedrock void pedestal:
 * Bedrock base grid with a solitary centered grass block pedestal.
 */
export function buildBedrockVoid(origin: [number, number, number]): BlockSpec[] {
  const [ox, oy, oz] = origin;
  const blocks: BlockSpec[] = [];

  // 1. Bedrock void floor (7x7)
  blocks.push({
    name: "bedrock",
    position: [ox - 48, oy - 48, oz],
    repeat: [7, 7, 1],
  });

  // 2. Solitary central pedestal
  blocks.push({
    name: "bedrock",
    position: [ox, oy, oz + 16],
  });
  blocks.push({
    name: "grass_block",
    position: [ox, oy, oz + 32],
  });
  blocks.push({
    name: "poppy",
    position: [ox, oy, oz + 48],
  });

  return blocks;
}

export const STRUCTURE_BUILDERS: Record<
  StructurePresetName,
  (origin: [number, number, number]) => BlockSpec[]
> = {
  cottage_porch: buildCottagePorch,
  birch_forest_hill: buildBirchForestHill,
  ruined_cottage: buildRuinedCottage,
  griefer_skybase: buildGrieferSkybase,
  bedrock_void: buildBedrockVoid,
};

/**
 * Spawns a procedural structure preset into a Mine-imator project at a given origin.
 */
export function spawnStructure(
  project: MiProject,
  presetName: StructurePresetName,
  origin: [number, number, number]
): {
  success: boolean;
  preset: string;
  blocksAdded: number;
  timelineIds: string[];
} {
  const builder = STRUCTURE_BUILDERS[presetName];
  if (!builder) {
    throw new Error(
      `Unknown structure preset: '${presetName}'. Available: ${Object.keys(
        STRUCTURE_BUILDERS
      ).join(", ")}`
    );
  }

  const blockSpecs = builder(origin);
  const timelineIds: string[] = [];

  let rootIndex = project.timelines.filter((t) => t.parent === "root").length;

  for (const block of blockSpecs) {
    const templateId = save_id_create();
    const timelineId = save_id_create();

    const templateNode: TemplateNode = {
      id: templateId,
      type: "block",
      name: "",
      block: {
        name: block.name,
        state: block.state || {},
        tex: "default",
        repeat_enable: !!block.repeat,
        repeat: block.repeat || [1, 1, 1],
      },
    };

    const timelineNode: TimelineNode = {
      id: timelineId,
      type: "block",
      name: block.name,
      temp: templateId,
      color_tag: "null",
      hide: false,
      lock: false,
      ghost: false,
      depth: 0,
      block: {
        name: block.name,
        state: block.state || {},
      },
      default_values: {
        POS_X: block.position[0],
        POS_Y: block.position[1],
        POS_Z: block.position[2],
        ROT_X: 0,
        ROT_Y: 0,
        ROT_Z: 0,
      },
      keyframes: {},
      parent: "root",
      parent_tree_index: rootIndex++,
      lock_bend: true,
      tree_extend: false,
      inherit: createDefaultInheritanceSettings(false),
      scale_resize: false,
      shadows: true,
      ssao: true,
      fog: true,
      blend_mode: "normal",
    };

    project.templates.push(templateNode);
    project.timelines.push(timelineNode);
    timelineIds.push(timelineId);
  }

  return {
    success: true,
    preset: presetName,
    blocksAdded: blockSpecs.length,
    timelineIds,
  };
}

export interface SceneSetOptions {
  name: string;
  setId: string;
  origin: [number, number, number];
  structurePreset?: StructurePresetName;
  createCamera?: boolean;
}

export interface SceneSetManifest {
  name: string;
  setId: string;
  origin: [number, number, number];
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  structurePreset?: string;
  blockCount: number;
  cameraId?: string;
}

/**
 * Creates a segregated physical scene set at specified world coordinates,
 * spawning its architecture and optionally a dedicated shot camera.
 */
export function createSceneSet(
  project: MiProject,
  options: SceneSetOptions
): SceneSetManifest {
  let blockCount = 0;
  if (options.structurePreset) {
    const res = spawnStructure(project, options.structurePreset, options.origin);
    blockCount = res.blocksAdded;
  }

  let cameraId: string | undefined;

  if (options.createCamera) {
    cameraId = save_id_create();
    const rootIndex = project.timelines.filter((t) => t.parent === "root").length;

    // Place camera 60 units back and 25 units up from origin looking at origin
    const camPos: [number, number, number] = [
      options.origin[0],
      options.origin[1] - 65,
      options.origin[2] + 28,
    ];

    const cameraNode: TimelineNode = {
      id: cameraId,
      type: "camera",
      name: `Cam_${options.name.replace(/\s+/g, "_")}`,
      temp: "null",
      color_tag: "null",
      hide: false,
      lock: false,
      ghost: false,
      depth: 0,
      default_values: {
        POS_X: camPos[0],
        POS_Y: camPos[1],
        POS_Z: camPos[2],
        ROT_X: 18,
        ROT_Y: 0,
        ROT_Z: 0,
        CAM_FOV: 45,
      },
      keyframes: {},
      parent: "root",
      parent_tree_index: rootIndex,
      lock_bend: true,
      tree_extend: false,
      inherit: createDefaultInheritanceSettings(false),
      scale_resize: false,
    };

    project.timelines.push(cameraNode);
  }

  return {
    name: options.name,
    setId: options.setId,
    origin: options.origin,
    bounds: {
      min: [options.origin[0] - 80, options.origin[1] - 80, options.origin[2]],
      max: [options.origin[0] + 80, options.origin[1] + 80, options.origin[2] + 120],
    },
    structurePreset: options.structurePreset,
    blockCount,
    cameraId,
  };
}
