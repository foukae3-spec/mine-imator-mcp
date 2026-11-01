import {
  MiProject,
  TimelineNode,
  TransitionType,
} from "../types/miproject.js";
import { computeLookAtAngles, insertKeyframe } from "./animation.js";
import { createDefaultInheritanceSettings } from "./defaults.js";
import { save_id_create } from "./id.js";

export type FramingPreset =
  | "extreme_close_up"
  | "close_up"
  | "medium"
  | "wide"
  | "over_the_shoulder";

export interface FramingDefinition {
  name: FramingPreset;
  fov: number; // FOV in degrees
  distance: number; // distance in blocks/units
  elevationOffset: number; // camera height relative to subject center
  description: string;
}

export const FRAMING_PRESETS: Record<FramingPreset, FramingDefinition> = {
  extreme_close_up: {
    name: "extreme_close_up",
    fov: 25,
    distance: 10,
    elevationOffset: 24, // head level
    description: "Focal length 85mm equivalent. Tight crop on eyes/face for intense emotion.",
  },
  close_up: {
    name: "close_up",
    fov: 35,
    distance: 18,
    elevationOffset: 22,
    description: "Focal length 50mm equivalent. Head and shoulders framing for dialogue.",
  },
  medium: {
    name: "medium",
    fov: 45,
    distance: 36,
    elevationOffset: 16,
    description: "Focal length 35mm equivalent. Waist-up framing for physical gestures.",
  },
  wide: {
    name: "wide",
    fov: 65,
    distance: 80,
    elevationOffset: 20,
    description: "Focal length 24mm equivalent. Full body and environment establishing shot.",
  },
  over_the_shoulder: {
    name: "over_the_shoulder",
    fov: 38,
    distance: 22,
    elevationOffset: 24,
    description: "Two-character depth framing positioned behind foreground shoulder.",
  },
};

export interface CreateShotCameraOptions {
  name: string;
  subjectPos: [number, number, number];
  framing?: FramingPreset;
  angleYawDeg?: number; // horizontal angle around subject (0 = in front along -Y, 90 = side, etc.)
  customFov?: number;
  customDistance?: number;
  lookAtTarget?: [number, number, number];
  cameraPos?: [number, number, number];
}

/**
 * Creates a director camera timeline framed strictly according to Hollywood rules.
 */
export function createShotCamera(
  project: MiProject,
  options: CreateShotCameraOptions
): {
  success: boolean;
  cameraId: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
} {
  const framing = FRAMING_PRESETS[options.framing || "medium"];
  const fov = options.customFov ?? framing.fov;
  const dist = options.customDistance ?? framing.distance;
  const yawAngle = ((options.angleYawDeg ?? 0) * Math.PI) / 180;

  const subject = options.subjectPos;
  // If subject Z is near ground/feet (< 8), apply framing elevationOffset; otherwise subject Z is already the focal center
  const isFootOrigin = Math.abs(subject[2]) < 8;
  const targetZ = options.lookAtTarget ? options.lookAtTarget[2] : isFootOrigin ? subject[2] + framing.elevationOffset : subject[2];
  const camElevation = isFootOrigin ? framing.elevationOffset : 2;

  // Calculate camera position orbiting subject
  // Default (yaw 0) places camera in front of subject along -Y
  let camX = subject[0] + Math.sin(yawAngle) * dist;
  let camY = subject[1] - Math.cos(yawAngle) * dist;
  let camZ = subject[2] + camElevation;

  if (options.cameraPos) {
    [camX, camY, camZ] = options.cameraPos;
  }

  const camPos: [number, number, number] = [camX, camY, camZ];
  const target: [number, number, number] = options.lookAtTarget || [
    subject[0],
    subject[1],
    targetZ,
  ];

  const rot = computeLookAtAngles(camPos, target);

  const cameraId = save_id_create();
  const rootIndex = project.timelines.filter((t) => t.parent === "root").length;

  const cameraNode: TimelineNode = {
    id: cameraId,
    type: "camera",
    name: options.name,
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
      ROT_X: rot[0],
      ROT_Y: rot[1],
      ROT_Z: rot[2],
      CAM_FOV: fov,
    },
    keyframes: {},
    parent: "root",
    parent_tree_index: rootIndex,
    lock_bend: true,
    tree_extend: false,
    inherit: createDefaultInheritanceSettings(false),
    scale_resize: false,
  };

  insertKeyframe(cameraNode, 0, {
    POS_X: camPos[0],
    POS_Y: camPos[1],
    POS_Z: camPos[2],
    ROT_X: rot[0],
    ROT_Y: rot[1],
    ROT_Z: rot[2],
    CAM_FOV: fov,
    TRANSITION: "instant",
  });

  project.timelines.push(cameraNode);

  return {
    success: true,
    cameraId,
    name: options.name,
    position: camPos,
    rotation: rot,
    fov,
  };
}

export interface DollyZoomOptions {
  cameraTimelineId: string;
  subjectPos: [number, number, number];
  startFrame: number;
  endFrame: number;
  startDistance: number;
  endDistance: number;
  startFov?: number;
  transition?: TransitionType;
}

/**
 * Generates the Hitchcock vertigo / dolly zoom effect:
 * Moves camera distance while inversely scaling FOV so the foreground subject
 * remains fixed in size while background perspective contracts or expands.
 */
export function generateDollyZoom(
  timelines: TimelineNode[],
  options: DollyZoomOptions
): {
  success: boolean;
  keyframesAdded: number;
  endFov: number;
} {
  const camera = timelines.find((t) => t.id === options.cameraTimelineId);
  if (!camera) {
    throw new Error(`Camera timeline not found: ${options.cameraTimelineId}`);
  }

  const d0 = options.startDistance;
  const d1 = options.endDistance;
  if (d0 <= 0 || d1 <= 0) {
    throw new Error("Dolly zoom distances must be positive");
  }

  const fov0 = options.startFov ?? (camera.default_values?.CAM_FOV as number) ?? 45;
  const fov0Rad = (fov0 * Math.PI) / 180;

  // Subject size preservation formula:
  // d0 * tan(fov0 / 2) = d1 * tan(fov1 / 2)
  const tanHalfFov1 = (d0 / d1) * Math.tan(fov0Rad / 2);
  const fov1Rad = 2 * Math.atan(tanHalfFov1);
  const fov1 = (fov1Rad * 180) / Math.PI;

  const subject = options.subjectPos;
  const startFrame = options.startFrame;
  const endFrame = options.endFrame;
  const totalFrames = endFrame - startFrame;

  if (totalFrames <= 0) {
    throw new Error("endFrame must be greater than startFrame");
  }

  // Camera direction from subject: use current camera position if available
  const curX = (camera.default_values?.POS_X as number) || subject[0];
  const curY = (camera.default_values?.POS_Y as number) || subject[1] - d0;
  const curZ = (camera.default_values?.POS_Z as number) || subject[2] + 16;

  const dirX = curX - subject[0];
  const dirY = curY - subject[1];
  const dirZ = curZ - subject[2];
  const curDist = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;

  const unitDir: [number, number, number] = [
    dirX / curDist,
    dirY / curDist,
    dirZ / curDist,
  ];

  let count = 0;
  const steps = Math.max(2, Math.round(totalFrames / 6));

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const frame = Math.round(startFrame + u * totalFrames);
    const d = d0 + (d1 - d0) * u;

    // FOV at distance d
    const fovRad = 2 * Math.atan((d0 / d) * Math.tan(fov0Rad / 2));
    const fovDeg = (fovRad * 180) / Math.PI;

    const posX = subject[0] + unitDir[0] * d;
    const posY = subject[1] + unitDir[1] * d;
    const posZ = subject[2] + unitDir[2] * d;

    const rot = computeLookAtAngles([posX, posY, posZ], subject);

    insertKeyframe(camera, frame, {
      POS_X: posX,
      POS_Y: posY,
      POS_Z: posZ,
      ROT_X: rot[0],
      ROT_Y: rot[1],
      ROT_Z: rot[2],
      CAM_FOV: fovDeg,
      TRANSITION: options.transition || "easeinoutquad",
    });
    count++;
  }

  return {
    success: true,
    keyframesAdded: count,
    endFov: fov1,
  };
}

export interface CameraShakeOptions {
  cameraTimelineId: string;
  startFrame: number;
  durationFrames: number;
  magnitude?: number; // max rotational shake in degrees (default: 4.5)
  frequency?: number; // oscillations per frame (default: 0.6)
  decay?: "exponential" | "linear";
}

/**
 * Injects camera shake keyframes to simulate explosions, impacts, or tremors.
 */
export function addCameraShake(
  timelines: TimelineNode[],
  options: CameraShakeOptions
): {
  success: boolean;
  keyframesAdded: number;
} {
  const camera = timelines.find((t) => t.id === options.cameraTimelineId);
  if (!camera) {
    throw new Error(`Camera timeline not found: ${options.cameraTimelineId}`);
  }

  const startFrame = options.startFrame;
  const duration = options.durationFrames;
  if (duration <= 0) {
    throw new Error("durationFrames must be greater than 0");
  }

  const magnitude = options.magnitude ?? 4.5;
  const freq = options.frequency ?? 0.6;
  const decayMode = options.decay ?? "exponential";

  const baseRotX = (camera.default_values?.ROT_X as number) || 0;
  const baseRotZ = (camera.default_values?.ROT_Z as number) || 0;

  let count = 0;

  for (let f = 0; f <= duration; f += 2) {
    const frame = startFrame + f;
    const progress = f / duration;

    // Decay factor
    const factor =
      decayMode === "exponential"
        ? Math.exp(-3.5 * progress)
        : Math.max(0, 1 - progress);

    // Pseudo-random high-frequency vibration
    const shakeX = Math.sin(f * freq * 2 * Math.PI) * magnitude * factor;
    const shakeZ = Math.cos(f * freq * 2.3 * Math.PI) * magnitude * 0.8 * factor;

    insertKeyframe(camera, frame, {
      ROT_X: baseRotX + shakeX,
      ROT_Z: baseRotZ + shakeZ,
      TRANSITION: "linear",
    });
    count++;
  }

  // Restore base rotation at end
  insertKeyframe(camera, startFrame + duration + 1, {
    ROT_X: baseRotX,
    ROT_Z: baseRotZ,
    TRANSITION: "easeoutquad",
  });
  count++;

  return {
    success: true,
    keyframesAdded: count,
  };
}

export interface StoryboardShot {
  shotName: string;
  cameraId: string;
  startFrame: number;
  endFrame: number;
  description?: string;
}

export interface CameraCut {
  cameraId: string;
  startFrame: number;
  endFrame?: number;
  cameraName?: string;
}

/**
 * Sequences camera visibility keyframes across all cameras in the project.
 * Explicitly inserts VISIBLE: true for the active camera and VISIBLE: false for all
 * other cameras at each shot cut frame with transition: "instant".
 */
export function sequenceCameraCuts(
  project: MiProject,
  cuts: CameraCut[]
): {
  success: boolean;
  totalCuts: number;
  keyframesInserted: number;
  activeCameras: string[];
} {
  const allCameras = project.timelines.filter((t) => t.type === "camera");
  if (allCameras.length === 0) {
    return { success: true, totalCuts: 0, keyframesInserted: 0, activeCameras: [] };
  }

  const sortedCuts = [...cuts].sort((a, b) => a.startFrame - b.startFrame);
  let keyframesInserted = 0;
  const activeCameraIds = new Set<string>();

  for (let idx = 0; idx < sortedCuts.length; idx++) {
    const cut = sortedCuts[idx];
    const targetCam = allCameras.find(
      (c) => c.id === cut.cameraId || (cut.cameraName && c.name === cut.cameraName)
    );
    if (!targetCam) continue;

    activeCameraIds.add(targetCam.id);
    const cutFrame = cut.startFrame;

    // Active camera turns ON at cutFrame with instant transition
    insertKeyframe(targetCam, cutFrame, {
      VISIBLE: true,
      transition: "instant",
    });
    keyframesInserted++;

    // All other cameras turn OFF at cutFrame with instant transition
    for (const otherCam of allCameras) {
      if (otherCam.id !== targetCam.id) {
        insertKeyframe(otherCam, cutFrame, {
          VISIBLE: false,
          transition: "instant",
        });
        keyframesInserted++;
      }
    }

    // If cut has an explicit endFrame and is the last cut or next cut starts later:
    if (cut.endFrame !== undefined) {
      const nextCut = sortedCuts[idx + 1];
      if (!nextCut || nextCut.startFrame > cut.endFrame) {
        insertKeyframe(targetCam, cut.endFrame, {
          VISIBLE: false,
          transition: "instant",
        });
        keyframesInserted++;
      }
    }
  }

  return {
    success: true,
    totalCuts: sortedCuts.length,
    keyframesInserted,
    activeCameras: Array.from(activeCameraIds),
  };
}

/**
 * Compiles a multi-scene storyboard manifest into the project.
 * Validates shot boundaries, start/end frames, camera presence, persists storyboard metadata,
 * and automatically sequences VISIBLE: true/false instant cut keyframes across cameras.
 */
export function compileStoryboard(
  project: MiProject,
  shots: StoryboardShot[]
): {
  success: boolean;
  totalShots: number;
  shots: StoryboardShot[];
  timelineLength: number;
  cutsSequenced?: number;
} {
  if (!Array.isArray(shots)) {
    throw new Error("shots parameter must be an array");
  }

  const sortedShots = [...shots].sort((a, b) => a.startFrame - b.startFrame);
  let maxFrame = 0;

  for (const shot of sortedShots) {
    if (typeof shot.startFrame !== "number" || isNaN(shot.startFrame) || shot.startFrame < 0) {
      throw new Error(`Shot '${shot.shotName}' startFrame must be a non-negative number`);
    }
    if (typeof shot.endFrame !== "number" || isNaN(shot.endFrame) || shot.endFrame <= shot.startFrame) {
      throw new Error(
        `Shot '${shot.shotName}' endFrame (${shot.endFrame}) must be greater than startFrame (${shot.startFrame})`
      );
    }
    if (project.timelines && project.timelines.length > 0) {
      const cam = project.timelines.find((t) => t.id === shot.cameraId);
      if (!cam) {
        throw new Error(`Camera timeline '${shot.cameraId}' not found in project`);
      }
    }
    if (shot.endFrame > maxFrame) {
      maxFrame = shot.endFrame;
    }
  }

  // Embed compiled storyboard in project
  project.storyboard = sortedShots;
  if (!project.project) {
    project.project = {} as any;
  }
  if (!project.project.timeline) {
    project.project.timeline = {
      repeat: false,
      seamless_repeat: false,
      marker: 0,
      list_width: 320,
      hor_scroll: 0,
      zoom: 1,
      region_start: null,
      region_end: null,
    };
  }
  if (sortedShots.length > 0) {
    project.project.timeline.region_start = String(sortedShots[0].startFrame);
    project.project.timeline.region_end = String(maxFrame);
  }

  // Automatically sequence camera VISIBLE cuts across shot boundaries
  const cutsResult = sequenceCameraCuts(
    project,
    sortedShots.map((s) => ({
      cameraId: s.cameraId,
      startFrame: s.startFrame,
      endFrame: s.endFrame,
    }))
  );

  return {
    success: true,
    totalShots: sortedShots.length,
    shots: sortedShots,
    timelineLength: maxFrame,
    cutsSequenced: cutsResult.keyframesInserted,
  };
}
