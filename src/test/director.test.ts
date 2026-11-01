import { describe, it, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  addCameraShake,
  compileStoryboard,
  createShotCamera,
  FRAMING_PRESETS,
  generateDollyZoom,
} from "../core/director.js";
import { createNewProject } from "../core/project.js";

describe("Director's Shot Engine & Framing Rules", () => {
  after(() => {
    [
      "temp_cam.miproject",
      "temp_cam2.miproject",
      "temp_dz.miproject",
      "temp_shake.miproject",
      "temp_sb.miproject",
      "temp_sb_err.miproject",
      "temp_sb_cam.miproject",
    ].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });
  it("should verify Hollywood framing preset values", () => {
    assert.equal(FRAMING_PRESETS.extreme_close_up.fov, 25);
    assert.equal(FRAMING_PRESETS.close_up.fov, 35);
    assert.equal(FRAMING_PRESETS.medium.fov, 45);
    assert.equal(FRAMING_PRESETS.wide.fov, 65);
    assert.equal(FRAMING_PRESETS.over_the_shoulder.fov, 38);
  });

  it("should create shot camera targeting subject with accurate look-at rotation", () => {
    const { project } = createNewProject({ project_path: "temp_cam.miproject" });
    const res = createShotCamera(project, {
      name: "Cam_Subject_CloseUp",
      subjectPos: [0, 100, 20],
      framing: "close_up",
      angleYawDeg: 0,
    });

    assert.equal(res.success, true);
    assert.equal(res.fov, 35);
    // Camera placed in front along -Y
    assert.equal(res.position[0], 0);
    assert.equal(res.position[1], 100 - FRAMING_PRESETS.close_up.distance);

    const camTl = project.timelines.find((t) => t.id === res.cameraId);
    assert.ok(camTl);
    assert.equal(camTl.default_values.CAM_FOV, 35);
  });

  it("should compute exact mathematical dolly zoom FOV matching subject height invariance", () => {
    const { project } = createNewProject({ project_path: "temp_dz.miproject" });
    const camRes = createShotCamera(project, {
      name: "DollyCam",
      subjectPos: [0, 0, 0],
      cameraPos: [0, -20, 16],
    });

    const camTl = project.timelines.find((t) => t.id === camRes.cameraId)!;

    // Dolly from distance 20 to distance 40 with start FOV 45
    const dzRes = generateDollyZoom(project.timelines, {
      cameraTimelineId: camTl.id,
      subjectPos: [0, 0, 0],
      startFrame: 0,
      endFrame: 48,
      startDistance: 20,
      endDistance: 40,
      startFov: 45,
    });

    assert.equal(dzRes.success, true);
    assert.ok(dzRes.keyframesAdded >= 5);

    // Theoretical end FOV:
    // 20 * tan(45/2 deg) = 40 * tan(fov1/2 deg)
    // tan(fov1/2) = 0.5 * tan(22.5 deg) ~ 0.5 * 0.41421 = 0.207106
    // fov1/2 ~ 11.701 deg => fov1 ~ 23.4 deg
    assert.ok(Math.abs(dzRes.endFov - 23.4) < 0.5, `Expected ~23.4, got ${dzRes.endFov}`);
  });

  it("should inject high-frequency decaying camera shake keyframes", () => {
    const { project } = createNewProject({ project_path: "temp_shake.miproject" });
    const camRes = createShotCamera(project, {
      name: "ShakeCam",
      subjectPos: [0, 0, 0],
    });

    const shakeRes = addCameraShake(project.timelines, {
      cameraTimelineId: camRes.cameraId,
      startFrame: 10,
      durationFrames: 20,
      magnitude: 6.0,
      decay: "exponential",
    });

    assert.equal(shakeRes.success, true);
    assert.ok(shakeRes.keyframesAdded > 8);

    const camTl = project.timelines.find((t) => t.id === camRes.cameraId)!;
    // Check keyframe at peak shake
    const kfPeak = camTl.keyframes["12"];
    assert.ok(kfPeak);
    assert.notEqual(kfPeak.ROT_X, camTl.default_values.ROT_X);
  });

  it("should compile a multi-shot storyboard manifest into total timeline length", () => {
    const { project } = createNewProject({ project_path: "temp_sb.miproject" });
    const res = compileStoryboard(project, [
      { shotName: "Shot 1", cameraId: "cam1", startFrame: 0, endFrame: 100 },
      { shotName: "Shot 2", cameraId: "cam2", startFrame: 101, endFrame: 250 },
      { shotName: "Shot 3", cameraId: "cam3", startFrame: 251, endFrame: 500 },
    ]);

    assert.equal(res.success, true);
    assert.equal(res.totalShots, 3);
    assert.equal(res.timelineLength, 500);
    assert.ok(project.storyboard);
  });

  it("should set camera elevation based on framing preset in createShotCamera", () => {
    const { project } = createNewProject({ project_path: "temp_cam2.miproject" });
    const res = createShotCamera(project, {
      name: "Cam_CloseUp_Elevation",
      subjectPos: [0, 50, 0],
      framing: "close_up",
    });

    assert.equal(res.position[2], 0 + FRAMING_PRESETS.close_up.elevationOffset);
  });

  it("should reject storyboard shots with invalid or inverted frame ranges", () => {
    const { project } = createNewProject({ project_path: "temp_sb_err.miproject" });
    assert.throws(
      () =>
        compileStoryboard(project, [
          { shotName: "Bad Shot", cameraId: "cam1", startFrame: -5, endFrame: 10 },
        ]),
      /startFrame must be a non-negative number/
    );

    assert.throws(
      () =>
        compileStoryboard(project, [
          { shotName: "Zero Shot", cameraId: "cam1", startFrame: 50, endFrame: 50 },
        ]),
      /must be greater than startFrame/
    );
  });

  it("should reject storyboard shot when camera timeline does not exist in project", () => {
    const { project } = createNewProject({ project_path: "temp_sb_cam.miproject" });
    const cam = createShotCamera(project, { name: "RealCam", subjectPos: [0, 0, 0] });

    assert.throws(
      () =>
        compileStoryboard(project, [
          { shotName: "Missing Cam Shot", cameraId: "non_existent_cam_id", startFrame: 0, endFrame: 100 },
        ]),
      /Camera timeline 'non_existent_cam_id' not found in project/
    );
  });
});
