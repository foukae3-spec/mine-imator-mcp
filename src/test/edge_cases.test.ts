import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { toolHandlers } from "../tools/index.js";
import { validateMiProject } from "../schema/validation.js";

describe("Edge Cases and Robust Error Handling", () => {
  const tempDir = path.join(os.tmpdir(), "mineimator_edge_test_" + Date.now());
  const projectFolder = path.join(tempDir, "EdgeProject");

  it("should fail gracefully when reading non-existent project", async () => {
    await assert.rejects(
      async () => {
        await toolHandlers.mineimator_read_project({
          project_path: path.join(tempDir, "Ghost.miproject"),
        });
      },
      {
        message: /does not exist/,
      }
    );
  });

  it("should fail gracefully when inserting keyframe into non-existent timeline", async () => {
    await toolHandlers.mineimator_create_project({
      project_path: projectFolder,
      name: "Edge Project",
    });

    await assert.rejects(
      async () => {
        await toolHandlers.mineimator_insert_keyframe({
          project_path: projectFolder,
          timeline_id: "NON_EXISTENT_ID1",
          frame: 0,
          values: { POS_X: 10 },
        });
      },
      {
        message: /Timeline not found/,
      }
    );
  });

  it("should reject walk cycle when end_frame is less than start_frame", async () => {
    const char = await toolHandlers.mineimator_add_character({
      project_path: projectFolder,
      character_name: "Runner",
    });

    await assert.rejects(
      async () => {
        await toolHandlers.mineimator_generate_walk_cycle({
          project_path: projectFolder,
          character_timeline_id: char.root_timeline_id,
          start_frame: 48,
          end_frame: 24, // inverted!
        });
      },
      {
        message: /end_frame must be greater than start_frame/,
      }
    );
  });

  it("should reject camera path with fewer than 2 waypoints", async () => {
    const cam = await toolHandlers.mineimator_add_camera({
      project_path: projectFolder,
      name: "Solo Cam",
    });

    await assert.rejects(
      async () => {
        await toolHandlers.mineimator_generate_camera_path({
          project_path: projectFolder,
          camera_timeline_id: cam.timeline_id,
          waypoints: [{ frame: 0, position: [0, 0, 0] }], // Only 1 waypoint!
        });
      },
      {
        message: /At least 2 waypoints are required/,
      }
    );
  });

  it("should handle keyframe clearing when timeline has no keyframes", async () => {
    const block = await toolHandlers.mineimator_add_block({
      project_path: projectFolder,
      block_name: "glass",
    });

    const res = await toolHandlers.mineimator_clear_keyframes({
      project_path: projectFolder,
      timeline_id: block.timeline_id,
    });

    assert.equal(res.cleared_keyframes_count, 0);
  });

  it("should return valid: false when validating null, primitive, or corrupted objects", () => {
    assert.equal(validateMiProject(null).valid, false);
    assert.equal(validateMiProject("not an object").valid, false);
    assert.equal(validateMiProject(42).valid, false);
    assert.equal(validateMiProject({}).valid, false);
  });

  it("should handle asset catalog query with empty filter and fallback gracefully", async () => {
    const res = await toolHandlers.mineimator_list_minecraft_assets({
      category: "all",
      filter: "xyz_non_existent_asset_pattern_9999",
    });

    assert.equal(res.total_matches, 0);
    assert.equal(res.assets.length, 0);
  });

  it("should reject negative or non-finite frame index in insert_keyframe", async () => {
    const cam = await toolHandlers.mineimator_add_camera({
      project_path: projectFolder,
      name: "FrameTestCam",
    });

    await assert.rejects(
      async () => {
        await toolHandlers.mineimator_insert_keyframe({
          project_path: projectFolder,
          timeline_id: cam.timeline_id,
          frame: -5,
          values: { POS_X: 10 },
        });
      },
      {
        message: /non-negative number/,
      }
    );
  });

  it("should reject walk cycle when cycle_length is less than or equal to 0", async () => {
    const char = await toolHandlers.mineimator_add_character({
      project_path: projectFolder,
      character_name: "CycleRunner",
    });

    await assert.rejects(
      async () => {
        await toolHandlers.mineimator_generate_walk_cycle({
          project_path: projectFolder,
          character_timeline_id: char.root_timeline_id,
          cycle_length: 0,
        });
      },
      {
        message: /cycle_length must be greater than 0/,
      }
    );
  });

  it("should reject camera path with duplicate frame numbers", async () => {
    const cam = await toolHandlers.mineimator_add_camera({
      project_path: projectFolder,
      name: "DuplicateCam",
    });

    await assert.rejects(
      async () => {
        await toolHandlers.mineimator_generate_camera_path({
          project_path: projectFolder,
          camera_timeline_id: cam.timeline_id,
          waypoints: [
            { frame: 10, position: [0, 0, 0] },
            { frame: 10, position: [100, 100, 100] },
          ],
        });
      },
      {
        message: /distinct frame numbers/,
      }
    );
  });

  it("should reject item addition when parent_timeline_id does not exist", async () => {
    await assert.rejects(
      async () => {
        await toolHandlers.mineimator_add_item({
          project_path: projectFolder,
          item_name: "diamond_sword",
          parent_timeline_id: "GHOST_PARENT_ID",
        });
      },
      {
        message: /Parent timeline not found/,
      }
    );
  });

  it("should assign consecutive sibling parent_tree_index values across entities", async () => {
    const siblingProject = path.join(tempDir, "SiblingProject");
    await toolHandlers.mineimator_create_project({
      project_path: siblingProject,
      name: "Sibling Test",
    });

    // Add first character (1 root + 7 body parts = 8 timelines)
    const char1 = await toolHandlers.mineimator_add_character({
      project_path: siblingProject,
      character_name: "Char1",
    });

    // Add second character
    const char2 = await toolHandlers.mineimator_add_character({
      project_path: siblingProject,
      character_name: "Char2",
    });

    // Add a block at root
    const block = await toolHandlers.mineimator_add_block({
      project_path: siblingProject,
      block_name: "stone",
    });

    // Add a camera at root
    const cam = await toolHandlers.mineimator_add_camera({
      project_path: siblingProject,
      name: "RootCam",
    });

    // Inspect project timelines
    const projData = (await toolHandlers.mineimator_read_project({
      project_path: siblingProject,
    })) as any;

    const rootTimelines = projData.timelines.filter((t: any) => t.parent === "root");
    const rootTreeIndices = rootTimelines.map((t: any) => t.parent_tree_index);

    // rootTreeIndices must be [0, 1, 2, 3] rather than [0, 8, 16, 17]
    assert.deepEqual(rootTreeIndices, [0, 1, 2, 3]);
  });
});
