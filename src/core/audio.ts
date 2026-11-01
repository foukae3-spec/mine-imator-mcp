import * as fs from "node:fs";
import * as path from "node:path";
import {
  MiProject,
  ResourceNode,
  TimelineNode,
  TransitionType,
} from "../types/miproject.js";
import { insertKeyframe } from "./animation.js";
import { createDefaultInheritanceSettings } from "./defaults.js";
import { save_id_create } from "./id.js";

export function createSilentWavBuffer(
  durationSeconds: number = 0.5,
  sampleRate: number = 22050
): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const buf = Buffer.alloc(totalSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(totalSize - 8, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

export function ensureSoundAssetExists(
  projectDir: string,
  soundFilename: string
): string {
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  const destPath = path.join(projectDir, soundFilename);
  if (fs.existsSync(destPath)) {
    return destPath;
  }

  const candidateOggs = [
    "C:/Users/RocKeR/Mine-imator Vexel Build/Data/Audio/done.ogg",
    "C:/Users/RocKeR/Mine-imator Vexel Build/Data/Audio/startup.ogg",
  ];
  let copied = false;
  for (const c of candidateOggs) {
    if (fs.existsSync(c)) {
      try {
        fs.copyFileSync(c, destPath);
        copied = true;
        break;
      } catch {}
    }
  }

  if (!copied) {
    const wav = createSilentWavBuffer(0.5);
    fs.writeFileSync(destPath, wav);
  }

  return destPath;
}

export type VanillaSoundCue =
  | "tnt_primed"
  | "explode"
  | "flint_and_steel"
  | "orb"
  | "pop"
  | "anvil_land"
  | "sword_slash"
  | "teleport"
  | "bow_shoot"
  | "wither_spawn";

export const VANILLA_SOUND_FILES: Record<VanillaSoundCue, string> = {
  tnt_primed: "tnt_primed.ogg",
  explode: "explode.ogg",
  flint_and_steel: "flint_and_steel.ogg",
  orb: "orb.ogg",
  pop: "pop.ogg",
  anvil_land: "anvil_land.ogg",
  sword_slash: "sweep.ogg",
  teleport: "portal.ogg",
  bow_shoot: "bow.ogg",
  wither_spawn: "wither_spawn.ogg",
};

export interface AddAudioTrackOptions {
  soundFile: string;
  name?: string;
  startFrame?: number;
  volume?: number; // 0.0 to 1.0 (default 1.0)
  pitch?: number; // default 1.0
  projectDir?: string;
}

export interface TriggerSFXOptions {
  soundCue: VanillaSoundCue | string;
  frame: number;
  volume?: number;
  pitch?: number;
  name?: string;
  timelineId?: string;
  projectDir?: string;
}

export interface VolumeKeyframe {
  frame: number;
  volume: number;
  transition?: TransitionType;
}

/**
 * Adds an audio resource and a dedicated audio timeline track to the project.
 */
export function addAudioTrack(
  project: MiProject,
  options: AddAudioTrackOptions
): {
  success: boolean;
  resourceId: string;
  timelineId: string;
  filename: string;
} {
  const startFrame = options.startFrame ?? 0;
  if (startFrame < 0) {
    throw new Error("startFrame cannot be negative");
  }

  const vol = Math.max(0, Math.min(1, options.volume ?? 1));
  const pitch = options.pitch ?? 1;

  if (options.projectDir) {
    ensureSoundAssetExists(options.projectDir, options.soundFile);
  }

  const resourceId = save_id_create();
  const timelineId = save_id_create();

  const resourceNode: ResourceNode = {
    id: resourceId,
    type: "sound",
    filename: options.soundFile,
  };

  const rootIndex = project.timelines.filter((t) => t.parent === "root").length;

  const audioTimeline: TimelineNode = {
    id: timelineId,
    type: "audio",
    name: options.name || `Audio Track (${options.soundFile})`,
    temp: "null",
    color_tag: "null",
    hide: false,
    lock: false,
    ghost: false,
    depth: 0,
    default_values: {
      SOUND_VOLUME: vol,
      SOUND_PITCH: pitch,
      SOUND_START: 0,
      SOUND_END: 1,
    },
    keyframes: {},
    parent: "root",
    parent_tree_index: rootIndex,
    lock_bend: true,
    tree_extend: false,
    inherit: createDefaultInheritanceSettings(false),
    scale_resize: false,
  };

  insertKeyframe(audioTimeline, startFrame, {
    SOUND_OBJ: resourceId,
    SOUND_VOLUME: vol,
    SOUND_PITCH: pitch,
    TRANSITION: "instant",
  });

  project.resources.push(resourceNode);
  project.timelines.push(audioTimeline);

  return {
    success: true,
    resourceId,
    timelineId,
    filename: options.soundFile,
  };
}

/**
 * Triggers a vanilla sound effect cue or custom audio file at a specific frame.
 */
export function triggerSFX(
  project: MiProject,
  options: TriggerSFXOptions
): {
  success: boolean;
  soundCue: string;
  frame: number;
  resourceId: string;
  timelineId: string;
} {
  if (options.frame < 0) {
    throw new Error("frame cannot be negative");
  }

  const soundCue = options.soundCue.toLowerCase();
  const soundFile =
    VANILLA_SOUND_FILES[soundCue as VanillaSoundCue] ||
    (soundCue.endsWith(".ogg") || soundCue.endsWith(".wav") || soundCue.endsWith(".mp3")
      ? soundCue
      : `${soundCue}.ogg`);

  if (options.projectDir) {
    ensureSoundAssetExists(options.projectDir, soundFile);
  }

  const vol = Math.max(0, Math.min(1, options.volume ?? 1));
  const pitch = options.pitch ?? 1;

  // Check if resource already exists to reuse it
  let resource = project.resources.find(
    (r) => r.type === "sound" && r.filename === soundFile
  );

  let resourceId = resource?.id;
  if (!resourceId) {
    resourceId = save_id_create();
    project.resources.push({
      id: resourceId,
      type: "sound",
      filename: soundFile,
    });
  }

  // Find or create SFX timeline track
  let timeline: TimelineNode | undefined;
  if (options.timelineId) {
    timeline = project.timelines.find((t) => t.id === options.timelineId);
  }

  if (!timeline) {
    const timelineId = save_id_create();
    const rootIndex = project.timelines.filter((t) => t.parent === "root").length;

    timeline = {
      id: timelineId,
      type: "audio",
      name: options.name || `SFX_${soundCue}`,
      temp: "null",
      color_tag: "null",
      hide: false,
      lock: false,
      ghost: false,
      depth: 0,
      default_values: {
        SOUND_VOLUME: vol,
        SOUND_PITCH: pitch,
        SOUND_START: 0,
        SOUND_END: 1,
      },
      keyframes: {},
      parent: "root",
      parent_tree_index: rootIndex,
      lock_bend: true,
      tree_extend: false,
      inherit: createDefaultInheritanceSettings(false),
      scale_resize: false,
    };
    project.timelines.push(timeline);
  }

  insertKeyframe(timeline, options.frame, {
    SOUND_OBJ: resourceId,
    SOUND_VOLUME: vol,
    SOUND_PITCH: pitch,
    TRANSITION: "instant",
  });

  return {
    success: true,
    soundCue,
    frame: options.frame,
    resourceId,
    timelineId: timeline.id,
  };
}

/**
 * Injects volume envelopes (fade-in, fade-out, ducking) into an audio timeline.
 */
export function applyVolumeEnvelope(
  timeline: TimelineNode,
  envelope: VolumeKeyframe[]
): { keyframesAdded: number } {
  let count = 0;
  for (const kf of envelope) {
    insertKeyframe(timeline, kf.frame, {
      SOUND_VOLUME: Math.max(0, Math.min(1, kf.volume)),
      TRANSITION: kf.transition || "linear",
    });
    count++;
  }
  return { keyframesAdded: count };
}

/**
 * Creates an audio ducking envelope (e.g. lowering BGM volume around a loud SFX explosion).
 */
export function createDuckingEnvelope(
  duckStartFrame: number,
  duckEndFrame: number,
  normalVolume: number = 1.0,
  duckedVolume: number = 0.2,
  transitionFrames: number = 8
): VolumeKeyframe[] {
  return [
    { frame: Math.max(0, duckStartFrame - transitionFrames), volume: normalVolume, transition: "easeinoutquad" },
    { frame: duckStartFrame, volume: duckedVolume, transition: "linear" },
    { frame: duckEndFrame, volume: duckedVolume, transition: "easeinoutquad" },
    { frame: duckEndFrame + transitionFrames, volume: normalVolume, transition: "linear" },
  ];
}
