import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { toolHandlers } from "../tools/index.js";
import { readProjectFile, resolveProjectPath } from "../core/project.js";

describe("MCP Tool Handlers (21 Tools End-to-End)", () => {
  const tempDir = path.join(os.tmpdir(), "mineimator_tools_test_" + Date.now());
  const projectFolder = path.join(tempDir, "EpicAnimation");
  let charRootId = "";
  let rightArmId = "";
  let camId = "";
  let itemId = "";
  let blockId = "";

  it("1. mineimator_create_project", async () => {
    const res = await toolHandlers.mineimator_create_project({
      project_path: projectFolder,
      name: "Epic Animation",
      author: "Antigravity",
      tempo: 30,
      video_width: 1920,
      video_height: 1080,
      render_settings: "high",
    });

    assert.equal(res.success, true);
    assert.equal(res.format, 34);
    assert.equal(res.tempo, 30);
  });

  it("2. mineimator_read_project", async () => {
    const full = await toolHandlers.mineimator_read_project({
      project_path: projectFolder,
    });
    assert.equal(full.format, 34);

    const summary = await toolHandlers.mineimator_read_project({
      project_path: projectFolder,
      summary_only: true,
    });
    assert.equal(summary.project_name, "Epic Animation");
  });

  it("3. mineimator_set_environment", async () => {
    const res = await toolHandlers.mineimator_set_environment({
      project_path: projectFolder,
      sky_time: 20,
      sky_color: "#6699FF",
      fog_show: true,
      fog_distance: 8000,
      wind: true,
      wind_speed: 0.2,
      biome: "desert",
    });

    assert.equal(res.success, true);
    assert.equal(res.background.sky_time, 20);
    assert.equal(res.background.biome, "desert");
  });

  it("4. mineimator_set_render_pipeline", async () => {
    const res = await toolHandlers.mineimator_set_render_pipeline({
      project_path: projectFolder,
      render_ssao: true,
      render_ssao_radius: 16,
      render_glow: true,
      render_glow_intensity: 1.5,
      bend_style: "blocky",
    });

    assert.equal(res.success, true);
    assert.equal(res.render.render_ssao_radius, 16);
    assert.equal(res.render.bend_style, "blocky");
  });

  it("5. mineimator_add_character", async () => {
    const res = await toolHandlers.mineimator_add_character({
      project_path: projectFolder,
      character_name: "Hero Steve",
      model_name: "human",
      variant: "steve",
      type: "wide",
      position: [0, 0, 0],
    });

    assert.equal(res.success, true);
    assert.equal(typeof res.root_timeline_id, "string");
    assert.equal(res.total_parts_created, 7);
    charRootId = res.root_timeline_id;
    rightArmId = res.parts?.right_arm || "";
  });

  it("6. mineimator_add_block", async () => {
    const res = await toolHandlers.mineimator_add_block({
      project_path: projectFolder,
      block_name: "diamond_block",
      position: [20, 0, 0],
    });

    assert.equal(res.success, true);
    assert.equal(typeof res.timeline_id, "string");
    blockId = res.timeline_id;
  });

  it("7. mineimator_add_item", async () => {
    const res = await toolHandlers.mineimator_add_item({
      project_path: projectFolder,
      item_name: "diamond_sword",
      parent_timeline_id: rightArmId,
      grip: "right_hand",
    });

    assert.equal(res.success, true);
    assert.equal(typeof res.timeline_id, "string");
    itemId = res.timeline_id;

    // Verify natural sword grip defaults were applied
    const proj = readProjectFile(resolveProjectPath(projectFolder));
    const swordTl = proj.timelines.find((t) => t.id === itemId);
    assert.deepEqual(
      [swordTl?.default_values.POS_X, swordTl?.default_values.POS_Y, swordTl?.default_values.POS_Z],
      [0, 1.0, -10.0]
    );
    assert.deepEqual(
      [swordTl?.default_values.ROT_X, swordTl?.default_values.ROT_Y, swordTl?.default_values.ROT_Z],
      [-85, 0, -35]
    );
    assert.equal(swordTl?.inherit.bend, true);
    assert.equal(swordTl?.inherit.rot_point, false);
  });

  it("8. mineimator_add_light", async () => {
    const res = await toolHandlers.mineimator_add_light({
      project_path: projectFolder,
      light_type: "spot",
      name: "Hero Spotlight",
      position: [0, -50, 100],
      color: "#FFEEDD",
      range: 500,
    });

    assert.equal(res.success, true);
    assert.equal(res.light_type, "spotlight");
  });

  it("9. mineimator_add_camera", async () => {
    const res = await toolHandlers.mineimator_add_camera({
      project_path: projectFolder,
      name: "Cinematic Cam",
      position: [-80, -60, 35],
      target: [0, 0, 16],
      fov: 50,
      dof: true,
      dof_distance: 120,
    });

    assert.equal(res.success, true);
    assert.equal(res.name, "Cinematic Cam");
    camId = res.timeline_id;

    // Verify camera rotation was calculated automatically from target
    const proj = readProjectFile(resolveProjectPath(projectFolder));
    const camTl = proj.timelines.find((t) => t.id === camId);
    assert.equal(typeof camTl?.default_values.ROT_X, "number");
    assert.equal(typeof camTl?.default_values.ROT_Z, "number");
    // Camera is elevated above target: pitch should tilt downward (positive in Mine-imator)
    assert.equal(Number(camTl?.default_values.ROT_X ?? 0) > 0, true);
    // Camera is southwest of target: yaw should turn toward target (positive ROT_Z)
    assert.equal(Number(camTl?.default_values.ROT_Z ?? 0) > 0, true);
  });

  it("10. mineimator_insert_keyframe", async () => {
    const res = await toolHandlers.mineimator_insert_keyframe({
      project_path: projectFolder,
      timeline_id: charRootId,
      frame: 10,
      values: {
        POS_X: 5,
        POS_Y: 10,
        TRANSITION: "easeinoutquad",
      },
    });

    assert.equal(res.success, true);
    assert.equal(res.frame, 10);
  });

  it("11. mineimator_generate_walk_cycle", async () => {
    const res = await toolHandlers.mineimator_generate_walk_cycle({
      project_path: projectFolder,
      character_timeline_id: charRootId,
      start_frame: 0,
      end_frame: 48,
      forward_travel: 64,
    });

    assert.equal(res.success, true);
    assert.equal(res.keyframes_added > 0, true);
  });

  it("12. mineimator_generate_camera_path", async () => {
    const res = await toolHandlers.mineimator_generate_camera_path({
      project_path: projectFolder,
      camera_timeline_id: camId,
      waypoints: [
        { frame: 0, position: [0, -100, 20], look_at: [0, 0, 16] },
        { frame: 48, position: [80, -40, 25], look_at: [0, 0, 16] },
      ],
      smooth: true,
    });

    assert.equal(res.success, true);
    assert.equal(res.keyframes_added > 0, true);
  });

  it("13. mineimator_clear_keyframes", async () => {
    const res = await toolHandlers.mineimator_clear_keyframes({
      project_path: projectFolder,
      timeline_id: blockId,
    });

    assert.equal(res.success, true);
    assert.equal(typeof res.cleared_keyframes_count, "number");
  });

  it("14. mineimator_list_minecraft_assets", async () => {
    const res = await toolHandlers.mineimator_list_minecraft_assets({
      category: "blocks",
      filter: "stone",
    });

    assert.equal(res.total_matches > 0, true);
  });

  it("15. mineimator_import_schematic", async () => {
    const mockSchematic = path.join(tempDir, "temple.schematic");
    fs.writeFileSync(mockSchematic, "SCHEMATIC_BINARY_DATA");

    const res = await toolHandlers.mineimator_import_schematic({
      project_path: projectFolder,
      schematic_path: mockSchematic,
      name: "Desert Temple",
    });

    assert.equal(res.success, true);
    assert.equal(res.schematic_file, "temple.schematic");
  });

  it("16. mineimator_stage_for_launch", async () => {
    const res = await toolHandlers.mineimator_stage_for_launch({
      project_path: projectFolder,
      data_dir: tempDir,
      launch_now: false,
    });

    assert.equal(res.success, true);
    assert.equal(res.stagedFile.toLowerCase().includes("epicanimation.miproject"), true);
  });

  it("17. mineimator_open_via_drop", async () => {
    const res = await toolHandlers.mineimator_open_via_drop({
      project_path: projectFolder,
      timeout_ms: 3000,
      data_dir: tempDir,
    });

    assert.equal(res.success, true);
    assert.equal(typeof res.processFound, "boolean");
  });

  it("18. mineimator_validate_project", async () => {
    const res = await toolHandlers.mineimator_validate_project({
      project_path: projectFolder,
    });

    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
    assert.equal(res.stats.format, 34);
    assert.equal(res.stats.timelines_count >= 8, true);
  });

  it("19. mineimator_export_video", async () => {
    const res = await toolHandlers.mineimator_export_video({
      project_path: projectFolder,
      output_path: path.join(tempDir, "render.mp4"),
      format: "mp4",
      data_dir: tempDir,
    });

    assert.equal(res.success, true);
    assert.equal(res.staged, true);
  });

  it("20. mineimator_capture_viewport (graceful when window not active)", async () => {
    const res = await toolHandlers.mineimator_capture_viewport({
      output_image_path: path.join(tempDir, "viewport.png"),
    });

    // If Mine-imator is not running in background, it should return graceful status with message
    assert.equal(typeof res.success, "boolean");
    assert.equal(typeof res.message, "string");

    // Also verify call with show_rule_of_thirds overlay enabled
    const resOverlay = await toolHandlers.mineimator_capture_viewport({
      output_image_path: path.join(tempDir, "viewport_grid.png"),
      show_rule_of_thirds: true,
    });
    assert.equal(typeof resOverlay.success, "boolean");
    assert.equal(typeof resOverlay.message, "string");
  });

  it("21. mineimator_live_reload (reloads active project or stages safely)", async () => {
    const res = await toolHandlers.mineimator_live_reload({
      project_path: projectFolder,
      mode: "focus",
    });

    assert.equal(typeof res.success, "boolean");
    assert.equal(typeof res.reloaded, "boolean");
    assert.equal(typeof res.mode, "string");
    assert.equal(typeof res.message, "string");
  });
});
