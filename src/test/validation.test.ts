import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { createNewProject, readProjectFile } from "../core/project.js";
import { validateMiProject } from "../schema/validation.js";

describe("Project Validation & Linting", () => {
  it("should validate a newly created project as valid", () => {
    const tempPath = "C:/Users/RocKeR/.gemini/antigravity/scratch/mine-imator-mcp/test_valid.miproject";
    const res = createNewProject({ project_path: tempPath, name: "Validation Test" });
    const report = validateMiProject(res.project);

    assert.equal(report.valid, true);
    assert.equal(report.errors.length, 0);
    assert.equal(report.stats.format, 34);

    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  });

  it("should validate real-world project oussama project.miproject", () => {
    const realProjPath = "D:/Mine-imator/Projects/oussama project/oussama project.miproject";
    if (fs.existsSync(realProjPath)) {
      const proj = readProjectFile(realProjPath);
      const report = validateMiProject(proj);
      assert.equal(report.valid, true);
      assert.equal(report.stats.format, 34);
      assert.equal(report.stats.timelines_count > 0, true);
      assert.equal(report.stats.keyframes_count > 0, true);
    }
  });

  it("should catch corrupted IDs and broken references", () => {
    const brokenProject = {
      format: 34,
      templates: [
        { id: "SHORT_ID", type: "char" }, // invalid ID
      ],
      timelines: [
        {
          id: "VALIDID12345678A",
          type: "char",
          temp: "NON_EXISTENT_TEMP", // broken template reference
          parent: "MISSING_PARENT_ID", // broken parent reference
          keyframes: {
            "-1": {}, // invalid negative frame
          },
        },
      ],
      resources: [],
    };

    const report = validateMiProject(brokenProject);
    assert.equal(report.valid, false);
    assert.equal(report.errors.length >= 3, true);
    assert.equal(
      report.errors.some((e) => e.includes("Invalid template ID format")),
      true
    );
    assert.equal(
      report.errors.some((e) => e.includes("non-existent template")),
      true
    );
    assert.equal(
      report.errors.some((e) => e.includes("orphaned parent")),
      true
    );
    assert.equal(
      report.errors.some((e) => e.includes("invalid frame index")),
      true
    );
  });

  it("should catch duplicate IDs across entities", () => {
    const duplicateProject = {
      format: 34,
      templates: [
        { id: "DUPLICATE1234567", type: "char" },
      ],
      timelines: [
        {
          id: "DUPLICATE1234567", // duplicate!
          type: "char",
          temp: "DUPLICATE1234567",
          parent: "root",
          keyframes: {},
        },
      ],
      resources: [],
    };

    const report = validateMiProject(duplicateProject);
    assert.equal(report.valid, false);
    assert.equal(
      report.errors.some((e) => e.includes("Duplicate ID")),
      true
    );
  });

  it("should catch cyclic parent hierarchies", () => {
    const cyclicProject = {
      format: 34,
      templates: [],
      resources: [],
      timelines: [
        { id: "NODEA12345678901", type: "char", parent: "NODEB12345678901", keyframes: {} },
        { id: "NODEB12345678901", type: "char", parent: "NODEA12345678901", keyframes: {} },
      ],
    };

    const report = validateMiProject(cyclicProject);
    assert.equal(report.valid, false);
    assert.equal(
      report.errors.some((e) => e.includes("Cycle detected")),
      true
    );
  });

  it("should catch self-referential parent", () => {
    const selfProject = {
      format: 34,
      templates: [],
      resources: [],
      timelines: [
        { id: "SELFPARENT123456", type: "char", parent: "SELFPARENT123456", keyframes: {} },
      ],
    };

    const report = validateMiProject(selfProject);
    assert.equal(report.valid, false);
    assert.equal(
      report.errors.some((e) => e.includes("self-referential parent")),
      true
    );
  });

  it("should catch missing top-level templates and resources arrays", () => {
    const missingProject = {
      format: 34,
      timelines: [],
    };

    const report = validateMiProject(missingProject);
    assert.equal(report.valid, false);
    assert.equal(report.errors.some((e) => e.includes("Missing 'templates'")), true);
    assert.equal(report.errors.some((e) => e.includes("Missing 'resources'")), true);
  });
});
