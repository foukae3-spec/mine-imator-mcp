import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { is_valid_save_id, save_id_create } from "../core/id.js";

describe("Save ID Generator", () => {
  it("should generate a 16-character uppercase alphanumeric ID", () => {
    const id = save_id_create();
    assert.equal(id.length, 16);
    assert.match(id, /^[A-Z0-9]{16}$/);
    assert.equal(is_valid_save_id(id), true);
  });

  it("should generate 1000 unique IDs without collision", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = save_id_create();
      assert.equal(set.has(id), false, `Collision detected on id ${id}`);
      set.add(id);
    }
    assert.equal(set.size, 1000);
  });

  it("should validate valid and invalid IDs correctly", () => {
    assert.equal(is_valid_save_id("Z00I261N875B8Q4T"), true);
    assert.equal(is_valid_save_id("3KB5G62T8PETQ012"), true);
    // Invalid cases:
    assert.equal(is_valid_save_id(""), false);
    assert.equal(is_valid_save_id("short"), false);
    assert.equal(is_valid_save_id("toolongstring123456"), false);
    assert.equal(is_valid_save_id("z00i261n875b8q4t"), false); // lowercase
    assert.equal(is_valid_save_id("Z00I261N-75B8Q4T"), false); // hyphens
    assert.equal(is_valid_save_id(null), false);
    assert.equal(is_valid_save_id(undefined), false);
    assert.equal(is_valid_save_id(1234567890123456), false);
  });
});
