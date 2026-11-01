import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { listMinecraftAssets } from "../bridge/assets.js";
import { stageProjectForLaunch } from "../bridge/recent.js";
import { importSchematic } from "../bridge/schematic.js";
import { createNewProject } from "../core/project.js";

describe("Assets & Desktop Bridge", () => {
  it("should query Minecraft 1.20.2 assets catalog", () => {
    const chars = listMinecraftAssets({ category: "characters" });
    assert.equal(chars.category, "characters");
    assert.equal(chars.total_matches > 0, true);
    assert.equal(
      chars.assets.some((c: any) => c.name === "human" || c.name === "zombie"),
      true
    );

    const swords = listMinecraftAssets({ category: "items", filter: "sword" });
    assert.equal(swords.category, "items");
    assert.equal(swords.total_matches > 0, true);
    assert.equal(
      swords.assets.some((i: any) => i.name.includes("sword")),
      true
    );
  });

  it("should stage project into mock recent.midata without error", () => {
    const tempDir = path.join(os.tmpdir(), "mineimator_stage_" + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    const projRes = createNewProject({
      project_path: path.join(tempDir, "StageTest"),
      name: "Stage Test",
    });

    const stageRes = stageProjectForLaunch(projRes.projectFilePath, {
      dataDir: tempDir,
      launchNow: false,
    });

    assert.equal(stageRes.success, true);
    assert.equal(fs.existsSync(stageRes.recentMidataPath), true);

    const recentJson = JSON.parse(
      fs.readFileSync(stageRes.recentMidataPath, "utf-8")
    );
    assert.equal(recentJson.list.length, 1);
    assert.equal(recentJson.list[0].name, "Stage Test");
    assert.equal(recentJson.list[0].pinned, true);
  });

  it("should import schematic into project", () => {
    const tempDir = path.join(os.tmpdir(), "mineimator_schem_" + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    const projRes = createNewProject({
      project_path: path.join(tempDir, "SchemTest"),
      name: "Schem Test",
    });

    // Create a mock schematic file
    const mockSchemPath = path.join(tempDir, "house.schematic");
    fs.writeFileSync(mockSchemPath, "MOCK_SCHEMATIC_DATA");

    const res = importSchematic({
      project_path: projRes.projectFilePath,
      schematic_path: mockSchemPath,
      name: "Cozy House",
      position: [10, 20, 0],
    });

    assert.equal(typeof res.resourceId, "string");
    assert.equal(typeof res.templateId, "string");
    assert.equal(typeof res.timelineId, "string");
    assert.equal(res.schematicFileName, "house.schematic");
  });
});
