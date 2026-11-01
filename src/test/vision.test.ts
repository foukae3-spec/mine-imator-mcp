import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  checkEntityVisibility,
  groundSnapCheck,
  inspectSceneGraph,
  measureInterEntityDistance,
  projectToScreenSpace,
} from "../core/vision.js";
import { createNewProject } from "../core/project.js";
import { buildCharacterHierarchy } from "../core/hierarchy.js";

describe("3D Spatial Awareness & Camera Frustum Vision", () => {
  it("should project point dead center in camera forward direction to screen center", () => {
    // Camera at [0, 0, 0], rot [0, 0, 0] looking along +Y
    // Target at [0, 50, 0] (directly ahead)
    const proj = projectToScreenSpace(
      [0, 0, 0],
      [0, 0, 0],
      [0, 50, 0],
      45,
      16 / 9,
      1280,
      720
    );

    assert.equal(proj.inFrame, true);
    assert.equal(proj.behindCamera, false);
    assert.ok(Math.abs(proj.ndc[0]) < 1e-4, `Expected ndcX ~0, got ${proj.ndc[0]}`);
    assert.ok(Math.abs(proj.ndc[1]) < 1e-4, `Expected ndcY ~0, got ${proj.ndc[1]}`);
    assert.equal(proj.pixel[0], 640);
    assert.equal(proj.pixel[1], 360);
    assert.equal(proj.depth, 50);
  });

  it("should identify point behind camera as behindCamera = true and inFrame = false", () => {
    // Target at [0, -20, 0] (behind camera which looks along +Y)
    const proj = projectToScreenSpace(
      [0, 0, 0],
      [0, 0, 0],
      [0, -20, 0],
      45
    );

    assert.equal(proj.behindCamera, true);
    assert.equal(proj.inFrame, false);
  });

  it("should correctly distinguish left vs right screen coordinates", () => {
    // Point to the right (+X = East)
    const projRight = projectToScreenSpace(
      [0, 0, 0],
      [0, 0, 0],
      [10, 50, 0],
      45
    );
    assert.ok(projRight.ndc[0] > 0);
    assert.ok(projRight.pixel[0] > 640);

    // Point to the left (-X = West)
    const projLeft = projectToScreenSpace(
      [0, 0, 0],
      [0, 0, 0],
      [-10, 50, 0],
      45
    );
    assert.ok(projLeft.ndc[0] < 0);
    assert.ok(projLeft.pixel[0] < 640);
  });

  it("should check entity visibility and assign correct framing zone", () => {
    const { project } = createNewProject({ project_path: "temp_vis.miproject" });
    const char = buildCharacterHierarchy({ name: "Alex", position: [0, 50, 0] });
    project.timelines.push(char.rootTimeline);

    const cameraTl = {
      id: "cam_test",
      type: "camera",
      name: "Main Cam",
      temp: "null",
      default_values: { POS_X: 0, POS_Y: 0, POS_Z: 16, ROT_X: 0, ROT_Y: 0, ROT_Z: 0, CAM_FOV: 45 },
      keyframes: {},
      parent: "root",
      parent_tree_index: 0,
      inherit: {} as any,
    };

    const rep = checkEntityVisibility(cameraTl, char.rootTimeline);
    assert.equal(rep.inFrame, true);
    assert.equal(rep.behindCamera, false);
    assert.equal(rep.framingZone, "center");
  });

  it("should measure 3D and 2D inter-entity distances accurately", () => {
    const entA = {
      id: "A",
      type: "char",
      name: "Steve",
      temp: "null",
      default_values: { POS_X: 0, POS_Y: 0, POS_Z: 0 },
      keyframes: {},
      parent: "root",
      parent_tree_index: 0,
      inherit: {} as any,
    };
    const entB = {
      id: "B",
      type: "char",
      name: "Alex",
      temp: "null",
      default_values: { POS_X: 3, POS_Y: 4, POS_Z: 0 }, // 3-4-5 right triangle
      keyframes: {},
      parent: "root",
      parent_tree_index: 1,
      inherit: {} as any,
    };

    const dist = measureInterEntityDistance(entA, entB);
    assert.equal(dist.distance3D, 5);
    assert.equal(dist.distancePlanar, 5);
    assert.equal(dist.withinInteractionReach, true);
  });

  it("should detect ground float and ground penetration correctly", () => {
    const floatingEnt = {
      id: "float",
      type: "char",
      name: "Float",
      temp: "null",
      default_values: { POS_Z: 10 },
      keyframes: {},
      parent: "root",
      parent_tree_index: 0,
      inherit: {} as any,
    };

    const floatRes = groundSnapCheck(floatingEnt, 0);
    assert.equal(floatRes.isGrounded, false);
    assert.equal(floatRes.status, "floating");
    assert.equal(floatRes.offsetNeeded, -10);

    const penetratingEnt = {
      id: "pen",
      type: "char",
      name: "Pen",
      temp: "null",
      default_values: { POS_Z: -5 },
      keyframes: {},
      parent: "root",
      parent_tree_index: 0,
      inherit: {} as any,
    };

    const penRes = groundSnapCheck(penetratingEnt, 0);
    assert.equal(penRes.isGrounded, false);
    assert.equal(penRes.status, "penetrating");
    assert.equal(penRes.offsetNeeded, 5);
  });

  it("should inspect the complete scene graph and provide a summary", () => {
    const { project } = createNewProject({ project_path: "temp_graph.miproject" });
    const char = buildCharacterHierarchy({ name: "Graph Steve" });
    project.timelines.push(char.rootTimeline, ...char.parts);

    const report = inspectSceneGraph(project);
    assert.equal(report.totalEntities, 8); // root + 7 parts
    assert.ok(report.entities.length >= 8);
    const rootSummary = report.entities.find((e) => e.id === char.rootTimeline.id);
    assert.ok(rootSummary);
    assert.equal(rootSummary.childrenCount >= 1, true);
  });
});
