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

function createNativeParticleType(
  id: string,
  name: string,
  scale: number,
  color: string,
  speed: [number, number, number] = [0, 0, 10]
) {
  return {
    id,
    name,
    temp_type: "template",
    text: "",
    spawn_rate: 1,
    sprite_tex: "default",
    sprite_tex_image: 0,
    sprite_template_tex: "default",
    sprite_template: "generic",
    sprite_template_still_frame: false,
    sprite_template_random_frame: false,
    sprite_template_reverse: true,
    sprite_frame_width: 8,
    sprite_frame_height: 8,
    sprite_frame_start: 7,
    sprite_frame_end: 0,
    sprite_animation_speed: 5,
    sprite_animation_speed_israndom: false,
    sprite_animation_speed_random_min: 5,
    sprite_animation_speed_random_max: 10,
    sprite_animation_onend: 0,
    angle_extend: false,
    angle: [0, 0, 0],
    angle_israndom: [1, 1, 1],
    angle_random_min: [0, 0, 0],
    angle_random_max: [360, 360, 360],
    angle_speed: 0,
    angle_speed_israndom: 0,
    angle_speed_random_min: 0,
    angle_speed_random_max: 20,
    angle_speed_add: 0,
    angle_speed_add_israndom: 0,
    angle_speed_add_random_min: -1,
    angle_speed_add_random_max: 1,
    angle_speed_mul: 1,
    angle_speed_mul_israndom: 0,
    angle_speed_mul_random_min: 0.75,
    angle_speed_mul_random_max: 0.9,
    spd_extend: false,
    spd: speed,
    spd_israndom: [1, 1, 1],
    spd_random_min: [-10, -10, 0],
    spd_random_max: [10, 10, 20],
    spd_add: [0, 0, 0],
    spd_add_israndom: [0, 0, 0],
    spd_add_random_min: [-1, -1, -1],
    spd_add_random_max: [1, 1, 1],
    spd_mul: [0.9, 0.9, 0.9],
    spd_mul_israndom: [0, 0, 0],
    spd_mul_random_min: [0.75, 0.75, 0.75],
    spd_mul_random_max: [0.9, 0.9, 0.9],
    rot_extend: false,
    rot: [0, 0, 0],
    rot_israndom: [1, 1, 1],
    rot_random_min: [0, 0, 0],
    rot_random_max: [360, 360, 360],
    rot_spd_extend: false,
    rot_spd: [0, 0, 0],
    rot_spd_israndom: [1, 1, 1],
    rot_spd_random_min: [-180, -180, -180],
    rot_spd_random_max: [180, 180, 180],
    rot_spd_add: [0, 0, 0],
    rot_spd_add_israndom: [0, 0, 0],
    rot_spd_add_random_min: [-10, -10, -10],
    rot_spd_add_random_max: [10, 10, 10],
    rot_spd_mul: [1, 1, 1],
    rot_spd_mul_israndom: [0, 0, 0],
    rot_spd_mul_random_min: [0.75, 0.75, 0.75],
    rot_spd_mul_random_max: [0.9, 0.9, 0.9],
    sprite_angle: 0,
    sprite_angle_israndom: false,
    sprite_angle_random_min: 0,
    sprite_angle_random_max: 360,
    sprite_angle_add: 0,
    sprite_angle_add_israndom: false,
    sprite_angle_add_random_min: -90,
    sprite_angle_add_random_max: 90,
    scale: scale,
    scale_israndom: false,
    scale_random_min: 0.5,
    scale_random_max: 2,
    scale_add: 0,
    scale_add_israndom: false,
    scale_add_random_min: -0.2,
    scale_add_random_max: -0.1,
    alpha: 1,
    alpha_israndom: false,
    alpha_random_min: 0,
    alpha_random_max: 1,
    alpha_add: 0,
    alpha_add_israndom: false,
    alpha_add_random_min: -0.1,
    alpha_add_random_max: -0.05,
    color: color,
    color_israndom: false,
    color_random_start: "#808080",
    color_random_end: "#FFFFFF",
    color_mix_enabled: false,
    color_mix: "#000000",
    color_mix_israndom: false,
    color_mix_random_start: "#808080",
    color_mix_random_end: "#FFFFFF",
    color_mix_time: 3,
    color_mix_time_israndom: false,
    color_mix_time_random_min: 1,
    color_mix_time_random_max: 5,
    spawn_region: true,
    bounding_box: true,
    bounce: true,
    bounce_factor: 0.5,
    orbit: false,
  };
}

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

  // 1. Create Particle Template Node with verified native Mine-imator particle type
  const particleTypeId = save_id_create();
  const particleTypeNode = createNativeParticleType(
    particleTypeId,
    preset.particleName,
    config.particleScale ?? preset.scale,
    config.particleColor ?? preset.color ?? "#FFFFFF"
  );

  const templateNode: TemplateNode = {
    id: templateId,
    type: "particles",
    name: config.name || preset.templateName,
    particles: {
      spawn_constant: true,
      spawn_amount: spawnRate,
      spawn_region_use: false,
      spawn_region_type: "sphere",
      spawn_region_sphere_radius: 100,
      spawn_region_cube_size: 200,
      spawn_region_box_size: [200, 200, 200],
      spawn_region_path_radius: 8,
      bounding_box_type: "none",
      bounding_box_ground_z: 0,
      bounding_box_custom_start: [-100, -100, -100],
      bounding_box_custom_end: [100, 100, 100],
      bounding_box_relative: false,
      destroy_at_animation_finish: true,
      destroy_at_amount: true,
      destroy_at_amount_val: 200,
      destroy_at_time: true,
      destroy_at_time_seconds: 5,
      destroy_at_time_israndom: false,
      destroy_at_time_random_min: 3,
      destroy_at_time_random_max: 8,
      destroy_at_bounding_box: 0,
      types: [particleTypeNode],
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
