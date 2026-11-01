import {
  KeyframeValues,
  TimelineNode,
} from "../types/miproject.js";
import { insertKeyframe } from "./animation.js";

export interface LimbLengths {
  upper: number;
  lower: number;
}

export const DEFAULT_LIMB_LENGTHS: Record<string, LimbLengths> = {
  right_arm: { upper: 4, lower: 6 },
  left_arm: { upper: 4, lower: 6 },
  right_leg: { upper: 6, lower: 6 },
  left_leg: { upper: 6, lower: 6 },
};

// Default relative pivot points from character root [0, 0, 0]
export const DEFAULT_LIMB_PIVOTS: Record<string, [number, number, number]> = {
  right_arm: [-6, 0, 22],
  left_arm: [6, 0, 22],
  right_leg: [-2, 0, 12],
  left_leg: [2, 0, 12],
};

export interface SolveIKOptions {
  shoulderPos: [number, number, number];
  targetPos: [number, number, number];
  poleVector?: [number, number, number];
  limbType?: "right_arm" | "left_arm" | "right_leg" | "left_leg" | string;
  limbLengths?: LimbLengths;
  jointLimitMin?: number; // default 0
  jointLimitMax?: number; // default 140
}

export interface IKSolution {
  rot: [number, number, number]; // [rotX, rotY, rotZ] in degrees
  bend: number; // BEND_ANGLE_X in degrees clamped to [0, 140]
  shoulderPos: [number, number, number];
  elbowPos: [number, number, number];
  wristPos: [number, number, number];
  distance: number;
  maxReach: number;
  inReach: boolean;
  clamped: boolean;
}

export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

export function mat4Identity(): Mat4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

export function mat4Translation(tx: number, ty: number, tz: number): Mat4 {
  return [
    1, 0, 0, tx,
    0, 1, 0, ty,
    0, 0, 1, tz,
    0, 0, 0, 1,
  ];
}

export function mat4EulerRotation(rotX: number, rotY: number, rotZ: number): Mat4 {
  const pitchRad = (rotX * Math.PI) / 180;
  const rollRad = (rotY * Math.PI) / 180;
  const yawRad = (rotZ * Math.PI) / 180;

  // Forward (F): 0 deg is +Y, 90 deg is +X, 180 deg is -Y
  const Fx = Math.sin(yawRad) * Math.cos(pitchRad);
  const Fy = Math.cos(yawRad) * Math.cos(pitchRad);
  const Fz = -Math.sin(pitchRad);

  // Right (R): 0 deg is +X, 90 deg is -Y, 180 deg is -X
  let Rx = Math.cos(yawRad);
  let Ry = -Math.sin(yawRad);
  let Rz = 0;

  // Up (U): R x F
  let Ux = Ry * Fz - Rz * Fy;
  let Uy = Rz * Fx - Rx * Fz;
  let Uz = Rx * Fy - Ry * Fx;

  if (Math.abs(rollRad) > 1e-6) {
    const cosR = Math.cos(rollRad);
    const sinR = Math.sin(rollRad);
    const nRx = Rx * cosR + Ux * sinR;
    const nRy = Ry * cosR + Uy * sinR;
    const nRz = Rz * cosR + Uz * sinR;
    const nUx = -Rx * sinR + Ux * cosR;
    const nUy = -Ry * sinR + Uy * cosR;
    const nUz = -Rz * sinR + Uz * cosR;
    Rx = nRx; Ry = nRy; Rz = nRz;
    Ux = nUx; Uy = nUy; Uz = nUz;
  }

  // Column 0 is R, Column 1 is F, Column 2 is U
  return [
    Rx, Fx, Ux, 0,
    Ry, Fy, Uy, 0,
    Rz, Fz, Uz, 0,
    0,  0,  0,  1,
  ];
}

export function mat4Transform(pos: [number, number, number], rot: [number, number, number]): Mat4 {
  const rotM = mat4EulerRotation(rot[0], rot[1], rot[2]);
  rotM[3] = pos[0];
  rotM[7] = pos[1];
  rotM[11] = pos[2];
  return rotM;
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out: Mat4 = [
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[r * 4 + c] =
        a[r * 4 + 0] * b[0 * 4 + c] +
        a[r * 4 + 1] * b[1 * 4 + c] +
        a[r * 4 + 2] * b[2 * 4 + c] +
        a[r * 4 + 3] * b[3 * 4 + c];
    }
  }
  return out;
}

export function mat4InvertRigid(m: Mat4): Mat4 {
  // Transpose the 3x3 orthonormal rotation part
  const r00 = m[0], r01 = m[4], r02 = m[8];
  const r10 = m[1], r11 = m[5], r12 = m[9];
  const r20 = m[2], r21 = m[6], r22 = m[10];

  const tx = m[3], ty = m[7], tz = m[11];

  // -R^T * T
  const itx = -(r00 * tx + r01 * ty + r02 * tz);
  const ity = -(r10 * tx + r11 * ty + r12 * tz);
  const itz = -(r20 * tx + r21 * ty + r22 * tz);

  return [
    r00, r01, r02, itx,
    r10, r11, r12, ity,
    r20, r21, r22, itz,
    0,   0,   0,   1,
  ];
}

export function mat4TransformPoint(m: Mat4, p: [number, number, number]): [number, number, number] {
  return [
    cleanZero(m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3]),
    cleanZero(m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7]),
    cleanZero(m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]),
  ];
}

export function mat4TransformVector(m: Mat4, v: [number, number, number]): [number, number, number] {
  return [
    cleanZero(m[0] * v[0] + m[1] * v[1] + m[2] * v[2]),
    cleanZero(m[4] * v[0] + m[5] * v[1] + m[6] * v[2]),
    cleanZero(m[8] * v[0] + m[9] * v[1] + m[10] * v[2]),
  ];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function cleanZero(val: number): number {
  return Object.is(val, -0) || Math.abs(val) < 1e-6 ? 0 : Math.round(val * 1e6) / 1e6;
}

/**
 * Analytical 2-bone Inverse Kinematics solver using the Law of Cosines.
 * Computes exact shoulder/hip rotation (Euler pitch, roll, yaw) and elbow/knee bend angle.
 */
export function solveLimbIK(options: SolveIKOptions): IKSolution {
  const limbType = options.limbType || "right_arm";
  const lengths = options.limbLengths || DEFAULT_LIMB_LENGTHS[limbType] || { upper: 4, lower: 6 };
  const L1 = lengths.upper;
  const L2 = lengths.lower;
  const maxReach = L1 + L2;
  const minReach = Math.abs(L1 - L2);

  const P0 = options.shoulderPos;
  const Pt = options.targetPos;

  const dx = Pt[0] - P0[0];
  const dy = Pt[1] - P0[1];
  const dz = Pt[2] - P0[2];

  const rawDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const inReach = rawDist <= maxReach + 1e-5 && rawDist >= minReach - 1e-5;

  // Joint limit clamping: strictly bounded to natural limits [0, 140]
  const minLimit = Math.max(0, options.jointLimitMin ?? 0);
  const maxLimit = Math.min(140, options.jointLimitMax ?? 140);

  // Clamp target distance strictly within physical reach
  const clampedDist = clamp(rawDist, Math.max(0.001, minReach), maxReach);
  const clamped = !inReach;

  // Handle singular zero distance (target at shoulder origin)
  if (rawDist < 1e-6) {
    const bendDeg = clamp(140, minLimit, maxLimit);
    return {
      rot: [0, 0, 0],
      bend: bendDeg,
      shoulderPos: [P0[0], P0[1], P0[2]],
      elbowPos: [P0[0], P0[1], P0[2] - L1],
      wristPos: [P0[0], P0[1], P0[2] - Math.abs(L2 - L1)],
      distance: 0,
      maxReach,
      inReach: false,
      clamped: true,
    };
  }

  // Direction unit vector to target
  const Dhat: [number, number, number] = [
    dx / rawDist,
    dy / rawDist,
    dz / rawDist,
  ];

  // Law of Cosines for interior joint angle:
  // d^2 = L1^2 + L2^2 - 2*L1*L2*cos(theta_int)
  const cosThetaInt = (L1 * L1 + L2 * L2 - clampedDist * clampedDist) / (2 * L1 * L2);
  const thetaInt = Math.acos(clamp(cosThetaInt, -1, 1));

  // In Mine-imator: 0 deg bend is straight, 180 - thetaInt is bend angle
  const rawBendDeg = (Math.PI - thetaInt) * (180 / Math.PI);
  const bendDeg = cleanZero(clamp(rawBendDeg, minLimit, maxLimit));

  // Shoulder angle alpha between upper bone and vector to target:
  // L2^2 = L1^2 + d^2 - 2*L1*d*cos(alpha)
  const cosAlpha = (L1 * L1 + clampedDist * clampedDist - L2 * L2) / (2 * L1 * clampedDist);
  const alpha = Math.acos(clamp(cosAlpha, -1, 1));

  // Resolve anatomical pole vector
  // Default pole directions in local limb space:
  // Arms bend backward/downward; legs bend forward/upward.
  let defaultPole: [number, number, number];
  if (limbType.includes("leg")) {
    defaultPole = [0, 1.0, 0.0];
  } else {
    defaultPole = [0, -1.0, 0.0];
  }

  let poleDir: [number, number, number] = defaultPole;
  if (options.poleVector) {
    const pv = options.poleVector;
    const pLen = Math.sqrt(pv[0] * pv[0] + pv[1] * pv[1] + pv[2] * pv[2]);
    if (pLen > 1e-6) {
      poleDir = [pv[0] / pLen, pv[1] / pLen, pv[2] / pLen];
    }
  }

  // Gram-Schmidt Orthogonal Fallback Basis:
  // v_pole = P_p - (P_p . d_hat) * d_hat
  // Prevents NaN gimbal lock when direction vector D is collinear with pole vector P_p
  const dotP = poleDir[0] * Dhat[0] + poleDir[1] * Dhat[1] + poleDir[2] * Dhat[2];
  const vPole: [number, number, number] = [
    poleDir[0] - Dhat[0] * dotP,
    poleDir[1] - Dhat[1] * dotP,
    poleDir[2] - Dhat[2] * dotP,
  ];
  const vPoleLen = Math.sqrt(vPole[0] * vPole[0] + vPole[1] * vPole[1] + vPole[2] * vPole[2]);

  let pHatPerp: [number, number, number];
  if (vPoleLen < 1e-5) {
    // Collinear singularity: select orthogonal fallback axis u_fallback
    const uFallback: [number, number, number] =
      Math.abs(Dhat[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    // Cross product: Dhat x uFallback
    const cx = Dhat[1] * uFallback[2] - Dhat[2] * uFallback[1];
    const cy = Dhat[2] * uFallback[0] - Dhat[0] * uFallback[2];
    const cz = Dhat[0] * uFallback[1] - Dhat[1] * uFallback[0];
    const cLen = Math.sqrt(cx * cx + cy * cy + cz * cz);
    pHatPerp = [cx / cLen, cy / cLen, cz / cLen];
  } else {
    pHatPerp = [vPole[0] / vPoleLen, vPole[1] / vPoleLen, vPole[2] / vPoleLen];
  }

  // Exact 3D unit vector of upper arm bone (from shoulder to elbow):
  // u = cos(alpha) * d_hat + sin(alpha) * p_hat_perp
  const u: [number, number, number] = [
    cosAlpha * Dhat[0] + Math.sin(alpha) * pHatPerp[0],
    cosAlpha * Dhat[1] + Math.sin(alpha) * pHatPerp[1],
    cosAlpha * Dhat[2] + Math.sin(alpha) * pHatPerp[2],
  ];

  // Determine direction to target
  // Standard biped arm points straight down at (0, 0, -1) when unrotated
  // Angle of upper arm vector in pitch (elevation forward/backward):
  // When target is forward (u[1] > 0), upperPitch > 0
  // When target is down (u[2] < 0), upperPitch is 0 when straight down
  const upperPitch = Math.atan2(u[1], -u[2]);
  const rotX = cleanZero(upperPitch * (180 / Math.PI));

  // Yaw / Abduction (ROT_Z) in lateral direction (-u[0] for Mine-imator convention):
  // For right arm, positive rotZ moves arm outward to the right (-X).
  // For left arm, negative rotZ moves arm outward to the left (+X).
  const uyz = Math.sqrt(u[1] * u[1] + u[2] * u[2]);
  const rotZ = cleanZero(Math.atan2(-u[0], Math.max(0.0001, uyz)) * (180 / Math.PI));

  // Roll (ROT_Y) around bone longitudinal axis
  let rotY = 0;
  if (options.poleVector) {
    const targetRoll = Math.atan2(poleDir[0], -poleDir[1]);
    rotY = cleanZero(targetRoll * (180 / Math.PI));
  }

  // Mathematically exact 3D Forward Kinematics positions
  const elbowPos: [number, number, number] = [
    cleanZero(P0[0] + u[0] * L1),
    cleanZero(P0[1] + u[1] * L1),
    cleanZero(P0[2] + u[2] * L1),
  ];

  const wristPos: [number, number, number] = [
    cleanZero(P0[0] + Dhat[0] * clampedDist),
    cleanZero(P0[1] + Dhat[1] * clampedDist),
    cleanZero(P0[2] + Dhat[2] * clampedDist),
  ];

  return {
    rot: [rotX, rotY, rotZ],
    bend: bendDeg,
    shoulderPos: [P0[0], P0[1], P0[2]],
    elbowPos,
    wristPos,
    distance: cleanZero(rawDist),
    maxReach,
    inReach,
    clamped,
  };
}

/**
 * Apply IK solution to a character timeline in a Mine-imator project.
 * Uses full hierarchical Forward-Kinematics (FK) parent matrix evaluation:
 * M_parent = M_root * M_body * T(p_waist) * R_Euler(theta_torso_bend) * T(-p_waist) * T(p_shoulder_local)
 * and inverts M_parent to transform target P_t and pole vector P_p into shoulder local coordinates [0, 0, 0].
 */
export function applyIKToCharacter(
  timelines: TimelineNode[],
  characterRootId: string,
  limbName: "right_arm" | "left_arm" | "right_leg" | "left_leg",
  targetCoords: [number, number, number],
  options: {
    frame?: number;
    poleVector?: [number, number, number];
    limbLengths?: LimbLengths;
    jointLimitMin?: number;
    jointLimitMax?: number;
  } = {}
): {
  success: boolean;
  solution: IKSolution;
  limbTimelineId: string;
} {
  const rootTimeline = timelines.find((t) => t.id === characterRootId);
  if (!rootTimeline) {
    throw new Error(`Character root timeline not found: ${characterRootId}`);
  }

  // Find target limb timeline
  const limbTimeline = timelines.find(
    (t) => t.part_of === characterRootId && t.model_part_name === limbName
  );
  if (!limbTimeline) {
    throw new Error(`Limb timeline '${limbName}' not found for character: ${characterRootId}`);
  }

  const frame = options.frame ?? 0;
  const frameStr = Math.round(frame).toString();

  // Root transform at frame
  const rootPos: [number, number, number] = [
    (rootTimeline.default_values?.POS_X as number) || 0,
    (rootTimeline.default_values?.POS_Y as number) || 0,
    (rootTimeline.default_values?.POS_Z as number) || 0,
  ];
  const rootRot: [number, number, number] = [
    (rootTimeline.default_values?.ROT_X as number) || 0,
    (rootTimeline.default_values?.ROT_Y as number) || 0,
    (rootTimeline.default_values?.ROT_Z as number) || 0,
  ];

  if (rootTimeline.keyframes && rootTimeline.keyframes[frameStr]) {
    const kf = rootTimeline.keyframes[frameStr];
    if (kf.POS_X !== undefined) rootPos[0] = kf.POS_X;
    if (kf.POS_Y !== undefined) rootPos[1] = kf.POS_Y;
    if (kf.POS_Z !== undefined) rootPos[2] = kf.POS_Z;
    if (kf.ROT_X !== undefined) rootRot[0] = kf.ROT_X;
    if (kf.ROT_Y !== undefined) rootRot[1] = kf.ROT_Y;
    if (kf.ROT_Z !== undefined) rootRot[2] = kf.ROT_Z;
  }

  const M_root = mat4Transform(rootPos, rootRot);

  let M_parent: Mat4;
  const isArm = limbName === "right_arm" || limbName === "left_arm";

  if (isArm) {
    // Arms parent chain:
    // M_parent = M_root * M_body * T(p_waist) * R_Euler(theta_torso_bend) * T(-p_waist) * T(p_shoulder_local)
    const bodyTimeline = timelines.find(
      (t) => (t.part_of === characterRootId || t.id === limbTimeline.parent) &&
             (t.model_part_name === "body" || t.id === limbTimeline.parent)
    );

    const bodyPos: [number, number, number] = [
      (bodyTimeline?.default_values?.POS_X as number) || 0,
      (bodyTimeline?.default_values?.POS_Y as number) || 0,
      ((bodyTimeline?.default_values?.POS_Z as number) || 0) + 12, // body base pivot at hip Z = 12
    ];
    const bodyRot: [number, number, number] = [
      (bodyTimeline?.default_values?.ROT_X as number) || 0,
      (bodyTimeline?.default_values?.ROT_Y as number) || 0,
      (bodyTimeline?.default_values?.ROT_Z as number) || 0,
    ];

    const torsoBend: [number, number, number] = [0, 0, 0];
    if (bodyTimeline) {
      if (bodyTimeline.default_values?.BEND_ANGLE_X !== undefined) {
        torsoBend[0] = Number(bodyTimeline.default_values.BEND_ANGLE_X);
      } else if (bodyTimeline.default_values?.BEND !== undefined) {
        torsoBend[0] = Number(bodyTimeline.default_values.BEND);
      }
      if (bodyTimeline.default_values?.BEND_ANGLE_Y !== undefined) {
        torsoBend[1] = Number(bodyTimeline.default_values.BEND_ANGLE_Y);
      }
      if (bodyTimeline.default_values?.BEND_ANGLE_Z !== undefined) {
        torsoBend[2] = Number(bodyTimeline.default_values.BEND_ANGLE_Z);
      }

      if (bodyTimeline.keyframes && bodyTimeline.keyframes[frameStr]) {
        const bkf = bodyTimeline.keyframes[frameStr];
        if (bkf.POS_X !== undefined) bodyPos[0] = bkf.POS_X;
        if (bkf.POS_Y !== undefined) bodyPos[1] = bkf.POS_Y;
        if (bkf.POS_Z !== undefined) bodyPos[2] = bkf.POS_Z + 12;
        if (bkf.ROT_X !== undefined) bodyRot[0] = bkf.ROT_X;
        if (bkf.ROT_Y !== undefined) bodyRot[1] = bkf.ROT_Y;
        if (bkf.ROT_Z !== undefined) bodyRot[2] = bkf.ROT_Z;
        if (bkf.BEND_ANGLE_X !== undefined) torsoBend[0] = Number(bkf.BEND_ANGLE_X);
        else if (bkf.BEND !== undefined) torsoBend[0] = Number(bkf.BEND);
        if (bkf.BEND_ANGLE_Y !== undefined) torsoBend[1] = Number(bkf.BEND_ANGLE_Y);
        if (bkf.BEND_ANGLE_Z !== undefined) torsoBend[2] = Number(bkf.BEND_ANGLE_Z);
      }
    }

    const M_body = mat4Transform(bodyPos, bodyRot);
    const p_waist: [number, number, number] = [0, 0, 6];
    const T_waist = mat4Translation(p_waist[0], p_waist[1], p_waist[2]);
    const T_neg_waist = mat4Translation(-p_waist[0], -p_waist[1], -p_waist[2]);
    const R_torso_bend = mat4EulerRotation(torsoBend[0], torsoBend[1], torsoBend[2]);

    const p_shoulder_local: [number, number, number] =
      limbName === "right_arm" ? [-6, 0, 10] : [6, 0, 10];
    const T_shoulder = mat4Translation(
      p_shoulder_local[0],
      p_shoulder_local[1],
      p_shoulder_local[2]
    );

    // M_parent = M_root * M_body * T(p_waist) * R_Euler(theta_torso_bend) * T(-p_waist) * T(p_shoulder_local)
    const M_bend = mat4Multiply(T_waist, mat4Multiply(R_torso_bend, T_neg_waist));
    M_parent = mat4Multiply(M_root, mat4Multiply(M_body, mat4Multiply(M_bend, T_shoulder)));
  } else {
    // Legs parented to character root at hip
    const p_hip_local: [number, number, number] =
      limbName === "right_leg" ? [-2, 0, 12] : [2, 0, 12];
    const T_hip = mat4Translation(p_hip_local[0], p_hip_local[1], p_hip_local[2]);
    M_parent = mat4Multiply(M_root, T_hip);
  }

  // Invert M_parent to transform target P_t and pole vector P_p into shoulder local coordinates
  // where shoulder is at origin [0, 0, 0]
  const M_inv_parent = mat4InvertRigid(M_parent);
  const targetLocal = mat4TransformPoint(M_inv_parent, targetCoords);

  let poleLocal: [number, number, number] | undefined;
  if (options.poleVector) {
    poleLocal = mat4TransformVector(M_inv_parent, options.poleVector);
  }

  // Solve IK in shoulder local coordinates (shoulder at [0, 0, 0])
  const localSolution = solveLimbIK({
    shoulderPos: [0, 0, 0],
    targetPos: targetLocal,
    poleVector: poleLocal,
    limbType: limbName,
    limbLengths: options.limbLengths,
    jointLimitMin: options.jointLimitMin,
    jointLimitMax: options.jointLimitMax,
  });

  // Inject keyframe into limb timeline
  const kfValues: KeyframeValues = {
    ROT_X: localSolution.rot[0],
    ROT_Y: localSolution.rot[1],
    ROT_Z: localSolution.rot[2],
    BEND_ANGLE_X: localSolution.bend,
  };
  insertKeyframe(limbTimeline, frame, kfValues);

  // Transform solution positions back to world coordinates using M_parent
  const worldSolution: IKSolution = {
    ...localSolution,
    shoulderPos: mat4TransformPoint(M_parent, [0, 0, 0]),
    elbowPos: mat4TransformPoint(M_parent, localSolution.elbowPos),
    wristPos: mat4TransformPoint(M_parent, localSolution.wristPos),
  };

  return {
    success: true,
    solution: worldSolution,
    limbTimelineId: limbTimeline.id,
  };
}
