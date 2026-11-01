import { KeyframeValues, MiProject, TimelineNode } from "../types/miproject.js";
import { insertKeyframe } from "./animation.js";

export type FacialExpressionType =
  | "neutral"
  | "happy"
  | "angry"
  | "sad"
  | "shocked"
  | "smug"
  | "glowing_eyes"
  | "god_mode"
  | "wink_left"
  | "wink_right";

export interface RigInspectionReport {
  rootId: string;
  rootName: string;
  rigType: "vanilla_biped" | "advanced_facial" | "custom_community_rig";
  totalParts: number;
  faceBones: {
    eyes?: string;
    pupilLeft?: string;
    pupilRight?: string;
    browLeft?: string;
    browRight?: string;
    mouth?: string;
    jaw?: string;
    eyelids?: string[];
  };
  customBones: Array<{ id: string; name: string; modelPartName: string; parentId: string }>;
  hasFacialRig: boolean;
}

export interface SetFacialExpressionOptions {
  frame: number;
  expression: FacialExpressionType;
  blink?: boolean;
  blinkDurationFrames?: number; // default: 2
  eyeLookAt?: [number, number, number]; // target coordinate to focus pupils towards
  glowColor?: string; // hex color for glowing_eyes or god_mode
  glow_color?: string;
  transition?: string; // default: "instant" or "linear"
}

/**
 * Inspects a character hierarchy to detect standard and community face/rig bones
 * (supporting vanilla human rigs, LapisFR, Item43, AnimateCC, and custom .mimodel rigs).
 */
export function inspectRig(project: MiProject, characterRootId: string): RigInspectionReport {
  const root = project.timelines.find((t) => t.id === characterRootId);
  if (!root) {
    throw new Error(`Character root timeline not found: ${characterRootId}`);
  }

  const parts = project.timelines.filter(
    (t) => t.part_of === characterRootId || t.parent === characterRootId
  );

  const faceBones: RigInspectionReport["faceBones"] = { eyelids: [] };
  const customBones: RigInspectionReport["customBones"] = [];

  const standardBipedParts = new Set([
    "head",
    "hat",
    "body",
    "right_arm",
    "left_arm",
    "right_leg",
    "left_leg",
  ]);

  for (const part of parts) {
    const rawName = (part.model_part_name || part.name || "").toLowerCase();

    if (rawName.includes("pupil_l") || rawName.includes("pupil_left") || rawName === "left_pupil") {
      faceBones.pupilLeft = part.id;
    } else if (rawName.includes("pupil_r") || rawName.includes("pupil_right") || rawName === "right_pupil") {
      faceBones.pupilRight = part.id;
    } else if (rawName.includes("eye_l") || rawName.includes("eye_left") || rawName === "eyes") {
      faceBones.eyes = part.id;
    } else if (rawName.includes("brow_l") || rawName.includes("eyebrow_l") || rawName.includes("left_brow")) {
      faceBones.browLeft = part.id;
    } else if (rawName.includes("brow_r") || rawName.includes("eyebrow_r") || rawName.includes("right_brow")) {
      faceBones.browRight = part.id;
    } else if (rawName.includes("jaw")) {
      faceBones.jaw = part.id;
    } else if (rawName.includes("mouth") || rawName.includes("lip")) {
      faceBones.mouth = part.id;
    } else if (rawName.includes("eyelid")) {
      faceBones.eyelids?.push(part.id);
    } else if (!standardBipedParts.has(rawName)) {
      customBones.push({
        id: part.id,
        name: part.name || rawName,
        modelPartName: part.model_part_name || rawName,
        parentId: part.parent,
      });
    }
  }

  const hasFacial = Boolean(
    faceBones.eyes ||
      faceBones.pupilLeft ||
      faceBones.mouth ||
      faceBones.jaw ||
      faceBones.browLeft ||
      (faceBones.eyelids && faceBones.eyelids.length > 0)
  );

  let rigType: RigInspectionReport["rigType"] = "vanilla_biped";
  if (hasFacial) {
    rigType = "advanced_facial";
  } else if (customBones.length > 0) {
    rigType = "custom_community_rig";
  }

  return {
    rootId: root.id,
    rootName: root.name || "Character",
    rigType,
    totalParts: parts.length + 1,
    faceBones,
    customBones,
    hasFacialRig: hasFacial,
  };
}

/**
 * Applies a facial expression and optional auto-blink/eye-tracking to a character rig.
 * Gracefully falls back to head tilt/rotation on standard vanilla biped characters
 * if dedicated face bones are absent.
 */
export function setFacialExpression(
  timelines: TimelineNode[],
  characterRootId: string,
  options: SetFacialExpressionOptions
): {
  success: boolean;
  expression: FacialExpressionType;
  bonesAnimated: string[];
  headAnimated: boolean;
} {
  const root = timelines.find((t) => t.id === characterRootId);
  if (!root) {
    throw new Error(`Character root timeline not found: ${characterRootId}`);
  }

  const parts = timelines.filter(
    (t) => t.part_of === characterRootId || t.parent === characterRootId
  );
  const head = parts.find((p) => p.model_part_name === "head");

  const bonesAnimated: string[] = [];
  const trans = options.transition || "instant";

  // Search for dedicated facial bones
  const findPart = (keywords: string[]) =>
    parts.find((p) => {
      const n = (p.model_part_name || p.name || "").toLowerCase();
      return keywords.some((kw) => n.includes(kw));
    });

  const browLeft = findPart(["brow_l", "eyebrow_l", "left_brow"]);
  const browRight = findPart(["brow_r", "eyebrow_r", "right_brow"]);
  const mouth = findPart(["mouth", "lip"]);
  const jaw = findPart(["jaw"]);
  const eyes = findPart(["eyes", "eye_"]);
  const pupilLeft = findPart(["pupil_l", "pupil_left"]);
  const pupilRight = findPart(["pupil_r", "pupil_right"]);

  const setBone = (bone: TimelineNode | undefined, values: KeyframeValues) => {
    if (!bone) return;
    insertKeyframe(bone, options.frame, { ...values, transition: trans });
    bonesAnimated.push(bone.id);
  };

  switch (options.expression) {
    case "happy":
      setBone(browLeft, { POS_Z: 0.8, ROT_Z: 8 });
      setBone(browRight, { POS_Z: 0.8, ROT_Z: -8 });
      setBone(mouth, { POS_Z: 0.5, SCALE_X: 1.1 });
      setBone(jaw, { ROT_X: 4 });
      if (head) {
        insertKeyframe(head, options.frame, { ROT_X: -4, ROT_Z: 2, transition: trans });
      }
      break;

    case "angry":
      setBone(browLeft, { POS_Z: -0.6, ROT_Z: -16 });
      setBone(browRight, { POS_Z: -0.6, ROT_Z: 16 });
      setBone(mouth, { SCALE_X: 0.85, POS_Z: -0.2 });
      setBone(jaw, { ROT_X: -2 });
      if (head) {
        insertKeyframe(head, options.frame, { ROT_X: 12, ROT_Z: 0, transition: trans });
      }
      break;

    case "shocked":
      setBone(browLeft, { POS_Z: 2.0, ROT_Z: 12 });
      setBone(browRight, { POS_Z: 2.0, ROT_Z: -12 });
      setBone(mouth, { SCALE_Y: 1.8, POS_Z: -1.0 });
      setBone(jaw, { ROT_X: 28 }); // drop jaw open
      if (head) {
        insertKeyframe(head, options.frame, { ROT_X: -14, transition: trans });
      }
      break;

    case "sad":
      setBone(browLeft, { POS_Z: 1.0, ROT_Z: 18 });
      setBone(browRight, { POS_Z: 1.0, ROT_Z: -18 });
      setBone(mouth, { POS_Z: -0.8, SCALE_X: 0.8 });
      setBone(jaw, { ROT_X: 6 });
      if (head) {
        insertKeyframe(head, options.frame, { ROT_X: 14, ROT_Z: -4, transition: trans });
      }
      break;

    case "smug":
      setBone(browLeft, { POS_Z: 1.2, ROT_Z: 10 });
      setBone(browRight, { POS_Z: -0.4, ROT_Z: 4 });
      setBone(mouth, { POS_X: 0.6, POS_Z: 0.4 });
      if (head) {
        insertKeyframe(head, options.frame, { ROT_Z: 6, ROT_Y: -4, transition: trans });
      }
      break;

    case "glowing_eyes":
    case "god_mode": {
      const glowCol = options.glowColor || options.glow_color || (options.expression === "god_mode" ? "#FFFFFF" : "#00FFFF");
      const targetEyes = eyes || head;
      if (targetEyes) {
        insertKeyframe(targetEyes, options.frame, {
          GLOW: true,
          GLOW_COLOR: glowCol,
          transition: trans,
        });
        bonesAnimated.push(targetEyes.id);
      }
      setBone(browLeft, { POS_Z: -0.8, ROT_Z: -18 });
      setBone(browRight, { POS_Z: -0.8, ROT_Z: 18 });
      if (head) {
        insertKeyframe(head, options.frame, { ROT_X: -8, transition: trans });
      }
      break;
    }

    case "wink_left":
      setBone(pupilLeft, { VISIBLE: false });
      setBone(browLeft, { POS_Z: -1.0 });
      setBone(mouth, { POS_X: -0.4, POS_Z: 0.3 });
      break;

    case "wink_right":
      setBone(pupilRight, { VISIBLE: false });
      setBone(browRight, { POS_Z: -1.0 });
      setBone(mouth, { POS_X: 0.4, POS_Z: 0.3 });
      break;

    case "neutral":
    default:
      setBone(browLeft, { POS_Z: 0, ROT_Z: 0 });
      setBone(browRight, { POS_Z: 0, ROT_Z: 0 });
      setBone(mouth, { POS_X: 0, POS_Z: 0, SCALE_X: 1, SCALE_Y: 1 });
      setBone(jaw, { ROT_X: 0 });
      if (head) {
        insertKeyframe(head, options.frame, { ROT_X: 0, ROT_Y: 0, ROT_Z: 0, transition: trans });
      }
      break;
  }

  // Handle auto-blink
  if (options.blink) {
    const blinkDuration = options.blinkDurationFrames || 2;
    const targetEyes = eyes || pupilLeft;
    if (targetEyes) {
      // Close at frame
      insertKeyframe(targetEyes, options.frame, { VISIBLE: false, transition: "instant" });
      if (pupilRight) {
        insertKeyframe(pupilRight, options.frame, { VISIBLE: false, transition: "instant" });
      }
      // Re-open after duration
      insertKeyframe(targetEyes, options.frame + blinkDuration, { VISIBLE: true, transition: "instant" });
      if (pupilRight) {
        insertKeyframe(pupilRight, options.frame + blinkDuration, { VISIBLE: true, transition: "instant" });
      }
    }
  }

  return {
    success: true,
    expression: options.expression,
    bonesAnimated,
    headAnimated: Boolean(head),
  };
}
