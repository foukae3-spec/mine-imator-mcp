import { toolHandlers } from "./dist/tools/index.js";
import { resolveInstallation } from "./dist/bridge/installation.js";
import * as path from "node:path";
import * as fs from "node:fs";

async function main() {
  console.log("=== Creating 10-Second Mine-imator Demo Animation via MCP ===");

  // Detect active or installed Mine-imator (Vexel Build or Standard)
  const inst = resolveInstallation();
  console.log(`Detected active Mine-imator installation: ${inst.name} (${inst.flavor})`);
  console.log(`Executable: ${inst.executablePath}`);
  console.log(`Projects Directory: ${inst.projectsDir}`);

  const projectDir = path.join(inst.projectsDir, "MCP Demo 10s");
  const projectPath = path.join(projectDir, "MCP Demo 10s.miproject");

  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }

  // 1. Create Project (10 seconds at 30 fps = 300 frames)
  console.log("1. Creating Project...");
  const createRes = await toolHandlers.mineimator_create_project({
    project_path: projectPath,
    name: "MCP Demo 10s",
    author: "Antigravity MCP Server",
    description: "10-Second cinematic walk-cycle and hero sword flourish created automatically via Model Context Protocol.",
    tempo: 30,
    video_width: 1920,
    video_height: 1080,
    render_settings: "high",
  });
  console.log("Project created at:", createRes.project_path);

  // 2. Configure Environment (Dramatic lighting)
  console.log("2. Setting Environment...");
  await toolHandlers.mineimator_set_environment({
    project_path: projectPath,
    sky_time: 50,
    sky_sun_angle: 40,
    sky_clouds_show: true,
    fog_show: true,
    fog_color: "#A4C2E0",
    fog_distance: 1800,
    wind_speed: 0.4,
  });

  // 3. Set Render Pipeline
  console.log("3. Configuring Render Pipeline...");
  await toolHandlers.mineimator_set_render_pipeline({
    project_path: projectPath,
    render_ssao: true,
    render_shadows: true,
    render_reflections: true,
    render_glow: true,
    render_aa: true,
    bend_style: "curved",
  });

  // 4. Add Character (Steve)
  console.log("4. Adding Character Steve...");
  const charRes = await toolHandlers.mineimator_add_character({
    project_path: projectPath,
    character_name: "Steve",
    model_name: "human",
    variant: "steve",
    position: [0, 0, 0],
  });

  const rootId = charRes.root_timeline_id;
  const rightArmId = charRes.parts.right_arm;
  const headId = charRes.parts.head;

  console.log(`Steve created: Root ID=${rootId}, Right Arm=${rightArmId}, Head=${headId}`);

  // 5. Add Diamond Sword attached to Steve's Right Hand with realistic grip
  console.log("5. Attaching Diamond Sword to Steve's hand with realistic grip...");
  const itemRes = await toolHandlers.mineimator_add_item({
    project_path: projectPath,
    item_name: "item/diamond_sword",
    name: "Diamond Sword",
    parent_timeline_id: rightArmId,
    grip: "right_hand",
  });
  console.log(`Sword attached with ID: ${itemRes.timeline_id} (grip: right_hand)`);

  // 6. Generate 8-second walk cycle (frames 0 to 240)
  console.log("6. Generating 8-second Sinusoidal Walk Cycle (Frames 0 -> 240)...");
  const walkRes = await toolHandlers.mineimator_generate_walk_cycle({
    project_path: projectPath,
    character_timeline_id: rootId,
    start_frame: 0,
    end_frame: 240,
    cycle_length: 30,
    arm_swing_angle: 35,
    leg_swing_angle: 35,
    bob_height: 1.8,
    forward_travel: 200,
  });
  console.log(`Walk cycle generated: ${walkRes.keyframes_added} keyframes across limbs.`);

  // 7. Add 2-second Hero Sword Flourish Pose (frames 240 to 300)
  console.log("7. Adding Hero Flourish Pose (Frames 240 -> 300)...");
  if (rightArmId) {
    // Frame 255: Arm swings outward
    await toolHandlers.mineimator_insert_keyframe({
      project_path: projectPath,
      timeline_id: rightArmId,
      frame: 255,
      values: {
        ROT_X: -45,
        ROT_Y: 20,
        ROT_Z: 40,
        BEND_ANGLE_X: 25,
      },
    });

    // Frame 280: Sword raised high triumphantly
    await toolHandlers.mineimator_insert_keyframe({
      project_path: projectPath,
      timeline_id: rightArmId,
      frame: 280,
      values: {
        ROT_X: -135,
        ROT_Y: 15,
        ROT_Z: 30,
        BEND_ANGLE_X: 10,
      },
    });

    // Frame 300: Hold triumph pose
    await toolHandlers.mineimator_insert_keyframe({
      project_path: projectPath,
      timeline_id: rightArmId,
      frame: 300,
      values: {
        ROT_X: -135,
        ROT_Y: 15,
        ROT_Z: 30,
        BEND_ANGLE_X: 10,
      },
    });
  }

  // Turn head toward camera in flourish
  if (headId) {
    await toolHandlers.mineimator_insert_keyframe({
      project_path: projectPath,
      timeline_id: headId,
      frame: 245,
      values: { ROT_X: 0, ROT_Y: 0, ROT_Z: 0 },
    });
    await toolHandlers.mineimator_insert_keyframe({
      project_path: projectPath,
      timeline_id: headId,
      frame: 275,
      values: { ROT_X: -10, ROT_Y: 10, ROT_Z: -25 },
    });
    await toolHandlers.mineimator_insert_keyframe({
      project_path: projectPath,
      timeline_id: headId,
      frame: 300,
      values: { ROT_X: -10, ROT_Y: 10, ROT_Z: -25 },
    });
  }

  // 8. Add Cinematic Camera with target look-at
  console.log("8. Adding Cinematic Camera with target look-at...");
  const camRes = await toolHandlers.mineimator_add_camera({
    project_path: projectPath,
    name: "Cinematic Director Cam",
    fov: 55,
    position: [-80, -60, 35],
    target: [0, 0, 16],
  });
  console.log(`Camera created with ID: ${camRes.timeline_id}`);

  // 9. Generate Smooth 10-Second Camera Spline Path (0 -> 300)
  console.log("9. Generating 10-Second Smooth Camera Spline Path...");
  const camPathRes = await toolHandlers.mineimator_generate_camera_path({
    project_path: projectPath,
    camera_timeline_id: camRes.timeline_id,
    waypoints: [
      { frame: 0, position: [-80, -60, 35], look_at: [0, 0, 18], fov: 55 },
      { frame: 90, position: [-90, 50, 38], look_at: [0, 75, 20], fov: 52 },
      { frame: 180, position: [-70, 150, 32], look_at: [0, 150, 20], fov: 48 },
      { frame: 250, position: [-40, 230, 28], look_at: [0, 200, 22], fov: 42 },
      { frame: 300, position: [-35, 235, 26], look_at: [0, 200, 24], fov: 38 },
    ],
    sample_interval: 5,
    interpolation: "smooth",
  });
  console.log(`Camera track generated: ${camPathRes.keyframes_added} keyframes.`);

  // 10. Validate Project Integrity
  console.log("10. Validating Project Integrity...");
  const valRes = await toolHandlers.mineimator_validate_project({ project_path: projectPath });
  console.log("Validation status: valid =", valRes.valid);

  if (!valRes.valid) {
    throw new Error(`Validation failed: ${JSON.stringify(valRes.issues)}`);
  }

  // Also mirror project to secondary installation if present (e.g. D:/Mine-imator)
  const dProjects = "D:/Mine-imator/Projects";
  if (fs.existsSync(dProjects) && inst.projectsDir.toLowerCase() !== dProjects.toLowerCase()) {
    const mirrorDir = path.join(dProjects, "MCP Demo 10s");
    fs.cpSync(projectDir, mirrorDir, { recursive: true });
    console.log(`Mirrored project to standard installation: ${mirrorDir}`);
  }

  // 11. Stage for Launch in Mine-imator (Pinned to slot 0)
  console.log("11. Staging Project into Mine-imator recent.midata...");
  const stageRes = await toolHandlers.mineimator_stage_for_launch({
    project_path: projectPath,
    launch_now: false,
  });
  console.log("Staged result:", stageRes.message);

  // 12. Trigger Live Reload in running Mine-imator instance
  console.log("12. Triggering Live Reload in Mine-imator...");
  const reloadRes = await toolHandlers.mineimator_live_reload({
    project_path: projectPath,
    mode: "auto",
    capture_after: true,
  });
  console.log("Live reload status:", reloadRes.message);
  if (reloadRes.previewImagePath) {
    console.log("Live preview screenshot captured at:", reloadRes.previewImagePath);
  }

  // 13. Capture Viewport to verify visual output
  console.log("13. Capturing Mine-imator Viewport...");
  const viewportOut = path.join(projectDir, "viewport_live.png");
  const captureRes = await toolHandlers.mineimator_capture_viewport({
    output_image_path: viewportOut,
  });
  console.log("Viewport capture result:", captureRes.message);
  if (captureRes.success) {
    console.log(`Screenshot saved: ${captureRes.outputPath} (${captureRes.fileSizeBytes} bytes)`);
  }

  console.log("\n=== SUCCESS: 10-Second Demo Animation Project Built & Live-Reloaded! ===");
  console.log(`Project File: ${projectPath}`);
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
