import { describe, it, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  createExplosionBurstEmitter,
  createFirePlumeEmitter,
  createOrbitalLaserBeam,
  createSmokeColumnEmitter,
  createXPDissolveEmitter,
  spawnParticleEmitter,
} from "../core/particles.js";
import { createNewProject } from "../core/project.js";
import { validateMiProject } from "../schema/validation.js";

describe("Native Particle Emitters & Visual FX", () => {
  after(() => {
    ["temp_part.miproject", "temp_part2.miproject", "temp_part3.miproject", "temp_part4.miproject"].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });
  it("should spawn fire plume emitter and inject template & timeline", () => {
    const { project } = createNewProject({ project_path: "temp_part.miproject" });
    const res = createFirePlumeEmitter(project, [10, 20, 0], 45);

    assert.equal(res.success, true);
    assert.equal(res.emitterType, "fire_plume");

    const template = project.templates.find((t) => t.id === res.templateId);
    assert.ok(template);
    assert.equal(template.type, "particles");

    const timeline = project.timelines.find((t) => t.id === res.timelineId);
    assert.ok(timeline);
    assert.equal(timeline.type, "particles");
    assert.equal(timeline.default_values.POS_X, 10);
  });

  it("should handle duration frames by inserting stop keyframe", () => {
    const { project } = createNewProject({ project_path: "temp_part2.miproject" });
    const res = spawnParticleEmitter(project, {
      name: "Burst",
      type: "explosion_burst",
      position: [0, 0, 0],
      startFrame: 50,
      durationFrames: 20,
    });

    const timeline = project.timelines.find((t) => t.id === res.timelineId);
    assert.ok(timeline);
    assert.equal(timeline.keyframes["50"]?.SPAWN, true);
    assert.equal(timeline.keyframes["70"]?.SPAWN, false);
  });

  it("should generate orbital laser beam emitter with high emission", () => {
    const { project } = createNewProject({ project_path: "temp_part3.miproject" });
    const res = createOrbitalLaserBeam(project, [50, 50, 0], "#FF00FF", 100, 40);

    assert.equal(res.success, true);
    const template = project.templates.find((t) => t.id === res.templateId);
    assert.ok(template);
    const p = (template.particles as { types: { color?: string }[] })?.types[0];
    assert.equal(p?.color, "#FF00FF");
  });

  it("should validate a project containing multiple particle emitters", () => {
    const { project } = createNewProject({ project_path: "temp_part4.miproject" });
    createFirePlumeEmitter(project, [0, 0, 0]);
    createSmokeColumnEmitter(project, [0, 10, 0]);
    createExplosionBurstEmitter(project, [0, 20, 0]);
    createXPDissolveEmitter(project, [0, 30, 0]);

    const report = validateMiProject(project);
    assert.equal(report.valid, true);
    assert.equal(report.errors.length, 0);
  });
});
