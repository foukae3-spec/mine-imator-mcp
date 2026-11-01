import {
  KeyframeValues,
  TimelineNode,
  TransitionType,
} from "../types/miproject.js";

export function insertKeyframe(
  timeline: TimelineNode,
  frame: number,
  values: KeyframeValues
): void {
  if (typeof frame !== "number" || !Number.isFinite(frame) || frame < 0) {
    throw new Error(`Frame index must be a non-negative number, got: ${frame}`);
  }
  const frameStr = Math.round(frame).toString();
  if (!timeline.keyframes) {
    timeline.keyframes = {};
  }
  const normalizedValues = { ...values };
  if (normalizedValues.BEND !== undefined && normalizedValues.BEND_ANGLE_X === undefined) {
    normalizedValues.BEND_ANGLE_X = Number(normalizedValues.BEND);
    delete (normalizedValues as { BEND?: unknown }).BEND;
  }
  if (normalizedValues.transition !== undefined && normalizedValues.TRANSITION === undefined) {
    normalizedValues.TRANSITION = normalizedValues.transition as any;
  }
  timeline.keyframes[frameStr] = {
    ...(timeline.keyframes[frameStr] || {}),
    ...normalizedValues,
  };
}

export function clearKeyframes(
  timelines: TimelineNode[],
  targetTimelineId: string,
  fromFrame?: number,
  toFrame?: number,
  recursive: boolean = false
): number {
  if (fromFrame !== undefined && toFrame !== undefined && fromFrame > toFrame) {
    throw new Error("from_frame cannot be greater than to_frame");
  }

  let clearedCount = 0;
  const targetIds = new Set<string>();

  if (targetTimelineId === "all") {
    timelines.forEach((tl) => targetIds.add(tl.id));
  } else {
    targetIds.add(targetTimelineId);
    if (recursive) {
      // Transitively collect all descendant timelines (children, grandchildren, etc.)
      let addedMore = true;
      while (addedMore) {
        addedMore = false;
        for (const tl of timelines) {
          if (!targetIds.has(tl.id)) {
            if (
              (tl.part_of && targetIds.has(tl.part_of)) ||
              (tl.parent && targetIds.has(tl.parent))
            ) {
              targetIds.add(tl.id);
              addedMore = true;
            }
          }
        }
      }
    }
  }

  for (const tl of timelines) {
    if (!targetIds.has(tl.id) || !tl.keyframes) continue;
    const keys = Object.keys(tl.keyframes);
    for (const key of keys) {
      const f = parseInt(key, 10);
      if (isNaN(f)) continue;
      const inRange =
        (fromFrame === undefined || f >= fromFrame) &&
        (toFrame === undefined || f <= toFrame);
      if (inRange) {
        delete tl.keyframes[key];
        clearedCount++;
      }
    }
  }

  return clearedCount;
}

export interface WalkCycleOptions {
  character_timeline_id: string;
  start_frame?: number;
  end_frame?: number;
  cycle_length?: number; // frames per full cycle (default 24)
  arm_swing_angle?: number; // default 35
  leg_swing_angle?: number; // default 35
  bob_height?: number; // default 1.2
  forward_travel?: number; // units moved forward in total
}

export function generateWalkCycle(
  timelines: TimelineNode[],
  options: WalkCycleOptions
): { keyframesAdded: number; affectedTimelines: string[] } {
  const rootId = options.character_timeline_id;
  const rootTimeline = timelines.find((t) => t.id === rootId);
  if (!rootTimeline) {
    throw new Error(`Character root timeline not found: ${rootId}`);
  }

  // Find child body parts
  const bodyParts = timelines.filter(
    (t) => t.part_of === rootId && t.type === "bodypart"
  );
  const partMap: Record<string, TimelineNode> = {};
  for (const part of bodyParts) {
    if (part.model_part_name) {
      partMap[part.model_part_name] = part;
    }
  }

  const startFrame = options.start_frame ?? 0;
  const endFrame = options.end_frame ?? 48;
  const cycleLength = options.cycle_length ?? 24;
  const armAngle = options.arm_swing_angle ?? 35;
  const legAngle = options.leg_swing_angle ?? 35;
  const bobHeight = options.bob_height ?? 1.2;
  const forwardTravel = options.forward_travel ?? 0;

  if (startFrame < 0) {
    throw new Error("start_frame must be greater than or equal to 0");
  }
  if (cycleLength <= 0) {
    throw new Error("cycle_length must be greater than 0");
  }
  const totalFrames = endFrame - startFrame;
  if (totalFrames <= 0) {
    throw new Error("end_frame must be greater than start_frame");
  }

  // Sample every quarter of a walk cycle (e.g. step = cycleLength / 4)
  const step = Math.max(1, Math.round(cycleLength / 4));
  let keyframesAdded = 0;
  const affectedSet = new Set<string>();

  const rightArm = partMap["right_arm"];
  const leftArm = partMap["left_arm"];
  const rightLeg = partMap["right_leg"];
  const leftLeg = partMap["left_leg"];
  const body = partMap["body"];

  const initialY =
    typeof rootTimeline.default_values?.POS_Y === "number"
      ? (rootTimeline.default_values.POS_Y as number)
      : 0;

  // Build frame list ensuring endFrame is always sampled
  const sampleFrames: number[] = [];
  for (let frame = startFrame; frame <= endFrame; frame += step) {
    sampleFrames.push(frame);
  }
  if (sampleFrames[sampleFrames.length - 1] !== endFrame) {
    sampleFrames.push(endFrame);
  }

  for (const frame of sampleFrames) {
    const elapsed = frame - startFrame;
    const theta = (2 * Math.PI * (elapsed % cycleLength)) / cycleLength;
    const progress = elapsed / totalFrames;

    // Root forward movement
    if (forwardTravel !== 0) {
      const currentY = initialY + forwardTravel * progress;
      insertKeyframe(rootTimeline, frame, {
        POS_Y: currentY,
        TRANSITION: "linear",
      });
      affectedSet.add(rootTimeline.id);
      keyframesAdded++;
    }

    // Body: Vertical bobbing (two bounces per full step cycle)
    if (body) {
      const bob = Math.abs(Math.sin(theta)) * bobHeight;
      const twist = Math.sin(theta) * 3; // subtle torso twist
      insertKeyframe(body, frame, {
        POS_Z: bob,
        ROT_Z: twist,
        TRANSITION: "easeinoutquad",
      });
      affectedSet.add(body.id);
      keyframesAdded++;
    }

    // Legs
    if (rightLeg) {
      const legRotX = Math.sin(theta) * legAngle;
      const kneeBend = Math.max(0, Math.cos(theta) * (legAngle * 0.8));
      insertKeyframe(rightLeg, frame, {
        ROT_X: legRotX,
        BEND_ANGLE_X: kneeBend,
        TRANSITION: "easeinoutquad",
      });
      affectedSet.add(rightLeg.id);
      keyframesAdded++;
    }

    if (leftLeg) {
      const legRotX = -Math.sin(theta) * legAngle;
      const kneeBend = Math.max(0, -Math.cos(theta) * (legAngle * 0.8));
      insertKeyframe(leftLeg, frame, {
        ROT_X: legRotX,
        BEND_ANGLE_X: kneeBend,
        TRANSITION: "easeinoutquad",
      });
      affectedSet.add(leftLeg.id);
      keyframesAdded++;
    }

    // Arms: swing opposite to legs
    if (rightArm) {
      const armRotX = -Math.sin(theta) * armAngle;
      const elbowBend = 12 + Math.abs(Math.sin(theta)) * 10;
      insertKeyframe(rightArm, frame, {
        ROT_X: armRotX,
        BEND_ANGLE_X: elbowBend,
        TRANSITION: "easeinoutquad",
      });
      affectedSet.add(rightArm.id);
      keyframesAdded++;
    }

    if (leftArm) {
      const armRotX = Math.sin(theta) * armAngle;
      const elbowBend = 12 + Math.abs(Math.sin(theta)) * 10;
      insertKeyframe(leftArm, frame, {
        ROT_X: armRotX,
        BEND_ANGLE_X: elbowBend,
        TRANSITION: "easeinoutquad",
      });
      affectedSet.add(leftArm.id);
      keyframesAdded++;
    }
  }

  return {
    keyframesAdded,
    affectedTimelines: Array.from(affectedSet),
  };
}

export interface CameraWaypoint {
  frame: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  look_at?: [number, number, number];
  transition?: TransitionType | string;
}

export interface CameraPathOptions {
  camera_timeline_id: string;
  waypoints: CameraWaypoint[];
  smooth?: boolean; // generate intermediate spline frames
  interpolation?: "smooth" | "linear";
  sample_interval?: number; // frames between interpolated samples if smooth=true
}

function cleanZero(val: number): number {
  return Object.is(val, -0) || Math.abs(val) < 1e-9 ? 0 : val;
}

export function computeLookAtAngles(
  eye: [number, number, number],
  target: [number, number, number]
): [number, number, number] {
  const dx = target[0] - eye[0];
  const dy = target[1] - eye[1];
  const dz = target[2] - eye[2];
  const dxy = Math.sqrt(dx * dx + dy * dy);

  // Pitch (ROT_X in Mine-imator: positive tilts down towards ground, negative tilts up towards sky)
  const pitch = cleanZero(-Math.atan2(dz, dxy) * (180 / Math.PI));
  // Yaw (ROT_Z in Mine-imator: 0 = +Y/North, +90 = +X/East, -90 = -X/West)
  const yaw = cleanZero(Math.atan2(dx, dy) * (180 / Math.PI));

  return [pitch, 0, yaw];
}

function interpolateAngles(
  rotStart: [number, number, number],
  rotEnd: [number, number, number],
  u: number
): [number, number, number] {
  const result: [number, number, number] = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    let diff = (rotEnd[axis] - rotStart[axis]) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    result[axis] = rotStart[axis] + diff * u;
  }
  return result;
}

function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function generateCameraPath(
  timelines: TimelineNode[],
  options: CameraPathOptions
): { keyframesAdded: number } {
  const cameraTimeline = timelines.find(
    (t) => t.id === options.camera_timeline_id
  );
  if (!cameraTimeline) {
    throw new Error(`Camera timeline not found: ${options.camera_timeline_id}`);
  }

  const waypoints = [...options.waypoints].sort((a, b) => a.frame - b.frame);
  if (waypoints.length < 2) {
    throw new Error("At least 2 waypoints are required to generate a camera path");
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    if (waypoints[i].frame === waypoints[i + 1].frame) {
      throw new Error(
        `Waypoints must have distinct frame numbers (duplicate frame ${waypoints[i].frame} found)`
      );
    }
  }

  // Pre-resolve rotation for all waypoints
  const resolvedRotations: [number, number, number][] = waypoints.map((wp) => {
    if (wp.rotation) {
      return [wp.rotation[0], wp.rotation[1], wp.rotation[2]];
    }
    if (wp.look_at) {
      return computeLookAtAngles(wp.position, wp.look_at);
    }
    return [0, 0, 0];
  });

  let keyframesAdded = 0;
  const isSmooth = Boolean(options.smooth || options.interpolation === "smooth");

  if (!isSmooth) {
    // Direct waypoint keyframing
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const rot = resolvedRotations[i];

      insertKeyframe(cameraTimeline, wp.frame, {
        POS_X: wp.position[0],
        POS_Y: wp.position[1],
        POS_Z: wp.position[2],
        ROT_X: cleanZero(Math.round(rot[0] * 100) / 100),
        ROT_Y: cleanZero(Math.round(rot[1] * 100) / 100),
        ROT_Z: cleanZero(Math.round(rot[2] * 100) / 100),
        TRANSITION: wp.transition || "easeinoutcubic",
      });
      keyframesAdded++;
    }
    return { keyframesAdded };
  }

  // Smooth Catmull-Rom interpolation across frames
  const sampleInterval = Math.max(1, options.sample_interval ?? 4);

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = (waypoints[i - 1] || waypoints[i]).position;
    const p1 = waypoints[i].position;
    const p2 = waypoints[i + 1].position;
    const p3 = (waypoints[i + 2] || waypoints[i + 1]).position;

    const fStart = waypoints[i].frame;
    const fEnd = waypoints[i + 1].frame;
    const span = fEnd - fStart;

    // Collect frames ensuring fEnd is always sampled
    const sampleFrames: number[] = [];
    for (let f = fStart; f <= fEnd; f += sampleInterval) {
      sampleFrames.push(f);
    }
    if (sampleFrames[sampleFrames.length - 1] !== fEnd) {
      sampleFrames.push(fEnd);
    }

    for (const f of sampleFrames) {
      const u = span === 0 ? 0 : (f - fStart) / span;
      const x = catmullRom(p0[0], p1[0], p2[0], p3[0], u);
      const y = catmullRom(p0[1], p1[1], p2[1], p3[1], u);
      const z = catmullRom(p0[2], p1[2], p2[2], p3[2], u);

      let rot: [number, number, number];

      const lookAtStart = waypoints[i].look_at;
      const lookAtEnd = waypoints[i + 1].look_at;

      if (lookAtStart && lookAtEnd) {
        // Both have 3D target points: interpolate target in 3D and calculate look-at angle
        const lx = lookAtStart[0] + (lookAtEnd[0] - lookAtStart[0]) * u;
        const ly = lookAtStart[1] + (lookAtEnd[1] - lookAtStart[1]) * u;
        const lz = lookAtStart[2] + (lookAtEnd[2] - lookAtStart[2]) * u;
        rot = computeLookAtAngles([x, y, z], [lx, ly, lz]);
      } else {
        // Angular interpolation using resolved orientations with shortest angular wrapping
        rot = interpolateAngles(resolvedRotations[i], resolvedRotations[i + 1], u);
      }

      insertKeyframe(cameraTimeline, f, {
        POS_X: cleanZero(Math.round(x * 100) / 100),
        POS_Y: cleanZero(Math.round(y * 100) / 100),
        POS_Z: cleanZero(Math.round(z * 100) / 100),
        ROT_X: cleanZero(Math.round(rot[0] * 100) / 100),
        ROT_Y: cleanZero(Math.round(rot[1] * 100) / 100),
        ROT_Z: cleanZero(Math.round(rot[2] * 100) / 100),
        TRANSITION: "linear",
      });
      keyframesAdded++;
    }
  }

  return { keyframesAdded };
}
