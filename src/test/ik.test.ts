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

  it("should solve IK with hierarchical parent FK chain when torso bends forward", () => {
    const testPath = "C:/Users/RocKeR/.gemini/antigravity/scratch/mine-imator-mcp/test_ik_torso_bend.miproject";
    const { project } = createNewProject({ project_path: testPath });
    const char = buildCharacterHierarchy({
      name: "Bending Steve",
      position: [0, 0, 0],
    });
    project.templates.push(char.template);
    project.timelines.push(char.rootTimeline, ...char.parts);

    // Apply torso bend (BEND_ANGLE_X = 30) on body timeline
    const bodyTl = char.parts.find((p) => p.model_part_name === "body")!;
    bodyTl.default_values = {
      ...bodyTl.default_values,
      BEND_ANGLE_X: 30,
    };

    // Target is in front of character at [0, 12, 18]
    const res = applyIKToCharacter(
      project.timelines,
      char.rootTimeline.id,
      "right_arm",
      [0, 12, 18],
      { frame: 0 }
    );

    assert.equal(res.success, true);
    // The shoulder should have rotated forward and down around waist pivot (Z = 18)
    assert.ok(res.solution.shoulderPos[1] > 0, `Expected bent shoulder Y > 0, got ${res.solution.shoulderPos[1]}`);
    assert.ok(res.solution.shoulderPos[2] < 22, `Expected bent shoulder Z < 22, got ${res.solution.shoulderPos[2]}`);
    assert.ok(!isNaN(res.solution.rot[0]), "rotX must not be NaN");
    assert.ok(!isNaN(res.solution.bend), "bend must not be NaN");

    if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
  });

  it("should avoid NaN singularity when direction vector D is collinear with pole vector (Gram-Schmidt fallback)", () => {
    // Target is directly in line with pole vector (both along +Y)
    const solCollinear = solveLimbIK({
      shoulderPos: [0, 0, 0],
      targetPos: [0, 10, 0],
      poleVector: [0, 10, 0], // exactly collinear!
      limbType: "right_arm",
    });

    assert.ok(!isNaN(solCollinear.rot[0]), `rotX should not be NaN, got ${solCollinear.rot[0]}`);
    assert.ok(!isNaN(solCollinear.rot[1]), `rotY should not be NaN, got ${solCollinear.rot[1]}`);
    assert.ok(!isNaN(solCollinear.rot[2]), `rotZ should not be NaN, got ${solCollinear.rot[2]}`);
    assert.ok(!isNaN(solCollinear.bend), `bend should not be NaN, got ${solCollinear.bend}`);
    assert.ok(!isNaN(solCollinear.elbowPos[0]), "elbowPos[0] should not be NaN");
    assert.ok(!isNaN(solCollinear.elbowPos[1]), "elbowPos[1] should not be NaN");
    assert.ok(!isNaN(solCollinear.elbowPos[2]), "elbowPos[2] should not be NaN");

    // Antiparallel collinear (opposite direction)
    const solAntiCollinear = solveLimbIK({
      shoulderPos: [0, 0, 0],
      targetPos: [0, 10, 0],
      poleVector: [0, -10, 0],
      limbType: "right_arm",
    });

    assert.ok(!isNaN(solAntiCollinear.rot[0]));
    assert.ok(!isNaN(solAntiCollinear.bend));
  });

  it("should clamp joint bend angles strictly to natural limits [0, 140 deg] even if extreme limits passed", () => {
    // Attempt to pass negative minLimit and oversized maxLimit
    const sol1 = solveLimbIK({
      shoulderPos: [0, 0, 0],
      targetPos: [0, 0, 0], // zero distance -> extreme bend
      jointLimitMin: -50,
      jointLimitMax: 200,
    });
    assert.ok(sol1.bend <= 140, `Bend must be <= 140, got ${sol1.bend}`);
    assert.ok(sol1.bend >= 0, `Bend must be >= 0, got ${sol1.bend}`);

    // Straight reach: bend should be clamped at minimum 0
    const sol2 = solveLimbIK({
      shoulderPos: [0, 0, 0],
      targetPos: [0, 0, -10],
      jointLimitMin: -30,
    });
    assert.ok(sol2.bend >= 0, `Bend must be >= 0, got ${sol2.bend}`);
    assert.ok(sol2.bend <= 140, `Bend must be <= 140, got ${sol2.bend}`);
  });

  it("should preserve exact physical bone lengths (L1 and L2) across arbitrary 3D reach and pole vectors", () => {
    const testCases: { target: [number, number, number]; pole?: [number, number, number] }[] = [
      { target: [4, 4, 0], pole: [0, 0, 1] },
      { target: [-3, 5, -2], pole: [-1, -1, 0] },
      { target: [2, 6, 1], pole: [0, 1, 0] },
      { target: [0, 3, -4] },
    ];

    for (const tc of testCases) {
      const sol = solveLimbIK({
        shoulderPos: [10, 20, 30],
        targetPos: [10 + tc.target[0], 20 + tc.target[1], 30 + tc.target[2]],
        poleVector: tc.pole,
        limbType: "right_arm",
      });

      const dUpper = Math.hypot(
        sol.elbowPos[0] - sol.shoulderPos[0],
        sol.elbowPos[1] - sol.shoulderPos[1],
        sol.elbowPos[2] - sol.shoulderPos[2]
      );
      const dLower = Math.hypot(
        sol.wristPos[0] - sol.elbowPos[0],
        sol.wristPos[1] - sol.elbowPos[1],
        sol.wristPos[2] - sol.elbowPos[2]
      );

      assert.ok(
        Math.abs(dUpper - 4) < 1e-4,
        `Expected upper arm length 4, got ${dUpper} for target ${tc.target}`
      );
      assert.ok(
        Math.abs(dLower - 6) < 1e-4,
        `Expected lower arm length 6, got ${dLower} for target ${tc.target}`
      );
    }
  });

  it("should preserve bone lengths in world space under full parent FK chain with torso bend and pole vector", () => {
    const testPath = "C:/Users/RocKeR/.gemini/antigravity/scratch/mine-imator-mcp/test_ik_fk_lengths.miproject";
    const { project } = createNewProject({ project_path: testPath });
    const char = buildCharacterHierarchy({
      name: "FK Steve",
      position: [10, -5, 4],
      rotation: [0, 0, 45],
    });
    project.templates.push(char.template);
    project.timelines.push(char.rootTimeline, ...char.parts);

    const bodyTl = char.parts.find((p) => p.model_part_name === "body")!;
    bodyTl.default_values = {
      ...bodyTl.default_values,
      BEND_ANGLE_X: 25,
      ROT_Z: 15,
    };

    const res = applyIKToCharacter(
      project.timelines,
      char.rootTimeline.id,
      "right_arm",
      [15, 5, 20],
      { frame: 0, poleVector: [0, -1, 0] }
    );

    assert.equal(res.success, true);
    const dUpper = Math.hypot(
      res.solution.elbowPos[0] - res.solution.shoulderPos[0],
      res.solution.elbowPos[1] - res.solution.shoulderPos[1],
      res.solution.elbowPos[2] - res.solution.shoulderPos[2]
    );
    const dLower = Math.hypot(
      res.solution.wristPos[0] - res.solution.elbowPos[0],
      res.solution.wristPos[1] - res.solution.elbowPos[1],
      res.solution.wristPos[2] - res.solution.elbowPos[2]
    );

    assert.ok(Math.abs(dUpper - 4) < 1e-3, `Expected world L1 ~4, got ${dUpper}`);
    assert.ok(Math.abs(dLower - 6) < 1e-3, `Expected world L2 ~6, got ${dLower}`);

    if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
  });
});
