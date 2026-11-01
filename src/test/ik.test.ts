import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { solveLimbIK, applyIKToCharacter, DEFAULT_LIMB_LENGTHS } from "../core/ik.js";
import { createNewProject } from "../core/project.js";
import { buildCharacterHierarchy } from "../core/hierarchy.js";

describe("Analytical Inverse Kinematics (IK) Engine", () => {
  it("should solve straight down target with zero elbow bend", () => {
    // Shoulder at [0, 0, 22], Target at [0, 0, 12] (distance 10 = 4 + 6, full reach)
    const sol = solveLimbIK({
      shoulderPos: [0, 0, 22],
      targetPos: [0, 0, 12],
      limbType: "right_arm",
    });

    assert.equal(sol.inReach, true);
    assert.equal(sol.clamped, false);
    assert.ok(Math.abs(sol.bend) < 0.1, `Expected bend ~0, got ${sol.bend}`);
    assert.ok(Math.abs(sol.rot[0]) < 0.1, `Expected rotX ~0, got ${sol.rot[0]}`);
  });

  it("should solve forward horizontal reach at distance 10", () => {
    // Shoulder at [0, 0, 22], Target at [0, 10, 22] (straight forward along +Y)
    const sol = solveLimbIK({
      shoulderPos: [0, 0, 22],
      targetPos: [0, 10, 22],
      limbType: "right_arm",
    });

    assert.equal(sol.inReach, true);
    assert.ok(Math.abs(sol.bend) < 0.1, `Expected bend ~0, got ${sol.bend}`);
    // Upper arm should pitch forward 90 degrees
    assert.ok(Math.abs(sol.rot[0] - 90) < 0.5, `Expected rotX ~90, got ${sol.rot[0]}`);
  });

  it("should compute exact 90-degree elbow bend when target is at hypotenuse distance", () => {
    // L1 = 4, L2 = 6. Target at distance d = sqrt(4^2 + 6^2) = sqrt(52) ~ 7.2111
    // Law of cosines: cos(theta) = (16 + 36 - 52) / 48 = 0 => theta = 90 deg => bend = 90 deg!
    const sol = solveLimbIK({
      shoulderPos: [0, 0, 22],
      targetPos: [0, 6, 18], // dy = 6, dz = -4
      limbType: "right_arm",
    });

    assert.equal(sol.inReach, true);
    assert.ok(Math.abs(sol.bend - 90) < 0.1, `Expected bend ~90, got ${sol.bend}`);
  });

  it("should clamp out-of-reach target to max reach without breaking", () => {
    // Target way out at distance 100
    const sol = solveLimbIK({
      shoulderPos: [0, 0, 22],
      targetPos: [0, 100, 22],
      limbType: "right_arm",
    });

    assert.equal(sol.inReach, false);
    assert.equal(sol.clamped, true);
    assert.ok(sol.bend <= 140 && sol.bend >= 0);
  });

  it("should respect joint limit clamps for knee/elbow", () => {
    // Force extreme angle
    const sol = solveLimbIK({
      shoulderPos: [0, 0, 22],
      targetPos: [0, 0.5, 20],
      limbType: "right_arm",
      jointLimitMax: 120,
    });

    assert.ok(sol.bend <= 120, `Expected bend <= 120, got ${sol.bend}`);
    assert.ok(sol.bend >= 0, `Expected bend >= 0, got ${sol.bend}`);
  });

  it("should apply IK solution directly to a character hierarchy in project", () => {
    const testPath = "C:/Users/RocKeR/.gemini/antigravity/scratch/mine-imator-mcp/test_ik_char.miproject";
    const { project } = createNewProject({ project_path: testPath });
    const char = buildCharacterHierarchy({ name: "IK Steve", position: [0, 0, 0] });
    project.templates.push(char.template);
    project.timelines.push(char.rootTimeline, ...char.parts);

    const res = applyIKToCharacter(
      project.timelines,
      char.rootTimeline.id,
      "right_arm",
      [0, 8, 20], // hand reaching forward
      { frame: 12 }
    );

    assert.equal(res.success, true);
    assert.ok(res.solution);

    // Verify keyframe was injected into right_arm timeline
    const rightArmTl = project.timelines.find((t) => t.id === res.limbTimelineId);
    assert.ok(rightArmTl);
    assert.ok(rightArmTl.keyframes["12"]);
    assert.equal(typeof rightArmTl.keyframes["12"].ROT_X, "number");
    assert.equal(typeof rightArmTl.keyframes["12"].BEND_ANGLE_X, "number");

    if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
  });

  it("should handle distance = 0 without error or NaN", () => {
    // Shoulder and target identical
    const sol = solveLimbIK({
      shoulderPos: [0, 0, 22],
      targetPos: [0, 0, 22],
      limbType: "right_arm",
    });

    assert.equal(sol.distance, 0);
    assert.equal(sol.clamped, true);
    assert.equal(sol.inReach, false);
    assert.ok(!isNaN(sol.bend));
    assert.ok(!isNaN(sol.rot[0]));
    assert.ok(!isNaN(sol.rot[1]));
    assert.ok(!isNaN(sol.rot[2]));
  });

  it("should compute correct lateral rotation (rotZ) for right and left limbs", () => {
    // Target 10 units to character's right (-X)
    const solRight = solveLimbIK({
      shoulderPos: [-6, 0, 22],
      targetPos: [-16, 0, 22],
      limbType: "right_arm",
    });
    // For right arm, reaching right (-X) corresponds to positive rotZ in Mine-imator
    assert.ok(solRight.rot[2] > 45, `Expected rotZ > 45, got ${solRight.rot[2]}`);

    // Target 10 units to character's left (+X)
    const solLeft = solveLimbIK({
      shoulderPos: [6, 0, 22],
      targetPos: [16, 0, 22],
      limbType: "left_arm",
    });
    // For left arm, reaching left (+X) corresponds to negative rotZ in Mine-imator
    assert.ok(solLeft.rot[2] < -45, `Expected rotZ < -45, got ${solLeft.rot[2]}`);
  });

  it("should solve vertical upward reach with dz > 0", () => {
    // Target 10 units straight up above shoulder
    const sol = solveLimbIK({
      shoulderPos: [0, 0, 22],
      targetPos: [0, 0, 32],
      limbType: "right_arm",
    });

    assert.equal(sol.inReach, true);
    // Arm pitches straight up (180 deg)
    assert.ok(Math.abs(sol.rot[0] - 180) < 1.0, `Expected rotX ~180, got ${sol.rot[0]}`);
  });

  it("should solve IK accurately for character rotated 180 degrees", () => {
    const testPath = "C:/Users/RocKeR/.gemini/antigravity/scratch/mine-imator-mcp/test_ik_rot.miproject";
    const { project } = createNewProject({ project_path: testPath });
    // Character facing South (ROT_Z = 180) at [0, 20, 0]
    const char = buildCharacterHierarchy({
      name: "Rotated Alex",
      position: [0, 20, 0],
      rotation: [0, 0, 180],
    });
    project.templates.push(char.template);
    project.timelines.push(char.rootTimeline, ...char.parts);

    // Target is in front of character in world space (at [0, 10, 20])
    const res = applyIKToCharacter(
      project.timelines,
      char.rootTimeline.id,
      "right_arm",
      [0, 10, 20],
      { frame: 0 }
    );

    assert.equal(res.success, true);
    // In local space, character reaches forward towards the target (pitch > 0)
    const rightArmTl = project.timelines.find((t) => t.id === res.limbTimelineId)!;
    assert.ok(rightArmTl.keyframes["0"]?.ROT_X! > 0, `Expected ROT_X > 0, got ${rightArmTl.keyframes["0"]?.ROT_X}`);

    if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
  });
});
