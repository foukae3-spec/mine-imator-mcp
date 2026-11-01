import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { buildCharacterHierarchy } from "../core/hierarchy.js";
import { is_valid_save_id } from "../core/id.js";

describe("Character Rigging and Hierarchy", () => {
  it("should build complete biped hierarchy for Steve", () => {
    const result = buildCharacterHierarchy({
      name: "Steve",
      model_name: "human",
      variant: "steve",
      type: "wide",
      position: [10, 20, 30],
      rotation: [0, 90, 0],
    });

    assert.equal(is_valid_save_id(result.template.id), true);
    assert.equal(is_valid_save_id(result.rootTimeline.id), true);
    assert.equal(result.parts.length, 7);
    assert.equal(result.rootTimeline.parts?.length, 7);

    // Verify part names
    const partNames = result.parts.map((p) => p.model_part_name);
    assert.deepEqual(partNames, [
      "hat",
      "head",
      "right_arm",
      "left_arm",
      "body",
      "right_leg",
      "left_leg",
    ]);

    // Verify parenting
    const body = result.parts.find((p) => p.model_part_name === "body")!;
    const head = result.parts.find((p) => p.model_part_name === "head")!;
    const hat = result.parts.find((p) => p.model_part_name === "hat")!;
    const rightArm = result.parts.find((p) => p.model_part_name === "right_arm")!;
    const leftArm = result.parts.find((p) => p.model_part_name === "left_arm")!;
    const rightLeg = result.parts.find((p) => p.model_part_name === "right_leg")!;
    const leftLeg = result.parts.find((p) => p.model_part_name === "left_leg")!;

    // body -> root
    assert.equal(body.parent, result.rootTimeline.id);
    assert.equal(body.part_of, result.rootTimeline.id);

    // head -> body
    assert.equal(head.parent, body.id);
    assert.equal(head.part_of, result.rootTimeline.id);

    // hat -> head
    assert.equal(hat.parent, head.id);
    assert.equal(hat.part_of, result.rootTimeline.id);

    // arms -> body
    assert.equal(rightArm.parent, body.id);
    assert.equal(leftArm.parent, body.id);

    // legs -> root
    assert.equal(rightLeg.parent, result.rootTimeline.id);
    assert.equal(leftLeg.parent, result.rootTimeline.id);

    // Default values
    assert.equal(result.rootTimeline.default_values.POS_X, 10);
    assert.equal(result.rootTimeline.default_values.POS_Y, 20);
    assert.equal(result.rootTimeline.default_values.POS_Z, 30);
    assert.equal(result.rootTimeline.default_values.ROT_Y, 90);
  });
});
