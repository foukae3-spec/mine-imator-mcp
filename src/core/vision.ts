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
 * Projects a 3D world coordinate onto the camera's 2D normalized device coordinates (NDC)
 * and pixel screen coordinates.
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
  const [rotX, rotY, rotZ] = cameraRot;
  const [tx, ty, tz] = targetPos;

  // Convert angles to radians
  const pitch = (rotX * Math.PI) / 180; // positive tilts down
  const roll = (rotY * Math.PI) / 180;
  const yaw = (rotZ * Math.PI) / 180; // 0 is North (+Y), 90 is East (+X)

  // Camera Forward vector (F)
  const Fx = Math.sin(yaw) * Math.cos(pitch);
  const Fy = Math.cos(yaw) * Math.cos(pitch);
  const Fz = -Math.sin(pitch);

  // Camera Right vector (R) before roll
  let Rx = Math.cos(yaw);
  let Ry = -Math.sin(yaw);
  let Rz = 0;

  // Camera Up vector (U) = R x F
  let Ux = Ry * Fz - Rz * Fy;
  let Uy = Rz * Fx - Rx * Fz;
  let Uz = Rx * Fy - Ry * Fx;

  // Apply camera roll around Forward axis if any
  if (Math.abs(roll) > 1e-6) {
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);
    const newRx = Rx * cosR + Ux * sinR;
    const newRy = Ry * cosR + Uy * sinR;
    const newRz = Rz * cosR + Uz * sinR;

    const newUx = -Rx * sinR + Ux * cosR;
    const newUy = -Ry * sinR + Uy * cosR;
    const newUz = -Rz * sinR + Uz * cosR;

    Rx = newRx;
    Ry = newRy;
    Rz = newRz;
    Ux = newUx;
    Uy = newUy;
    Uz = newUz;
  }

  // Vector from camera to target
  const vx = tx - cx;
  const vy = ty - cy;
  const vz = tz - cz;

  const distance = Math.sqrt(vx * vx + vy * vy + vz * vz);

  // Project vector onto camera axes
  const Xc = vx * Rx + vy * Ry + vz * Rz; // lateral offset (+ right)
  const Yc = vx * Fx + vy * Fy + vz * Fz; // depth along lens (+ forward)
  const Zc = vx * Ux + vy * Uy + vz * Uz; // vertical offset (+ up)

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

/**
 * Checks visibility and framing zone of an entity relative to a camera.
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

  // Resolve entity position at frame
  let entPos: [number, number, number] = [
    (entityTimeline.default_values?.POS_X as number) || 0,
    (entityTimeline.default_values?.POS_Y as number) || 0,
    (entityTimeline.default_values?.POS_Z as number) || 0,
  ];

  if (entityTimeline.keyframes && entityTimeline.keyframes[frameStr]) {
    const kf = entityTimeline.keyframes[frameStr];
    if (kf.POS_X !== undefined) entPos[0] = kf.POS_X;
    if (kf.POS_Y !== undefined) entPos[1] = kf.POS_Y;
    if (kf.POS_Z !== undefined) entPos[2] = kf.POS_Z;
  }

  // If character, add torso/head elevation offset (e.g. 16 units)
  if (entityTimeline.type === "char") {
    entPos[2] += 16;
  }

  const proj = projectToScreenSpace(
    camPos,
    camRot,
    entPos,
    fov,
    16 / 9,
    options.viewportWidth ?? 1280,
    options.viewportHeight ?? 720
  );

  let zone: EntityVisibilityReport["framingZone"] = "off_screen";
  if (proj.behindCamera) {
    zone = "behind_camera";
  } else if (!proj.inFrame) {
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
    inFrame: proj.inFrame,
    behindCamera: proj.behindCamera,
    screenCoords: proj.pixel,
    ndc: proj.ndc,
    depth: proj.depth,
    distance: proj.distance,
    framingZone: zone,
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
    const capRes = await captureMineimatorViewport(outPath, options.windowTitle);
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
