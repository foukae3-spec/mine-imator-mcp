import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  POSE_LIBRARY,
  applyPoseToCharacter,
  getPose,
  listAvailablePoses,
} from "../core/poses.js";
import { buildCharacterHierarchy } from "../core/hierarchy.js";

describe("Anatomical Minecraft Pose Library", () => {
  it("should contain all 15 standard verified poses", () => {
    const poses = listAvailablePoses();
    assert.ok(poses.length >= 15);
    const names = poses.map((p) => p.name);
    assert.ok(names.includes("heroic_stand"));
    assert.ok(names.includes("kneel_offer"));
    assert.ok(names.includes("death_tilt"));
    assert.ok(names.includes("god_mode_levitate"));
    assert.ok(names.includes("griefer_shift_twerk"));
    assert.ok(names.includes("bow_aim"));
    assert.ok(names.includes("cradle_body"));
    assert.ok(names.includes("shock_freeze"));
    assert.ok(names.includes("sword_strike"));
    assert.ok(names.includes("shield_block"));
    assert.ok(names.includes("sitting"));
    assert.ok(names.includes("celebrate"));
    assert.ok(names.includes("sprint"));
    assert.ok(names.includes("falling"));
    assert.ok(names.includes("command_invoke"));
  });

  it("should verify POSE_KNEEL_OFFER has bent legs and extended arm", () => {
    const pose = getPose("kneel_offer");
    assert.ok(pose);
    assert.ok(pose.parts.right_leg);
    assert.ok(pose.parts.left_leg);
    assert.ok(pose.parts.right_arm);
    // Right leg bent back with high bend angle
    assert.equal(pose.parts.right_leg?.BEND_ANGLE_X, 88);
    // Right arm extended
    assert.equal(pose.parts.right_arm?.ROT_X, 52);
  });

  it("should verify POSE_DEATH_TILT has 90-degree roll", () => {
    const pose = getPose("death_tilt");
    assert.ok(pose);
    assert.equal(pose.parts.root?.ROT_Y, 90);
  });

  it("should apply pose to a character hierarchy at a specified frame", () => {
    const char = buildCharacterHierarchy({ name: "Pose Steve" });
    const allTimelines = [char.rootTimeline, ...char.parts];

    const res = applyPoseToCharacter(
      allTimelines,
      char.rootTimeline.id,
      "god_mode_levitate",
      24,
      "easeinoutcubic"
    );

    assert.equal(res.success, true);
    assert.equal(res.frame, 24);
    assert.ok(res.affectedTimelines.length >= 4);

    // Verify root elevation keyframe
    assert.equal(char.rootTimeline.keyframes["24"]?.POS_Z, 48);
    assert.equal(char.rootTimeline.keyframes["24"]?.TRANSITION, "easeinoutcubic");

    // Verify arms spread wide
    const rightArm = allTimelines.find((t) => t.model_part_name === "right_arm");
    assert.ok(rightArm);
    assert.equal(rightArm.keyframes["24"]?.ROT_Z, 65);
  });

  it("should throw a clear error for an unknown pose", () => {
    const char = buildCharacterHierarchy({ name: "Test" });
    assert.throws(
      () => applyPoseToCharacter([char.rootTimeline], char.rootTimeline.id, "nonexistent_pose"),
      /not found in library/
    );
  });
});
