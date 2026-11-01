import {
  MiProject,
  TemplateNode,
  TimelineNode,
} from "../types/miproject.js";
import { insertKeyframe } from "./animation.js";
import { createDefaultInheritanceSettings } from "./defaults.js";
import { save_id_create } from "./id.js";

export type ParticleEmitterType =
  | "fire_plume"
  | "black_smoke_column"
  | "explosion_burst"
  | "xp_dissolve_orbs"
  | "orbital_laser_beam"
  | "custom";

export interface ParticleEmitterConfig {
  name: string;
  type: ParticleEmitterType;
  position: [number, number, number];
  startFrame?: number;
  durationFrames?: number;
  spawnRate?: number;
  particleColor?: string;
  particleScale?: number;
}

export interface ParticlePresetDefinition {
  templateName: string;
  particleName: string;
  defaultSpawnRate: number;
  scale: number;
  color?: string;
}

export const PARTICLE_PRESETS: Record<ParticleEmitterType, ParticlePresetDefinition> = {
  fire_plume: {
    templateName: "Fire Plume FX",
    particleName: "flame",
    defaultSpawnRate: 35,
    scale: 1.5,
    color: "#FFAA00",
  },
  black_smoke_column: {
    templateName: "Black Smoke Column FX",
    particleName: "largesmoke",
    defaultSpawnRate: 25,
    scale: 2.2,
    color: "#222222",
  },
  explosion_burst: {
    templateName: "Explosion Burst FX",
    particleName: "explosion",
    defaultSpawnRate: 150,
    scale: 3.5,
    color: "#FFFFFF",
  },
  xp_dissolve_orbs: {
    templateName: "XP Dissolve Orbs FX",
    particleName: "orb",
    defaultSpawnRate: 40,
    scale: 0.8,
    color: "#AAFF00",
  },
  orbital_laser_beam: {
    templateName: "Orbital Laser Beam FX",
    particleName: "end_rod",
    defaultSpawnRate: 200,
    scale: 2.0,
    color: "#00FFFF",
  },
  custom: {
    templateName: "Custom Particle Emitter",
    particleName: "flame",
    defaultSpawnRate: 30,
    scale: 1.0,
  },
};

/**
 * Spawns a native Mine-imator particle emitter into the project.
 */
export function spawnParticleEmitter(
  project: MiProject,
  config: ParticleEmitterConfig
): {
  success: boolean;
  timelineId: string;
  templateId: string;
  emitterType: string;
  name: string;
} {
  const preset = PARTICLE_PRESETS[config.type] || PARTICLE_PRESETS.custom;
  const templateId = save_id_create();
  const timelineId = save_id_create();

  const spawnRate = config.spawnRate ?? preset.defaultSpawnRate;

  // 1. Create Particle Template Node
  const templateNode: TemplateNode = {
    id: templateId,
    type: "particles",
    name: config.name || preset.templateName,
    particles: {
      spawn_rate: spawnRate,
      types: [
        {
          name: preset.particleName,
          temp: "null",
          tex: "default",
          scale: config.particleScale ?? preset.scale,
          color: config.particleColor ?? preset.color ?? "#FFFFFF",
        },
      ],
    },
  };

  // 2. Create Particle Timeline Node
  const rootIndex = project.timelines.filter((t) => t.parent === "root").length;
  const pos = config.position;

  const timelineNode: TimelineNode = {
    id: timelineId,
    type: "particles",
    name: config.name || `${preset.templateName} Spawner`,
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
      ROT_X: 0,
      ROT_Y: 0,
      ROT_Z: 0,
      SPAWN: true,
      FREEZE: false,
      CLEAR: false,
    },
    keyframes: {},
    parent: "root",
    parent_tree_index: rootIndex,
    lock_bend: true,
    tree_extend: false,
    inherit: createDefaultInheritanceSettings(false),
    scale_resize: false,
  };

  const startFrame = config.startFrame ?? 0;
  insertKeyframe(timelineNode, startFrame, {
    POS_X: pos[0],
    POS_Y: pos[1],
    POS_Z: pos[2],
    SPAWN: true,
  });

  if (config.durationFrames && config.durationFrames > 0) {
    const endFrame = startFrame + config.durationFrames;
    insertKeyframe(timelineNode, endFrame, {
      SPAWN: false,
      CLEAR: false,
    });
  }

  project.templates.push(templateNode);
  project.timelines.push(timelineNode);

  return {
    success: true,
    timelineId,
    templateId,
    emitterType: config.type,
    name: timelineNode.name,
  };
}

export function createFirePlumeEmitter(
  project: MiProject,
  pos: [number, number, number],
  intensity: number = 35,
  name: string = "Fire Plume"
) {
  return spawnParticleEmitter(project, {
    name,
    type: "fire_plume",
    position: pos,
    spawnRate: intensity,
  });
}

export function createSmokeColumnEmitter(
  project: MiProject,
  pos: [number, number, number],
  height: number = 40,
  name: string = "Black Smoke Column"
) {
  return spawnParticleEmitter(project, {
    name,
    type: "black_smoke_column",
    position: pos,
    spawnRate: height,
  });
}

export function createExplosionBurstEmitter(
  project: MiProject,
  pos: [number, number, number],
  startFrame: number = 0,
  name: string = "Explosion Burst"
) {
  return spawnParticleEmitter(project, {
    name,
    type: "explosion_burst",
    position: pos,
    startFrame,
    durationFrames: 24,
    spawnRate: 200,
  });
}

export function createXPDissolveEmitter(
  project: MiProject,
  pos: [number, number, number],
  startFrame: number = 0,
  name: string = "XP Dissolve"
) {
  return spawnParticleEmitter(project, {
    name,
    type: "xp_dissolve_orbs",
    position: pos,
    startFrame,
    durationFrames: 48,
  });
}

export function createOrbitalLaserBeam(
  project: MiProject,
  targetPos: [number, number, number],
  color: string = "#00FFFF",
  startFrame: number = 0,
  durationFrames: number = 60,
  name: string = "Orbital Laser"
) {
  return spawnParticleEmitter(project, {
    name,
    type: "orbital_laser_beam",
    position: targetPos,
    startFrame,
    durationFrames,
    particleColor: color,
    spawnRate: 250,
  });
}
