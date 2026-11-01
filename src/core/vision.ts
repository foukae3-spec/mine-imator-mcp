import * as fs from "node:fs";
import * as path from "node:path";
import { captureMineimatorViewport } from "../bridge/windows.js";
import {
  MiProject,
  TimelineNode,
} from "../types/miproject.js";
import { readProjectFile, resolveProjectPath } from "./project.js";

export interface ScreenProjectionResult {
  inFrame: boolean;
  behindCamera: boolean;
  ndc: [number, number]; // [-1 to 1, -1 to 1]
  pixel: [number, number]; // [0 to width, 0 to height]
  depth: number; // distance along camera optical axis
  distance: number; // Euclidean 3D distance
}

export interface OBBProjectionResult {
  inFrame: boolean;
  behindCamera: boolean;
  ndcMin: [number, number];
  ndcMax: [number, number];
  pixelBounds: { x: number; y: number; width: number; height: number };
  visibleCornersCount: number;
}

export interface EntityVisibilityReport {
  entityId: string;
  entityName: string;
  entityType: string;
  inFrame: boolean;
  behindCamera: boolean;
  screenCoords: [number, number];
  ndc: [number, number];
  depth: number;
  distance: number;
  framingZone:
    | "center"
    | "rule_of_thirds_left"
    | "rule_of_thirds_right"
    | "upper_third"
    | "lower_third"
    | "edge_cropped"
    | "off_screen"
    | "behind_camera";
  obb?: OBBProjectionResult;
  headKeypoint?: {
    inFrame: boolean;
    behindCamera: boolean;
    screenCoords: [number, number];
    ndc: [number, number];
    depth: number;
    framingZone: EntityVisibilityReport["framingZone"];
  };
}

export interface InterEntityDistance {
  entityAId: string;
  entityBId: string;
  distance3D: number;
  distancePlanar: number;
  deltaZ: number;
  withinInteractionReach: boolean; // <= 8 units
}

export interface GroundSnapResult {
  entityId: string;
  currentZ: number;
  surfaceZ: number;
  offsetNeeded: number;
  isGrounded: boolean;
  status: "grounded" | "floating" | "penetrating";
  snappedZ: number;
}

export interface SceneGraphNodeSummary {
  id: string;
  name: string;
  type: string;
  parent: string;
  position: [number, number, number];
  rotation: [number, number, number];
  keyframeCount: number;
  keyframeRange?: [number, number];
  childrenCount: number;
}

function cleanZero(val: number): number {
  return Object.is(val, -0) || Math.abs(val) < 1e-6 ? 0 : val;
}

/**
 * Transforms world coordinates to camera space using the full camera view matrix:
 * P_c = R_y(-Roll) * R_x(-Pitch) * R_z(-Yaw) * (P_w - C)
 */
export function transformWorldToCamera(
  cameraPos: [number, number, number],
  cameraRot: [number, number, number],
  worldPos: [number, number, number]
): [number, number, number] {
  const [cx, cy, cz] = cameraPos;
  const [rotX, rotY, rotZ] = cameraRot;
  const [wx, wy, wz] = worldPos;

  // Angles in radians
  const pitch = (rotX * Math.PI) / 180;
  const roll = (rotY * Math.PI) / 180;
  const yaw = (rotZ * Math.PI) / 180;

  // 1. Vector from camera: (P_w - C)
  const vx = wx - cx;
  const vy = wy - cy;
  const vz = wz - cz;

  // 2. R_z(-Yaw)
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const v1x = vx * cosY + vy * sinY;
  const v1y = -vx * sinY + vy * cosY;
  const v1z = vz;

  // 3. R_x(-Pitch)
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const v2x = v1x;
  const v2y = v1y * cosP + v1z * sinP;
  const v2z = -v1y * sinP + v1z * cosP;

  // 4. R_y(-Roll)
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  const Pcx = v2x * cosR - v2z * sinR;
  const Pcy = v2y;
  const Pcz = v2x * sinR + v2z * cosR;

  return [cleanZero(Pcx), cleanZero(Pcy), cleanZero(Pcz)];
}

/**
 * Projects a 3D world coordinate onto the camera's 2D normalized device coordinates (NDC)
 * and pixel screen coordinates using P_c = R_y(-Roll) * R_x(-Pitch) * R_z(-Yaw) * (P_w - C).
 */
export function projectToScreenSpace(
  cameraPos: [number, number, number],
  cameraRot: [number, number, number],
  targetPos: [number, number, number],
  fovDeg: number = 45,
  aspectRatio: number = 16 / 9,
  viewportWidth: number = 1280,
  viewportHeight: number = 720
): ScreenProjectionResult {
  const [cx, cy, cz] = cameraPos;
  const [tx, ty, tz] = targetPos;
  const vx = tx - cx;
  const vy = ty - cy;
  const vz = tz - cz;
  const distance = Math.sqrt(vx * vx + vy * vy + vz * vz);

  const [Xc, Yc, Zc] = transformWorldToCamera(cameraPos, cameraRot, targetPos);
  const behindCamera = Yc <= 0.001;

  // Perspective projection
  const tanHalfFov = Math.tan((fovDeg * Math.PI) / 360);
  const ndcX = cleanZero(Xc / (Math.max(0.001, Yc) * tanHalfFov * aspectRatio));
  const ndcY = cleanZero(Zc / (Math.max(0.001, Yc) * tanHalfFov));

  // Pixel screen coordinates (0, 0 top left)
  const pixelX = Math.round(((ndcX + 1) / 2) * viewportWidth);
  const pixelY = Math.round(((1 - ndcY) / 2) * viewportHeight);

  // In frame if in front of lens and within [-1.05, 1.05]
  const inFrame = !behindCamera && Math.abs(ndcX) <= 1.05 && Math.abs(ndcY) <= 1.05;

  return {
    inFrame,
    behindCamera,
    ndc: [ndcX, ndcY],
    pixel: [pixelX, pixelY],
    depth: cleanZero(Yc),
    distance: cleanZero(distance),
  };
}

export function getEntityLocalBoundingBox(
  entityType: string
): { min: [number, number, number]; max: [number, number, number] } {
  switch (entityType) {
    case "char":
      // Standard Minecraft biped: 8 wide (-4 to 4), 4 deep (-2 to 2), 32 tall (0 to 32)
      return {
        min: [-4, -2, 0],
        max: [4, 2, 32],
      };
    case "block":
      // Standard block in Mine-imator: 16x16x16
      return {
        min: [-8, -8, 0],
        max: [8, 8, 16],
      };
    case "item":
      return {
        min: [-4, -4, -4],
        max: [4, 4, 4],
      };
    default:
      return {
        min: [-8, -8, 0],
        max: [8, 8, 16],
      };
  }
}

export function computeEntityOBBWorldCorners(
  pos: [number, number, number],
  rot: [number, number, number],
  bounds: { min: [number, number, number]; max: [number, number, number] }
): [number, number, number][] {
  const [minX, minY, minZ] = bounds.min;
  const [maxX, maxY, maxZ] = bounds.max;

  const localCorners: [number, number, number][] = [
    [minX, minY, minZ], // 0: bottom-left-back
    [maxX, minY, minZ], // 1: bottom-right-back
    [maxX, maxY, minZ], // 2: bottom-right-front
    [minX, maxY, minZ], // 3: bottom-left-front
    [minX, minY, maxZ], // 4: top-left-back
    [maxX, minY, maxZ], // 5: top-right-back
    [maxX, maxY, maxZ], // 6: top-right-front
    [minX, maxY, maxZ], // 7: top-left-front
  ];

  const pitchRad = (rot[0] * Math.PI) / 180;
  const rollRad = (rot[1] * Math.PI) / 180;
  const yawRad = (rot[2] * Math.PI) / 180;

  const Fx = Math.sin(yawRad) * Math.cos(pitchRad);
  const Fy = Math.cos(yawRad) * Math.cos(pitchRad);
  const Fz = -Math.sin(pitchRad);

  let Rx = Math.cos(yawRad);
  let Ry = -Math.sin(yawRad);
  let Rz = 0;

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

  return localCorners.map(([lx, ly, lz]) => [
    pos[0] + lx * Rx + ly * Fx + lz * Ux,
    pos[1] + lx * Ry + ly * Fy + lz * Uy,
    pos[2] + lx * Rz + ly * Fz + lz * Uz,
  ]);
}

/**
 * Tests whether a 3D point is inside an entity's Oriented Bounding Box (OBB).
 */
export function isPointInsideOBB(
  point: [number, number, number],
  obbPos: [number, number, number],
  obbRot: [number, number, number],
  bounds: { min: [number, number, number]; max: [number, number, number] }
): boolean {
  const dx = point[0] - obbPos[0];
  const dy = point[1] - obbPos[1];
  const dz = point[2] - obbPos[2];

  const pitchRad = (obbRot[0] * Math.PI) / 180;
  const rollRad = (obbRot[1] * Math.PI) / 180;
  const yawRad = (obbRot[2] * Math.PI) / 180;

  const Fx = Math.sin(yawRad) * Math.cos(pitchRad);
  const Fy = Math.cos(yawRad) * Math.cos(pitchRad);
  const Fz = -Math.sin(pitchRad);

  let Rx = Math.cos(yawRad);
  let Ry = -Math.sin(yawRad);
  let Rz = 0;

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

  const lx = dx * Rx + dy * Ry + dz * Rz;
  const ly = dx * Fx + dy * Fy + dz * Fz;
  const lz = dx * Ux + dy * Uy + dz * Uz;

  return (
    lx >= bounds.min[0] - 1e-4 &&
    lx <= bounds.max[0] + 1e-4 &&
    ly >= bounds.min[1] - 1e-4 &&
    ly <= bounds.max[1] + 1e-4 &&
    lz >= bounds.min[2] - 1e-4 &&
    lz <= bounds.max[2] + 1e-4
  );
}

/**
 * Evaluates entity 8-corner Oriented Bounding Box (OBB) against camera view frustum
 * with near-plane clipping (P_c,y >= 1.0).
 */
export function projectOBBToScreenSpace(
  cameraPos: [number, number, number],
  cameraRot: [number, number, number],
  obbWorldCorners: [number, number, number][],
  fovDeg: number = 45,
  aspectRatio: number = 16 / 9,
  viewportWidth: number = 1280,
  viewportHeight: number = 720,
  nearClip: number = 1.0,
  cameraInside: boolean = false
): OBBProjectionResult {
  if (cameraInside) {
    return {
      inFrame: true,
      behindCamera: false,
      ndcMin: [-1, -1],
      ndcMax: [1, 1],
      pixelBounds: { x: 0, y: 0, width: viewportWidth, height: viewportHeight },
      visibleCornersCount: 8,
    };
  }

  const cameraCorners = obbWorldCorners.map((cw) =>
    transformWorldToCamera(cameraPos, cameraRot, cw)
  );

  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0], // bottom face
    [4, 5], [5, 6], [6, 7], [7, 4], // top face
    [0, 4], [1, 5], [2, 6], [3, 7], // vertical edges
  ];

  const survivingPoints: [number, number, number][] = [];
  let visibleCornersCount = 0;

  for (const pt of cameraCorners) {
    if (pt[1] >= nearClip) {
      survivingPoints.push(pt);
      visibleCornersCount++;
    }
  }

  // Clip edges crossing the near-clip plane (P_c,y = nearClip)
  for (const [i, j] of edges) {
    const p1 = cameraCorners[i];
    const p2 = cameraCorners[j];
    const y1 = p1[1];
    const y2 = p2[1];

    if ((y1 >= nearClip && y2 < nearClip) || (y1 < nearClip && y2 >= nearClip)) {
      const t = (nearClip - y1) / (y2 - y1);
      const clipped: [number, number, number] = [
        p1[0] + t * (p2[0] - p1[0]),
        nearClip,
        p1[2] + t * (p2[2] - p1[2]),
      ];
      survivingPoints.push(clipped);
    }
  }

  if (survivingPoints.length === 0) {
    return {
      inFrame: false,
      behindCamera: true,
      ndcMin: [-1, -1],
      ndcMax: [-1, -1],
      pixelBounds: { x: 0, y: 0, width: 0, height: 0 },
      visibleCornersCount: 0,
    };
  }

  const tanHalfFov = Math.tan((fovDeg * Math.PI) / 360);
  let minNdcX = Infinity;
  let maxNdcX = -Infinity;
  let minNdcY = Infinity;
  let maxNdcY = -Infinity;

  for (const [xc, yc, zc] of survivingPoints) {
    const depth = Math.max(0.001, yc);
    const ndcX = xc / (depth * tanHalfFov * aspectRatio);
    const ndcY = zc / (depth * tanHalfFov);
    if (ndcX < minNdcX) minNdcX = ndcX;
    if (ndcX > maxNdcX) maxNdcX = ndcX;
    if (ndcY < minNdcY) minNdcY = ndcY;
    if (ndcY > maxNdcY) maxNdcY = ndcY;
  }

  minNdcX = cleanZero(minNdcX);
  maxNdcX = cleanZero(maxNdcX);
  minNdcY = cleanZero(minNdcY);
  maxNdcY = cleanZero(maxNdcY);

  const pxMin = Math.round(((minNdcX + 1) / 2) * viewportWidth);
  const pxMax = Math.round(((maxNdcX + 1) / 2) * viewportWidth);
  const pyMin = Math.round(((1 - maxNdcY) / 2) * viewportHeight);
  const pyMax = Math.round(((1 - minNdcY) / 2) * viewportHeight);

  // In frame if any portion overlaps NDC view boundary [-1.05, 1.05]^2
  const inFrame =
    minNdcX <= 1.05 && maxNdcX >= -1.05 &&
    minNdcY <= 1.05 && maxNdcY >= -1.05;

  return {
    inFrame,
    behindCamera: false,
    ndcMin: [minNdcX, minNdcY],
    ndcMax: [maxNdcX, maxNdcY],
    pixelBounds: {
      x: pxMin,
      y: pyMin,
      width: Math.max(0, pxMax - pxMin),
      height: Math.max(0, pyMax - pyMin),
    },
    visibleCornersCount,
  };
}

/**
 * Checks visibility, 8-corner OBB bounds, and Head/Face Keypoint Framing of an entity relative to a camera.
 */
export function checkEntityVisibility(
  cameraTimeline: TimelineNode,
  entityTimeline: TimelineNode,
  options: {
    frame?: number;
    fov?: number;
    viewportWidth?: number;
    viewportHeight?: number;
  } = {}
): EntityVisibilityReport {
  const frame = options.frame ?? 0;
  const frameStr = Math.round(frame).toString();
  const viewportWidth = options.viewportWidth ?? 1280;
  const viewportHeight = options.viewportHeight ?? 720;

  // Resolve camera position and rotation at frame
  let camPos: [number, number, number] = [
    (cameraTimeline.default_values?.POS_X as number) || 0,
    (cameraTimeline.default_values?.POS_Y as number) || 0,
    (cameraTimeline.default_values?.POS_Z as number) || 0,
  ];
  let camRot: [number, number, number] = [
    (cameraTimeline.default_values?.ROT_X as number) || 0,
    (cameraTimeline.default_values?.ROT_Y as number) || 0,
    (cameraTimeline.default_values?.ROT_Z as number) || 0,
  ];
  let fov = options.fov ?? ((cameraTimeline.default_values?.CAM_FOV as number) || 45);

  if (cameraTimeline.keyframes && cameraTimeline.keyframes[frameStr]) {
    const kf = cameraTimeline.keyframes[frameStr];
    if (kf.POS_X !== undefined) camPos[0] = kf.POS_X;
    if (kf.POS_Y !== undefined) camPos[1] = kf.POS_Y;
    if (kf.POS_Z !== undefined) camPos[2] = kf.POS_Z;
    if (kf.ROT_X !== undefined) camRot[0] = kf.ROT_X;
    if (kf.ROT_Y !== undefined) camRot[1] = kf.ROT_Y;
    if (kf.ROT_Z !== undefined) camRot[2] = kf.ROT_Z;
    if (kf.CAM_FOV !== undefined) fov = kf.CAM_FOV;
  }

  // Resolve entity raw position and rotation at frame
  let entPosRaw: [number, number, number] = [
    (entityTimeline.default_values?.POS_X as number) || 0,
    (entityTimeline.default_values?.POS_Y as number) || 0,
    (entityTimeline.default_values?.POS_Z as number) || 0,
  ];
  let entRot: [number, number, number] = [
    (entityTimeline.default_values?.ROT_X as number) || 0,
    (entityTimeline.default_values?.ROT_Y as number) || 0,
    (entityTimeline.default_values?.ROT_Z as number) || 0,
  ];

  if (entityTimeline.keyframes && entityTimeline.keyframes[frameStr]) {
    const kf = entityTimeline.keyframes[frameStr];
    if (kf.POS_X !== undefined) entPosRaw[0] = kf.POS_X;
    if (kf.POS_Y !== undefined) entPosRaw[1] = kf.POS_Y;
    if (kf.POS_Z !== undefined) entPosRaw[2] = kf.POS_Z;
    if (kf.ROT_X !== undefined) entRot[0] = kf.ROT_X;
    if (kf.ROT_Y !== undefined) entRot[1] = kf.ROT_Y;
    if (kf.ROT_Z !== undefined) entRot[2] = kf.ROT_Z;
  }

  // Center reference position for classic point projection
  const centerPos: [number, number, number] = [entPosRaw[0], entPosRaw[1], entPosRaw[2]];
  if (entityTimeline.type === "char") {
    centerPos[2] += 16;
  }

  const proj = projectToScreenSpace(
    camPos,
    camRot,
    centerPos,
    fov,
    16 / 9,
    viewportWidth,
    viewportHeight
  );

  // 8-Corner OBB Frustum Projection with near-plane clipping
  const bounds = getEntityLocalBoundingBox(entityTimeline.type);
  const cameraInside = isPointInsideOBB(camPos, entPosRaw, entRot, bounds);
  const obbCorners = computeEntityOBBWorldCorners(entPosRaw, entRot, bounds);
  const obbResult = projectOBBToScreenSpace(
    camPos,
    camRot,
    obbCorners,
    fov,
    16 / 9,
    viewportWidth,
    viewportHeight,
    1.0,
    cameraInside
  );

  // Separate Head/Face Keypoint Projection for rule-of-thirds composition
  let headKeypoint: EntityVisibilityReport["headKeypoint"] | undefined;
  if (entityTimeline.type === "char") {
    const headOffset: [number, number, number] = [0, 0, 28];
    const headCorners = computeEntityOBBWorldCorners(entPosRaw, entRot, {
      min: headOffset,
      max: headOffset,
    });
    const headProj = projectToScreenSpace(
      camPos,
      camRot,
      headCorners[0],
      fov,
      16 / 9,
      viewportWidth,
      viewportHeight
    );

    let headZone: EntityVisibilityReport["framingZone"] = "off_screen";
    if (headProj.behindCamera) {
      headZone = "behind_camera";
    } else if (!headProj.inFrame) {
      headZone = "off_screen";
    } else if (Math.abs(headProj.ndc[0]) > 0.95 || Math.abs(headProj.ndc[1]) > 0.95) {
      headZone = "edge_cropped";
    } else if (Math.abs(headProj.ndc[0]) < 0.25 && Math.abs(headProj.ndc[1]) < 0.25) {
      headZone = "center";
    } else if (headProj.ndc[0] < -0.2) {
      headZone = "rule_of_thirds_left";
    } else if (headProj.ndc[0] > 0.2) {
      headZone = "rule_of_thirds_right";
    } else if (headProj.ndc[1] > 0.2) {
      headZone = "upper_third";
    } else {
      headZone = "lower_third";
    }

    headKeypoint = {
      inFrame: headProj.inFrame,
      behindCamera: headProj.behindCamera,
      screenCoords: headProj.pixel,
      ndc: headProj.ndc,
      depth: headProj.depth,
      framingZone: headZone,
    };
  }

  // Overall inFrame combines OBB and center projection
  const inFrame = obbResult.inFrame || proj.inFrame;
  const behindCamera = obbResult.behindCamera && proj.behindCamera;

  let zone: EntityVisibilityReport["framingZone"] = "off_screen";
  if (behindCamera) {
    zone = "behind_camera";
  } else if (!inFrame) {
    zone = "off_screen";
  } else if (Math.abs(proj.ndc[0]) > 0.95 || Math.abs(proj.ndc[1]) > 0.95) {
    zone = "edge_cropped";
  } else if (Math.abs(proj.ndc[0]) < 0.25 && Math.abs(proj.ndc[1]) < 0.25) {
    zone = "center";
  } else if (proj.ndc[0] < -0.2) {
    zone = "rule_of_thirds_left";
  } else if (proj.ndc[0] > 0.2) {
    zone = "rule_of_thirds_right";
  } else if (proj.ndc[1] > 0.2) {
    zone = "upper_third";
  } else {
    zone = "lower_third";
  }

  return {
    entityId: entityTimeline.id,
    entityName: entityTimeline.name || entityTimeline.id,
    entityType: entityTimeline.type,
    inFrame,
    behindCamera,
    screenCoords: proj.pixel,
    ndc: proj.ndc,
    depth: proj.depth,
    distance: proj.distance,
    framingZone: zone,
    obb: obbResult,
    headKeypoint,
  };
}

/**
 * Computes 3D Euclidean and planar distances between two entities.
 */
export function measureInterEntityDistance(
  entityA: TimelineNode,
  entityB: TimelineNode,
  frame: number = 0
): InterEntityDistance {
  const frameStr = Math.round(frame).toString();

  const getPos = (tl: TimelineNode): [number, number, number] => {
    let p: [number, number, number] = [
      (tl.default_values?.POS_X as number) || 0,
      (tl.default_values?.POS_Y as number) || 0,
      (tl.default_values?.POS_Z as number) || 0,
    ];
    if (tl.keyframes && tl.keyframes[frameStr]) {
      const kf = tl.keyframes[frameStr];
      if (kf.POS_X !== undefined) p[0] = kf.POS_X;
      if (kf.POS_Y !== undefined) p[1] = kf.POS_Y;
      if (kf.POS_Z !== undefined) p[2] = kf.POS_Z;
    }
    return p;
  };

  const posA = getPos(entityA);
  const posB = getPos(entityB);

  const dx = posB[0] - posA[0];
  const dy = posB[1] - posA[1];
  const dz = posB[2] - posA[2];

  const distance3D = cleanZero(Math.sqrt(dx * dx + dy * dy + dz * dz));
  const distancePlanar = cleanZero(Math.sqrt(dx * dx + dy * dy));

  return {
    entityAId: entityA.id,
    entityBId: entityB.id,
    distance3D,
    distancePlanar,
    deltaZ: cleanZero(dz),
    withinInteractionReach: distance3D <= 12,
  };
}

/**
 * Detects whether an entity is floating or penetrating the ground surface.
 */
export function groundSnapCheck(
  entityTimeline: TimelineNode,
  surfaceZ: number = 0,
  frame: number = 0
): GroundSnapResult {
  const frameStr = Math.round(frame).toString();

  let curZ = (entityTimeline.default_values?.POS_Z as number) || 0;
  if (entityTimeline.keyframes && entityTimeline.keyframes[frameStr]) {
    const kf = entityTimeline.keyframes[frameStr];
    if (kf.POS_Z !== undefined) curZ = kf.POS_Z;
  }

  const offset = surfaceZ - curZ;
  const isGrounded = Math.abs(offset) < 0.1;
  const status = isGrounded ? "grounded" : offset > 0 ? "penetrating" : "floating";

  return {
    entityId: entityTimeline.id,
    currentZ: cleanZero(curZ),
    surfaceZ: cleanZero(surfaceZ),
    offsetNeeded: cleanZero(offset),
    isGrounded,
    status,
    snappedZ: cleanZero(surfaceZ),
  };
}

/**
 * Summarizes the entire 3D scene graph, providing AI models with a bird's-eye view.
 */
export function inspectSceneGraph(project: MiProject): {
  project_name: string;
  totalEntities: number;
  entities: SceneGraphNodeSummary[];
  timelineSpan: [number, number];
} {
  const entities: SceneGraphNodeSummary[] = [];
  let minFrame = Infinity;
  let maxFrame = -Infinity;

  for (const tl of project.timelines) {
    const keys = Object.keys(tl.keyframes || {}).map((k) => parseInt(k, 10));
    let kfRange: [number, number] | undefined;
    if (keys.length > 0) {
      const mn = Math.min(...keys);
      const mx = Math.max(...keys);
      kfRange = [mn, mx];
      if (mn < minFrame) minFrame = mn;
      if (mx > maxFrame) maxFrame = mx;
    }

    const childrenCount = project.timelines.filter(
      (child) => child.parent === tl.id || child.part_of === tl.id
    ).length;

    entities.push({
      id: tl.id,
      name: tl.name || tl.model_part_name || tl.id,
      type: tl.type,
      parent: tl.parent,
      position: [
        (tl.default_values?.POS_X as number) || 0,
        (tl.default_values?.POS_Y as number) || 0,
        (tl.default_values?.POS_Z as number) || 0,
      ],
      rotation: [
        (tl.default_values?.ROT_X as number) || 0,
        (tl.default_values?.ROT_Y as number) || 0,
        (tl.default_values?.ROT_Z as number) || 0,
      ],
      keyframeCount: keys.length,
      keyframeRange: kfRange,
      childrenCount,
    });
  }

  return {
    project_name: project.project?.name || "Untitled",
    totalEntities: project.timelines.length,
    entities,
    timelineSpan: [
      minFrame === Infinity ? 0 : minFrame,
      maxFrame === -Infinity ? 0 : maxFrame,
    ],
  };
}

/**
 * Renders or captures a viewport frame and calculates 2D screen bounding boxes for in-frame entities.
 */
export async function renderAndInspectFrame(
  projectPath: string,
  options: {
    frame?: number;
    cameraName?: string;
    windowTitle?: string;
    outputImagePath?: string;
    showRuleOfThirds?: boolean;
    show_rule_of_thirds?: boolean;
  } = {}
): Promise<{
  success: boolean;
  imagePath?: string;
  imageBase64?: string;
  cameraUsed?: string;
  entitiesInView: EntityVisibilityReport[];
  totalInView: number;
}> {
  const filePath = resolveProjectPath(projectPath);
  const project = readProjectFile(filePath);

  const frame = options.frame ?? 0;
  const outPath = options.outputImagePath || path.resolve(process.cwd(), "viewport_live.png");

  // Find camera
  const cameras = project.timelines.filter((t) => t.type === "camera");
  let activeCam = cameras[0];
  if (options.cameraName) {
    const found = cameras.find((c) => c.name === options.cameraName);
    if (found) activeCam = found;
  }

  const entitiesInView: EntityVisibilityReport[] = [];

  if (activeCam) {
    const rootEntities = project.timelines.filter(
      (t) => t.type !== "camera" && t.parent === "root"
    );
    for (const ent of rootEntities) {
      const rep = checkEntityVisibility(activeCam, ent, { frame });
      if (rep.inFrame) {
        entitiesInView.push(rep);
      }
    }
  }

  // Attempt window capture
  let captured = false;
  try {
    const showOverlay = options.showRuleOfThirds ?? options.show_rule_of_thirds ?? false;
    const capRes = captureMineimatorViewport(outPath, options.windowTitle, showOverlay);
    captured = capRes.success;
  } catch {
    captured = false;
  }

  let base64: string | undefined;
  if (captured && fs.existsSync(outPath)) {
    try {
      base64 = fs.readFileSync(outPath).toString("base64");
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    imagePath: captured ? outPath : undefined,
    imageBase64: base64,
    cameraUsed: activeCam?.name || activeCam?.id,
    entitiesInView,
    totalInView: entitiesInView.length,
  };
}
