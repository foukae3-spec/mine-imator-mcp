import { describe, it, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  buildBirchForestHill,
  buildCottagePorch,
  buildRuinedCottage,
  buildGrieferSkybase,
  buildBedrockVoid,
  spawnStructure,
  createSceneSet,
} from "../core/structures.js";
import { createNewProject } from "../core/project.js";
import { validateMiProject } from "../schema/validation.js";

describe("Voxel Architecture & Scenery Builder", () => {
  after(() => {
    ["temp_struct.miproject", "temp_set.miproject"].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });
  it("should generate cottage porch block specs with floor, fence, steps, lanterns, and flowers", () => {
    const blocks = buildCottagePorch([0, 0, 0]);
    assert.ok(blocks.length >= 10);
    const names = blocks.map((b) => b.name);
    assert.ok(names.includes("oak_planks"));
    assert.ok(names.includes("cobblestone"));
    assert.ok(names.includes("oak_fence"));
    assert.ok(names.includes("lantern"));
    assert.ok(names.includes("blue_orchid"));
  });

  it("should generate birch forest hill with stepped terrain and trees", () => {
    const blocks = buildBirchForestHill([100, 200, 0], 3);
    assert.ok(blocks.length >= 8);
    const names = blocks.map((b) => b.name);
    assert.ok(names.includes("grass_block"));
    assert.ok(names.includes("birch_log"));
    assert.ok(names.includes("birch_leaves"));
  });

  it("should generate ruined cottage with fire and charred pillars", () => {
    const blocks = buildRuinedCottage([0, 1000, 0]);
    const names = blocks.map((b) => b.name);
    assert.ok(names.includes("coal_block"));
    assert.ok(names.includes("dark_oak_log"));
    assert.ok(names.includes("fire"));
  });

  it("should generate griefer skybase with diamond blocks, obsidian, chests, and lava", () => {
    const blocks = buildGrieferSkybase([0, 2000, 150]);
    const names = blocks.map((b) => b.name);
    assert.ok(names.includes("diamond_block"));
    assert.ok(names.includes("obsidian"));
    assert.ok(names.includes("chest"));
    assert.ok(names.includes("lava"));
    assert.ok(names.includes("tnt"));
  });

  it("should generate bedrock void pedestal", () => {
    const blocks = buildBedrockVoid([0, 3500, 0]);
    const names = blocks.map((b) => b.name);
    assert.ok(names.includes("bedrock"));
    assert.ok(names.includes("grass_block"));
  });

  it("should spawn structure into MiProject and pass validation", () => {
    const { project } = createNewProject({ project_path: "temp_struct.miproject" });
    const res = spawnStructure(project, "cottage_porch", [0, 0, 0]);

    assert.equal(res.success, true);
    assert.ok(res.blocksAdded > 0);
    assert.equal(project.templates.length, res.blocksAdded);
    assert.equal(project.timelines.length, res.blocksAdded);

    const report = validateMiProject(project);
    assert.equal(report.valid, true);
  });

  it("should create segregated scene set with dedicated shot camera", () => {
    const { project } = createNewProject({ project_path: "temp_set.miproject" });
    const manifest = createSceneSet(project, {
      name: "Ruins Set",
      setId: "set_ruins_02",
      origin: [0, 1000, 0],
      structurePreset: "ruined_cottage",
      createCamera: true,
    });

    assert.equal(manifest.name, "Ruins Set");
    assert.ok(manifest.cameraId);
    assert.ok(manifest.blockCount > 0);

    const cameraTl = project.timelines.find((t) => t.id === manifest.cameraId);
    assert.ok(cameraTl);
    assert.equal(cameraTl.type, "camera");
    assert.equal(cameraTl.default_values.POS_Y, 1000 - 65);

    const report = validateMiProject(project);
    assert.equal(report.valid, true);
  });
});
