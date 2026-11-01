import {
  KeyframeValues,
  TimelineNode,
  TransitionType,
} from "../types/miproject.js";
import { insertKeyframe } from "./animation.js";

export interface PoseDefinition {
  name: string;
  description: string;
  parts: {
    root?: KeyframeValues;
    body?: KeyframeValues;
    head?: KeyframeValues;
    right_arm?: KeyframeValues;
    left_arm?: KeyframeValues;
    right_leg?: KeyframeValues;
    left_leg?: KeyframeValues;
    [partName: string]: KeyframeValues | undefined;
  };
}

export const POSE_HEROIC_STAND: PoseDefinition = {
  name: "heroic_stand",
  description: "Confident hero idle stance with grounded weight shift and slight chest breathing angle.",
  parts: {
    body: { ROT_X: -2, ROT_Z: 1 },
    head: { ROT_X: -6, ROT_Z: -3 },
    right_arm: { ROT_X: -5, ROT_Z: 4, BEND_ANGLE_X: 10 },
    left_arm: { ROT_X: 5, ROT_Z: -4, BEND_ANGLE_X: 8 },
    right_leg: { ROT_X: 3, ROT_Z: 2, BEND_ANGLE_X: 4 },
    left_leg: { ROT_X: -2, ROT_Z: -2, BEND_ANGLE_X: 2 },
  },
};

export const POSE_KNEEL_OFFER: PoseDefinition = {
  name: "kneel_offer",
  description: "Steve kneeling on one knee, torso inclined forward, right arm extended offering flower.",
  parts: {
    root: { POS_Z: -6 },
    body: { ROT_X: 14, ROT_Z: 2 },
    head: { ROT_X: -18, ROT_Z: 4 },
    right_arm: { ROT_X: 52, ROT_Z: 6, BEND_ANGLE_X: 22 },
    left_arm: { ROT_X: 12, ROT_Z: -6, BEND_ANGLE_X: 35 },
    right_leg: { ROT_X: 68, ROT_Z: 4, BEND_ANGLE_X: 88 }, // kneeling back leg
    left_leg: { ROT_X: -34, ROT_Z: -2, BEND_ANGLE_X: 72 }, // forward stabilizing leg
  },
};

export const POSE_DEATH_TILT: PoseDefinition = {
  name: "death_tilt",
  description: "Classic Minecraft death tilt with 90-degree sideways roll and relaxed limbs.",
  parts: {
    root: { ROT_Y: 90, POS_Z: -2 },
    body: { ROT_X: 4, ROT_Z: -6 },
    head: { ROT_X: 8, ROT_Z: 14 },
    right_arm: { ROT_X: -15, ROT_Z: 25, BEND_ANGLE_X: 16 },
    left_arm: { ROT_X: 20, ROT_Z: -20, BEND_ANGLE_X: 18 },
    right_leg: { ROT_X: 12, BEND_ANGLE_X: 22 },
    left_leg: { ROT_X: -8, BEND_ANGLE_X: 14 },
  },
};

export const POSE_GOD_MODE_LEVITATE: PoseDefinition = {
  name: "god_mode_levitate",
  description: "Ascended god-mode float: elevated spine arched, arms spread wide, legs trailing.",
  parts: {
    root: { POS_Z: 48 },
    body: { ROT_X: -10, ROT_Z: 0 },
    head: { ROT_X: -22, ROT_Z: 0 },
    right_arm: { ROT_X: 18, ROT_Z: 65, BEND_ANGLE_X: 15 },
    left_arm: { ROT_X: 18, ROT_Z: -65, BEND_ANGLE_X: 15 },
    right_leg: { ROT_X: -16, ROT_Z: 6, BEND_ANGLE_X: 18 },
    left_leg: { ROT_X: -14, ROT_Z: -6, BEND_ANGLE_X: 14 },
  },
};

export const POSE_GRIEFER_SHIFT_TWERK: PoseDefinition = {
  name: "griefer_shift_twerk",
  description: "Rapid Minecraft crouch spam / shift twerk with lowered center of gravity.",
  parts: {
    root: { POS_Z: -5 },
    body: { ROT_X: 22, ROT_Z: 0 },
    head: { ROT_X: 24, ROT_Z: 0 },
    right_arm: { ROT_X: 24, ROT_Z: 12, BEND_ANGLE_X: 38 },
    left_arm: { ROT_X: 24, ROT_Z: -12, BEND_ANGLE_X: 38 },
    right_leg: { ROT_X: -15, BEND_ANGLE_X: 42 },
    left_leg: { ROT_X: -15, BEND_ANGLE_X: 42 },
  },
};

export const POSE_BOW_AIM: PoseDefinition = {
  name: "bow_aim",
  description: "Tensioned archery stance with left arm outstretched and right arm drawn back to jaw.",
  parts: {
    body: { ROT_Z: 42, ROT_X: -2 },
    head: { ROT_Z: -42, ROT_X: -4 },
    left_arm: { ROT_X: 88, ROT_Z: -5, BEND_ANGLE_X: 4 }, // holding bow forward
    right_arm: { ROT_X: 82, ROT_Z: 28, BEND_ANGLE_X: 96 }, // pulled string back to ear
    right_leg: { ROT_X: 16, ROT_Z: 14, BEND_ANGLE_X: 12 },
    left_leg: { ROT_X: -18, ROT_Z: -14, BEND_ANGLE_X: 8 },
  },
};

export const POSE_CRADLE_BODY: PoseDefinition = {
  name: "cradle_body",
  description: "Tragic grief pose: Steve kneeling forward, curved arms cradling Alex.",
  parts: {
    root: { POS_Z: -6 },
    body: { ROT_X: 36, ROT_Z: 0 },
    head: { ROT_X: 32, ROT_Z: 0 },
    right_arm: { ROT_X: 62, ROT_Z: 28, BEND_ANGLE_X: 65 },
    left_arm: { ROT_X: 62, ROT_Z: -28, BEND_ANGLE_X: 65 },
    right_leg: { ROT_X: 65, BEND_ANGLE_X: 85 },
    left_leg: { ROT_X: -30, BEND_ANGLE_X: 70 },
  },
};

export const POSE_SHOCK_FREEZE: PoseDefinition = {
  name: "shock_freeze",
  description: "Paralyzed shock: body pulled back, head snapped back, shoulders tense.",
  parts: {
    body: { ROT_X: -12, ROT_Z: 0 },
    head: { ROT_X: -26, ROT_Z: 0 },
    right_arm: { ROT_X: -8, ROT_Z: 20, BEND_ANGLE_X: 24 },
    left_arm: { ROT_X: -8, ROT_Z: -20, BEND_ANGLE_X: 24 },
    right_leg: { ROT_X: 4, BEND_ANGLE_X: 16 },
    left_leg: { ROT_X: -2, BEND_ANGLE_X: 14 },
  },
};

export const POSE_SWORD_STRIKE: PoseDefinition = {
  name: "sword_strike",
  description: "Dynamic overhead sword slash leaning forward into power stance.",
  parts: {
    body: { ROT_X: 18, ROT_Z: 12 },
    head: { ROT_X: -6, ROT_Z: -10 },
    right_arm: { ROT_X: 135, ROT_Z: 15, BEND_ANGLE_X: 45 },
    left_arm: { ROT_X: -25, ROT_Z: -20, BEND_ANGLE_X: 20 },
    right_leg: { ROT_X: -28, BEND_ANGLE_X: 24 },
    left_leg: { ROT_X: 32, BEND_ANGLE_X: 40 },
  },
};

export const POSE_SHIELD_BLOCK: PoseDefinition = {
  name: "shield_block",
  description: "Defensive crouch with left arm holding shield firmly up against chest.",
  parts: {
    root: { POS_Z: -3 },
    body: { ROT_X: 12, ROT_Z: -10 },
    head: { ROT_X: 10, ROT_Z: 8 },
    left_arm: { ROT_X: 78, ROT_Z: -22, BEND_ANGLE_X: 84 },
    right_arm: { ROT_X: 20, ROT_Z: 16, BEND_ANGLE_X: 32 },
    right_leg: { ROT_X: 14, BEND_ANGLE_X: 26 },
    left_leg: { ROT_X: -14, BEND_ANGLE_X: 30 },
  },
};

export const POSE_SITTING: PoseDefinition = {
  name: "sitting",
  description: "Clean 90-degree sitting pose with thighs forward and lower legs hanging down.",
  parts: {
    root: { POS_Z: -8 },
    body: { ROT_X: 2 },
    head: { ROT_X: 0 },
    right_arm: { ROT_X: 38, BEND_ANGLE_X: 42 },
    left_arm: { ROT_X: 38, BEND_ANGLE_X: 42 },
    right_leg: { ROT_X: 90, BEND_ANGLE_X: 90 },
    left_leg: { ROT_X: 90, BEND_ANGLE_X: 90 },
  },
};

export const POSE_CELEBRATE: PoseDefinition = {
  name: "celebrate",
  description: "Triumphant victory pose with both arms raised high in the air.",
  parts: {
    root: { POS_Z: 6 },
    body: { ROT_X: -8 },
    head: { ROT_X: -25 },
    right_arm: { ROT_X: 160, ROT_Z: 25, BEND_ANGLE_X: 16 },
    left_arm: { ROT_X: 160, ROT_Z: -25, BEND_ANGLE_X: 16 },
    right_leg: { ROT_X: -10, BEND_ANGLE_X: 15 },
    left_leg: { ROT_X: 12, BEND_ANGLE_X: 25 },
  },
};

export const POSE_SPRINT: PoseDefinition = {
  name: "sprint",
  description: "Full-speed sprint stride with extreme forward torso lean and wide limb drive.",
  parts: {
    body: { ROT_X: 28 },
    head: { ROT_X: -18 },
    right_arm: { ROT_X: -55, BEND_ANGLE_X: 65 },
    left_arm: { ROT_X: 60, BEND_ANGLE_X: 55 },
    right_leg: { ROT_X: 58, BEND_ANGLE_X: 75 },
    left_leg: { ROT_X: -45, BEND_ANGLE_X: 25 },
  },
};

export const POSE_FALLING: PoseDefinition = {
  name: "falling",
  description: "Uncontrolled falling in mid-air with flailing limbs and head tilted back.",
  parts: {
    root: { POS_Z: 30 },
    body: { ROT_X: -15 },
    head: { ROT_X: -30 },
    right_arm: { ROT_X: 140, ROT_Z: 40, BEND_ANGLE_X: 30 },
    left_arm: { ROT_X: 120, ROT_Z: -50, BEND_ANGLE_X: 25 },
    right_leg: { ROT_X: -25, BEND_ANGLE_X: 45 },
    left_leg: { ROT_X: 20, BEND_ANGLE_X: 60 },
  },
};

export const POSE_COMMAND_INVOKE: PoseDefinition = {
  name: "command_invoke",
  description: "Dramatic magical power command: right arm outstretched forward, left arm channeling energy.",
  parts: {
    body: { ROT_X: -5, ROT_Z: 5 },
    head: { ROT_X: -10, ROT_Z: -5 },
    right_arm: { ROT_X: 90, ROT_Z: 5, BEND_ANGLE_X: 0 },
    left_arm: { ROT_X: 45, ROT_Z: -45, BEND_ANGLE_X: 55 },
    right_leg: { ROT_X: 8, BEND_ANGLE_X: 8 },
    left_leg: { ROT_X: -10, BEND_ANGLE_X: 6 },
  },
};

export const POSE_LIBRARY: Record<string, PoseDefinition> = {
  heroic_stand: POSE_HEROIC_STAND,
  kneel_offer: POSE_KNEEL_OFFER,
  death_tilt: POSE_DEATH_TILT,
  god_mode_levitate: POSE_GOD_MODE_LEVITATE,
  griefer_shift_twerk: POSE_GRIEFER_SHIFT_TWERK,
  bow_aim: POSE_BOW_AIM,
  cradle_body: POSE_CRADLE_BODY,
  shock_freeze: POSE_SHOCK_FREEZE,
  sword_strike: POSE_SWORD_STRIKE,
  shield_block: POSE_SHIELD_BLOCK,
  sitting: POSE_SITTING,
  celebrate: POSE_CELEBRATE,
  sprint: POSE_SPRINT,
  falling: POSE_FALLING,
  command_invoke: POSE_COMMAND_INVOKE,
};

export function getPose(poseName: string): PoseDefinition | undefined {
  const normalized = poseName.toLowerCase().replace(/^pose_/, "");
  return POSE_LIBRARY[normalized];
}

export function listAvailablePoses(): { name: string; description: string }[] {
  return Object.values(POSE_LIBRARY).map((p) => ({
    name: p.name,
    description: p.description,
  }));
}

/**
 * Apply an anatomically verified pose to a character hierarchy at a specific frame.
 */
export function applyPoseToCharacter(
  timelines: TimelineNode[],
  characterRootId: string,
  poseNameOrDef: string | PoseDefinition,
  frame: number = 0,
  transition: TransitionType = "easeinoutquad"
): {
  success: boolean;
  poseName: string;
  affectedTimelines: string[];
  frame: number;
} {
  const pose = typeof poseNameOrDef === "string" ? getPose(poseNameOrDef) : poseNameOrDef;
  if (!pose) {
    throw new Error(
      `Pose '${typeof poseNameOrDef === "string" ? poseNameOrDef : "custom"}' not found in library. Available: ${Object.keys(
        POSE_LIBRARY
      ).join(", ")}`
    );
  }

  const rootTimeline = timelines.find((t) => t.id === characterRootId);
  if (!rootTimeline) {
    throw new Error(`Character root timeline not found: ${characterRootId}`);
  }

  // Find all body parts
  const bodyParts = timelines.filter(
    (t) => t.part_of === characterRootId && t.type === "bodypart"
  );
  const partMap: Record<string, TimelineNode> = {};
  for (const part of bodyParts) {
    if (part.model_part_name) {
      partMap[part.model_part_name] = part;
    }
  }

  const affectedTimelines: string[] = [];

  // Apply root keyframe if specified
  if (pose.parts.root) {
    const rootValues: KeyframeValues = {
      ...pose.parts.root,
      TRANSITION: transition,
    };
    insertKeyframe(rootTimeline, frame, rootValues);
    affectedTimelines.push(rootTimeline.id);
  }

  // Apply body parts keyframes
  for (const [partName, kfValues] of Object.entries(pose.parts)) {
    if (partName === "root" || !kfValues) continue;
    const partTimeline = partMap[partName];
    if (partTimeline) {
      const partValues: KeyframeValues = {
        ...kfValues,
        TRANSITION: transition,
      };
      insertKeyframe(partTimeline, frame, partValues);
      affectedTimelines.push(partTimeline.id);
    }
  }

  return {
    success: true,
    poseName: pose.name,
    affectedTimelines,
    frame,
  };
}
