import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  clearKeyframes,
  generateCameraPath,
  generateWalkCycle,
  insertKeyframe,
} from "../core/animation.js";
import { buildCharacterHierarchy } from "../core/hierarchy.js";
import { save_id_create } from "../core/id.js";
import { TimelineNode } from "../types/miproject.js";

describe("Animation Engine", () => {
  it("should insert keyframes correctly", () => {
    const tl: TimelineNode = {
      id: save_id_create(),
      type: "char",
      name: "Test",
      temp: "null",
      default_values: {},
      keyframes: {},
      parent: "root",
      parent_tree_index: 0,
      inherit: {
        position: true,
        rotation: true,
        scale: true,
        alpha: false,
        color: false,
        texture: false,
        visibility: true,
        bend: false,
        rot_point: false,
        glow_color: true,
        select: false,
      },
    };

    insertKeyframe(tl, 0, { POS_X: 10, POS_Y: 20 });
    insertKeyframe(tl, 24, { POS_X: 50, POS_Y: 80, TRANSITION: "easeinoutquad" });

    assert.equal(tl.keyframes["0"]?.POS_X, 10);
    assert.equal(tl.keyframes["0"]?.POS_Y, 20);
    assert.equal(tl.keyframes["24"]?.POS_X, 50);
    assert.equal(tl.keyframes["24"]?.TRANSITION, "easeinoutquad");
  });

  it("should generate natural walk cycle across limbs", () => {
    const char = buildCharacterHierarchy({ name: "Alex" });
    const allTimelines = [char.rootTimeline, ...char.parts];

    const res = generateWalkCycle(allTimelines, {
      character_timeline_id: char.rootTimeline.id,
      start_frame: 0,
      end_frame: 48,
      cycle_length: 24,
      arm_swing_angle: 30,
      leg_swing_angle: 30,
      bob_height: 1.5,
      forward_travel: 100,
    });

    assert.equal(res.keyframesAdded > 0, true);
    assert.equal(res.affectedTimelines.length > 0, true);

    const rightArm = char.parts.find((p) => p.model_part_name === "right_arm")!;
    const leftArm = char.parts.find((p) => p.model_part_name === "left_arm")!;
    const rightLeg = char.parts.find((p) => p.model_part_name === "right_leg")!;
    const body = char.parts.find((p) => p.model_part_name === "body")!;

    // Check keyframe existence
    assert.equal(typeof rightArm.keyframes["0"], "object");
    assert.equal(typeof leftArm.keyframes["0"], "object");
    assert.equal(typeof rightLeg.keyframes["0"], "object");
    assert.equal(typeof body.keyframes["0"], "object");

    // Check forward movement on root
    assert.equal(typeof char.rootTimeline.keyframes["0"]?.POS_Y, "number");
    assert.equal(char.rootTimeline.keyframes["48"]?.POS_Y, 100);
  });

  it("should generate camera path with look-at calculations", () => {
    const camTl: TimelineNode = {
      id: save_id_create(),
      type: "camera",
      name: "Camera",
      temp: "null",
      default_values: {},
      keyframes: {},
      parent: "root",
      parent_tree_index: 0,
      inherit: {
        position: true,
        rotation: true,
        scale: true,
        alpha: false,
        color: false,
        texture: false,
        visibility: true,
        bend: false,
        rot_point: false,
        glow_color: true,
        select: false,
      },
    };

    const res = generateCameraPath([camTl], {
      camera_timeline_id: camTl.id,
      waypoints: [
        { frame: 0, position: [0, -100, 20], look_at: [0, 0, 16] },
        { frame: 48, position: [100, 0, 40], look_at: [0, 0, 16] },
      ],
      smooth: true,
      sample_interval: 12,
    });

    assert.equal(res.keyframesAdded > 0, true);
    // At frame 0: camera is at (0, -100, 20), target is (0, 0, 16)
    // dx = 0, dy = 100, dz = -4
    // ROT_Z should be 0 (looking straight North +Y)
    const kf0 = camTl.keyframes["0"];
    assert.equal(kf0?.POS_X, 0);
    assert.equal(kf0?.POS_Y, -100);
    assert.equal(kf0?.ROT_Z, 0);
    assert.equal(kf0?.ROT_X !== undefined, true);
  });

  it("should clear keyframes correctly across deep multi-level hierarchies", () => {
    const char = buildCharacterHierarchy({ name: "Zombie" });
    const rightArm = char.parts.find((p) => p.model_part_name === "right_arm")!;

    // Create an item attached to right arm (grandchild of root)
    const itemNode: TimelineNode = {
      id: save_id_create(),
      type: "item",
      name: "Sword",
      temp: "null",
      default_values: {},
      keyframes: {},
      parent: rightArm.id,
      parent_tree_index: 0,
      inherit: {
        position: true,
        rotation: true,
        scale: true,
        alpha: false,
        color: false,
        texture: false,
        visibility: true,
        bend: false,
        rot_point: false,
        glow_color: true,
        select: false,
      },
    };

    const allTimelines = [char.rootTimeline, ...char.parts, itemNode];

    generateWalkCycle(allTimelines, {
      character_timeline_id: char.rootTimeline.id,
      start_frame: 0,
      end_frame: 48,
    });

    insertKeyframe(itemNode, 10, { POS_X: 5 });
    insertKeyframe(itemNode, 30, { POS_X: 15 });

    // Clear frames 24 to 48 recursively on the root character
    const cleared = clearKeyframes(allTimelines, char.rootTimeline.id, 24, 48, true);
    assert.equal(cleared > 0, true);

    // Frame 0 should still exist on arms
    assert.equal(typeof rightArm.keyframes["0"], "object");
    // Frame 24 should be deleted on arms
    assert.equal(rightArm.keyframes["24"], undefined);
    // Item at frame 10 should still exist
    assert.equal(typeof itemNode.keyframes["10"], "object");
    // Item at frame 30 (in range 24-48) must be cleared!
    assert.equal(itemNode.keyframes["30"], undefined);
  });

  it("should guarantee exact endpoint keyframing even when interval does not divide span", () => {
    const camTl: TimelineNode = {
      id: save_id_create(),
      type: "camera",
      name: "Cam",
      temp: "null",
      default_values: {},
      keyframes: {},
      parent: "root",
      parent_tree_index: 0,
      inherit: {
        position: true,
        rotation: true,
        scale: true,
        alpha: false,
        color: false,
        texture: false,
        visibility: true,
        bend: false,
        rot_point: false,
        glow_color: true,
        select: false,
      },
    };

    generateCameraPath([camTl], {
      camera_timeline_id: camTl.id,
      waypoints: [
        { frame: 0, position: [0, 0, 0] },
        { frame: 10, position: [100, 200, 50] },
      ],
      smooth: true,
      sample_interval: 4,
    });

    // Frame 10 MUST be present
    assert.equal(typeof camTl.keyframes["10"], "object");
    assert.equal(camTl.keyframes["10"]?.POS_X, 100);
    assert.equal(camTl.keyframes["10"]?.POS_Y, 200);
    assert.equal(camTl.keyframes["10"]?.POS_Z, 50);
  });

  it("should handle waypoint with look_at only on the destination waypoint", () => {
    const camTl: TimelineNode = {
      id: save_id_create(),
      type: "camera",
      name: "CamTarget",
      temp: "null",
      default_values: {},
      keyframes: {},
      parent: "root",
      parent_tree_index: 0,
      inherit: {
        position: true,
        rotation: true,
        scale: true,
        alpha: false,
        color: false,
        texture: false,
        visibility: true,
        bend: false,
        rot_point: false,
        glow_color: true,
        select: false,
      },
    };

    generateCameraPath([camTl], {
      camera_timeline_id: camTl.id,
      waypoints: [
        { frame: 0, position: [0, 0, 0], rotation: [0, 0, 0] },
        { frame: 12, position: [10, 0, 0], look_at: [50, 50, 0] },
      ],
      smooth: true,
      sample_interval: 4,
    });

    // Destination at frame 12 should be oriented towards [50, 50, 0]
    // dx = 40, dy = 50, dz = 0 -> yaw = atan2(40, 50) ~= +38.66 degrees
    const kf12 = camTl.keyframes["12"];
    assert.equal(typeof kf12, "object");
    assert.notEqual(kf12?.ROT_Z, 0);
    assert.equal(kf12?.ROT_Z! > 0, true);
  });

  it("should compute exact look-at Euler angles matching Mine-imator coordinate system", async () => {
    const { computeLookAtAngles } = await import("../core/animation.js");

    // Scenario 1: Target directly North (+Y): yaw = 0, pitch = 0
    const [pNorth, rNorth, yNorth] = computeLookAtAngles([0, 0, 10], [0, 100, 10]);
    assert.equal(pNorth, 0);
    assert.equal(rNorth, 0);
    assert.equal(yNorth, 0);

    // Scenario 2: Target directly East (+X): yaw = +90
    const [pEast, , yEast] = computeLookAtAngles([0, 0, 10], [100, 0, 10]);
    assert.equal(pEast, 0);
    assert.equal(yEast, 90);

    // Scenario 3: Target directly West (-X): yaw = -90
    const [pWest, , yWest] = computeLookAtAngles([0, 0, 10], [-100, 0, 10]);
    assert.equal(pWest, 0);
    assert.equal(yWest, -90);

    // Scenario 4: Target directly South (-Y): yaw = 180
    const [pSouth, , ySouth] = computeLookAtAngles([0, 0, 10], [0, -100, 10]);
    assert.equal(pSouth, 0);
    assert.equal(Math.abs(ySouth), 180);

    // Scenario 5: User Demo Case - Eye [-80, -60, 35], Steve [0, 0, 18]
    // Target is lower (dz = -17) -> pitch must be positive (+9.65 deg) to tilt down
    // Target is to the right and forward (dx = +80, dy = +60) -> yaw must be positive (+53.13 deg)
    const [pitchDemo, rollDemo, yawDemo] = computeLookAtAngles([-80, -60, 35], [0, 0, 18]);
    assert.equal(rollDemo, 0);
    assert.equal(Math.round(pitchDemo * 100) / 100, 9.65);
    assert.equal(Math.round(yawDemo * 100) / 100, 53.13);
  });
});
