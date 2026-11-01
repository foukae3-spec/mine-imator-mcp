import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { toolHandlers } from "../tools/index.js";

describe("Studio Director Suite (Tools 22-36 End-to-End)", () => {
  const testProject = "C:/Users/RocKeR/.gemini/antigravity/scratch/mine-imator-mcp/test_studio_e2e.miproject";

  it("should test all 15 new tools in a unified creative studio workflow", async () => {
    // Step 0: Create project
    await toolHandlers.mineimator_create_project({
      project_path: testProject,
      name: "Studio E2E Test",
    });

    // Add Steve character
    const charRes = await toolHandlers.mineimator_add_character({
      project_path: testProject,
      character_name: "Steve",
      position: [0, 0, 0],
    });
    const steveRootId = charRes.root_timeline_id;

    // 22. Solve IK
    const ikRes = await toolHandlers.mineimator_solve_ik({
      limb_name: "right_arm",
      target_coords: [0, 8, 18],
      project_path: testProject,
      character_root_id: steveRootId,
      frame: 10,
      apply_to_project: true,
    });
    assert.equal(ikRes.success, true);
    assert.equal(ikRes.applied, true);

    // 23. Apply Pose
    const poseRes = await toolHandlers.mineimator_apply_pose({
      project_path: testProject,
      character_root_id: steveRootId,
      pose_name: "kneel_offer",
      frame: 20,
    });
    assert.equal(poseRes.success, true);
    assert.equal(poseRes.pose_applied, "kneel_offer");

    // 24. Spawn Structure
    const structRes = await toolHandlers.mineimator_spawn_structure({
      project_path: testProject,
      preset_name: "cottage_porch",
      origin: [0, 0, 0],
    });
    assert.equal(structRes.success, true);
    assert.ok(structRes.blocks_added > 5);

    // 25. Create Scene Set
    const setRes = await toolHandlers.mineimator_create_scene_set({
      project_path: testProject,
      name: "Griefer Lair",
      set_id: "set_skybase",
      origin: [0, 2000, 100],
      structure_preset: "griefer_skybase",
      create_camera: true,
    });
    assert.equal(setRes.success, true);
    assert.ok(setRes.set_manifest.cameraId);

    // 26. Spawn Particle Emitter
    const partRes = await toolHandlers.mineimator_spawn_particle_emitter({
      project_path: testProject,
      emitter_type: "fire_plume",
      position: [10, 10, 0],
      name: "Campfire Fire",
      start_frame: 0,
    });
    assert.equal(partRes.success, true);

    // 27. Add Audio Track
    const audioRes = await toolHandlers.mineimator_add_audio_track({
      project_path: testProject,
      sound_file: "epic_orchestral_theme.ogg",
      name: "BGM",
      start_frame: 0,
      volume: 0.9,
    });
    assert.equal(audioRes.success, true);

    // 28. Trigger SFX
    const sfxRes = await toolHandlers.mineimator_trigger_sfx({
      project_path: testProject,
      sound_cue: "tnt_primed",
      frame: 45,
    });
    assert.equal(sfxRes.success, true);

    // 29. Create Shot Camera
    const shotCamRes = await toolHandlers.mineimator_create_shot_camera({
      project_path: testProject,
      name: "Cam_Steve_CloseUp",
      subject_pos: [0, 0, 16],
      framing: "close_up",
    });
    assert.equal(shotCamRes.success, true);
    const shotCamId = shotCamRes.cameraId;

    // 30. Generate Dolly Zoom
    const dzRes = await toolHandlers.mineimator_generate_dolly_zoom({
      project_path: testProject,
      camera_timeline_id: shotCamId,
      subject_pos: [0, 0, 16],
      start_frame: 50,
      end_frame: 80,
      start_distance: 18,
      end_distance: 36,
      start_fov: 35,
    });
    assert.equal(dzRes.success, true);

    // 31. Add Camera Shake
    const shakeRes = await toolHandlers.mineimator_add_camera_shake({
      project_path: testProject,
      camera_timeline_id: shotCamId,
      start_frame: 80,
      duration_frames: 15,
      magnitude: 5.0,
    });
    assert.equal(shakeRes.success, true);

    // 32. Inspect Scene Graph
    const graphRes = await toolHandlers.mineimator_inspect_scene_graph({
      project_path: testProject,
    });
    assert.ok(graphRes.totalEntities > 15);

    // 33. Check Camera Frustum
    const frustumRes = await toolHandlers.mineimator_check_camera_frustum({
      project_path: testProject,
      camera_timeline_id: shotCamId,
      entity_timeline_id: steveRootId,
      frame: 0,
    });
    assert.equal(frustumRes.inFrame, true);

    // 34. Snap to Ground
    const snapRes = await toolHandlers.mineimator_snap_to_ground({
      project_path: testProject,
      entity_timeline_id: steveRootId,
      surface_z: 0,
      apply_snap: true,
    });
    assert.equal(snapRes.applied, true);
    assert.equal(snapRes.isGrounded, true);

    // 35. Render and Inspect Frame (gracefully handles background when window not running)
    const renderRes = await toolHandlers.mineimator_render_and_inspect_frame({
      project_path: testProject,
      frame: 0,
    });
    assert.equal(renderRes.success, true);
    assert.ok(Array.isArray(renderRes.entitiesInView));

    // 36. Compile Storyboard
    const sbRes = await toolHandlers.mineimator_compile_storyboard({
      project_path: testProject,
      shots: [
        { shotName: "Porch Romance", cameraId: shotCamId, startFrame: 0, endFrame: 150 },
        { shotName: "Griefer Confrontation", cameraId: setRes.set_manifest.cameraId!, startFrame: 151, endFrame: 400 },
      ],
    });
    assert.equal(sbRes.success, true);
    assert.equal(sbRes.totalShots, 2);

    // Cleanup
    if (fs.existsSync(testProject)) fs.unlinkSync(testProject);
  });
});
