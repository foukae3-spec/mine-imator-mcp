import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  createNewProject,
  readProjectFile,
  resolveProjectPath,
  writeProjectFile,
} from "../core/project.js";

describe("Project Management", () => {
  const tempDir = path.join(os.tmpdir(), "mineimator_test_" + Date.now());

  it("should create a fresh project with Format 34 defaults", () => {
    const projDir = path.join(tempDir, "TestScene");
    const res = createNewProject({
      project_path: projDir,
      name: "Test Scene",
      author: "Test Author",
      description: "Automated test project",
      tempo: 30,
      video_width: 1920,
      video_height: 1080,
      render_settings: "high",
    });

    assert.equal(fs.existsSync(res.projectFilePath), true);
    assert.equal(res.project.format, 34);
    assert.equal(res.project.created_in, "2.0.2");
    assert.equal(res.project.project.name, "Test Scene");
    assert.equal(res.project.project.tempo, 30);
    assert.equal(res.project.project.video_width, 1920);
    assert.equal(res.project.project.video_height, 1080);
    assert.equal(res.project.render.render_ssao, true); // high preset enables SSAO
    assert.equal(res.project.render.render_reflections, true);
    assert.equal(Array.isArray(res.project.templates), true);
    assert.equal(Array.isArray(res.project.timelines), true);
    assert.equal(Array.isArray(res.project.resources), true);
  });

  it("should read and parse existing project correctly", () => {
    const projDir = path.join(tempDir, "TestScene");
    const proj = readProjectFile(projDir);
    assert.equal(proj.format, 34);
    assert.equal(proj.project.name, "Test Scene");
  });

  it("should throw informative error on non-existent project", () => {
    assert.throws(
      () => {
        readProjectFile("C:/non_existent_path/Project.miproject");
      },
      {
        message: /does not exist/,
      }
    );
  });

  it("should resolve directory paths to companion .miproject file", () => {
    const projDir = path.join(tempDir, "TestScene");
    const resolved = resolveProjectPath(projDir);
    assert.equal(resolved.endsWith("TestScene.miproject"), true);
  });
});
