import { toolHandlers } from "./dist/tools/index.js";
import { resolveInstallation } from "./dist/bridge/installation.js";
import * as path from "node:path";
import * as fs from "node:fs";

async function main() {
  console.log("================================================================================");
  console.log("  BUILDING 60-SECOND STUDIO MASTERPIECE: 'STEVE'S REVENGE: SERVER WIPE' (V2.0)");
  console.log("  Studio Director Suite with IK, Anatomical Poses, Voxel Sets, FX & Vision");
  console.log("  Total Duration: 1,800 Frames (60.0 Seconds @ 30 FPS)");
  console.log("================================================================================\n");

  const inst = resolveInstallation();
  console.log(`Target Installation: ${inst.name} (${inst.flavor})`);
  console.log(`Executable: ${inst.executablePath}`);
  console.log(`Projects Directory: ${inst.projectsDir}\n`);

  const projectDir = path.join(inst.projectsDir, "MCP Demo 10s");
  const projectPath = path.join(projectDir, "MCP Demo 10s.miproject");

  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }

  // ============================================================================
  // 1. PROJECT INITIALIZATION (1800 frames, 30 FPS, 1080p, High Render)
  // ============================================================================
  console.log("[1/10] Initializing 60-second Format 34 Studio Director project...");
  const createRes = await toolHandlers.mineimator_create_project({
    project_path: projectPath,
    name: "MCP Demo 10s",
    author: "Antigravity MCP Studio Director Engine",
    description: "STEVE'S REVENGE: SERVER WIPE (60-second Multi-Set Cinematic Masterpiece)",
    tempo: 30,
    video_width: 1920,
    video_height: 1080,
    render_settings: "high",
  });
  console.log(`✓ Project initialized: ${createRes.project_path}`);

  // High-End Shader & Render Pipeline
  await toolHandlers.mineimator_set_render_pipeline({
    project_path: projectPath,
    render_ssao: true,
    render_shadows: true,
    render_reflections: true,
    render_glow: true,
    render_aa: true,
    bend_style: "curved",
  });

  // Base Golden-Hour Environment
  await toolHandlers.mineimator_set_environment({
    project_path: projectPath,
    sky_time: 45,
    sky_sun_angle: 35,
    sky_clouds_show: true,
    fog_show: true,
    fog_color: "#A4C2E0",
    fog_distance: 2500,
    wind_speed: 0.3,
  });

  // ============================================================================
  // 2. SPATIAL SETS SEGREGATION & VOXEL ARCHITECTURE
  // ============================================================================
  console.log("\n[2/10] Spawning Segregated Physical Sets (Y=0, 1000, 2000, 3500)...");

  // Set 1: Cottage Porch at Y=0
  const set1 = await toolHandlers.mineimator_create_scene_set({
    project_path: projectPath,
    name: "Cottage Porch",
    set_id: "set_porch_01",
    origin: [0, 0, 0],
    structure_preset: "cottage_porch",
    create_camera: false,
  });
  console.log(`✓ Set 1 (Porch): ${set1.set_manifest.blockCount} blocks spawned at Y=0.`);

  // Set 2: Ruined Cottage & Birch Hill at Y=1000
  const set2 = await toolHandlers.mineimator_create_scene_set({
    project_path: projectPath,
    name: "Ruined Cottage Set",
    set_id: "set_ruins_02",
    origin: [0, 1000, 0],
    structure_preset: "ruined_cottage",
    create_camera: false,
  });
  // Birch forest hill adjacent on Set 2
  const hillRes = await toolHandlers.mineimator_spawn_structure({
    project_path: projectPath,
    preset_name: "birch_forest_hill",
    origin: [0, 800, 0],
  });
  console.log(`✓ Set 2 (Ruins & Birch Hill): ${set2.set_manifest.blockCount + hillRes.blocks_added} blocks spawned at Y=1000.`);

  // Set 3: Griefer Skybase at Y=2000, Z=120
  const set3 = await toolHandlers.mineimator_create_scene_set({
    project_path: projectPath,
    name: "Griefer Skybase",
    set_id: "set_skybase_03",
    origin: [0, 2000, 120],
    structure_preset: "griefer_skybase",
    create_camera: false,
  });
  console.log(`✓ Set 3 (Skybase): ${set3.set_manifest.blockCount} blocks spawned at Y=2000, Z=120.`);

  // Set 4: Bedrock Void Pedestal at Y=3500
  const set4 = await toolHandlers.mineimator_create_scene_set({
    project_path: projectPath,
    name: "Bedrock Void Pedestal",
    set_id: "set_void_04",
    origin: [0, 3500, 0],
    structure_preset: "bedrock_void",
    create_camera: false,
  });
  console.log(`✓ Set 4 (Void Pedestal): ${set4.set_manifest.blockCount} blocks spawned at Y=3500.`);

  // ============================================================================
  // 3. CHARACTER RIGGING & RIG ANCHORING
  // ============================================================================
  console.log("\n[3/10] Rigging Characters: Steve, Alex, and the Two Griefers...");

  // 3.1 Steve (Hero)
  const steve = await toolHandlers.mineimator_add_character({
    project_path: projectPath,
    character_name: "Steve",
    model_name: "human",
    variant: "steve",
    position: [0, 0, 0],
  });

  // 3.2 Alex (Wife)
  const alex = await toolHandlers.mineimator_add_character({
    project_path: projectPath,
    character_name: "Alex",
    model_name: "human",
    variant: "alex",
    type: "slim",
    position: [0, 24, 0],
    rotation: [0, 0, 180],
  });

  // 3.3 Griefer 1: xX_NoobSlayer_Xx
  const griefer1 = await toolHandlers.mineimator_add_character({
    project_path: projectPath,
    character_name: "xX_NoobSlayer_Xx",
    model_name: "human",
    variant: "steve",
    position: [-24, 2000, 152],
  });

  // 3.4 Griefer 2: ProGriefer99
  const griefer2 = await toolHandlers.mineimator_add_character({
    project_path: projectPath,
    character_name: "ProGriefer99",
    model_name: "human",
    variant: "steve",
    position: [24, 2000, 152],
  });

  console.log("✓ All 4 characters rigged with full 7-part biped hierarchies.");

  // ============================================================================
  // 4. PROPS & ITEMS
  // ============================================================================
  console.log("\n[4/10] Attaching Narrative Props...");

  // Blue Orchid held by Steve
  const orchid = await toolHandlers.mineimator_add_item({
    project_path: projectPath,
    item_name: "item/blue_orchid",
    name: "Alex's Blue Orchid",
    parent_timeline_id: steve.parts.right_arm,
    grip: "right_hand",
  });

  // Enchanted Golden Apple
  const goldenApple = await toolHandlers.mineimator_add_item({
    project_path: projectPath,
    item_name: "item/enchanted_golden_apple",
    name: "Enchanted Golden Apple",
    parent_timeline_id: steve.parts.left_arm,
    grip: "left_hand",
  });

  // Memorial Poppy
  const poppy = await toolHandlers.mineimator_add_item({
    project_path: projectPath,
    item_name: "item/poppy",
    name: "Memorial Poppy",
    position: [0, 1010, 0],
    rotation: [0, 0, 15],
  });

  // God-Mode Command Block
  const cmdBlock = await toolHandlers.mineimator_add_block({
    project_path: projectPath,
    block_name: "block/command_block",
    name: "God-Mode Command Block",
    position: [0, 2000, 140],
  });

  // Dramatic Lights
  const fireLight = await toolHandlers.mineimator_add_light({
    project_path: projectPath,
    name: "Ruins Fire Light",
    light_type: "point",
    color: "#FF4500",
    range: 400,
    position: [0, 1000, 30],
  });

  const godLight = await toolHandlers.mineimator_add_light({
    project_path: projectPath,
    name: "Orbital God-Mode Laser Light",
    light_type: "spot",
    color: "#FF0033",
    range: 1500,
    position: [0, 2000, 500],
  });

  // ============================================================================
  // 5. NATIVE PARTICLE FX EMITTERS
  // ============================================================================
  console.log("\n[5/10] Generating Native Particle Emitters...");

  // Smoke column rising from ruins
  await toolHandlers.mineimator_spawn_particle_emitter({
    project_path: projectPath,
    name: "Ruins Smoke Plume",
    emitter_type: "black_smoke_column",
    position: [0, 1000, 16],
    start_frame: 120,
    duration_frames: 1050,
  });

  // Fire flames in ruined hearth
  await toolHandlers.mineimator_spawn_particle_emitter({
    project_path: projectPath,
    name: "Ruins Hearth Flames",
    emitter_type: "fire_plume",
    position: [-16, 1016, 16],
    start_frame: 120,
    duration_frames: 1050,
  });

  // Explosion burst at frame 780
  await toolHandlers.mineimator_spawn_particle_emitter({
    project_path: projectPath,
    name: "TNT Cataclysm Burst",
    emitter_type: "explosion_burst",
    position: [0, 1000, 0],
    start_frame: 780,
    duration_frames: 30,
  });

  // XP Dissolve orbs when Alex fades into poppy at frame 1020
  await toolHandlers.mineimator_spawn_particle_emitter({
    project_path: projectPath,
    name: "Alex XP Dissolve",
    emitter_type: "xp_dissolve_orbs",
    position: [0, 1010, 10],
    start_frame: 1020,
    duration_frames: 60,
  });

  // Orbital Laser Beam at frame 1450
  await toolHandlers.mineimator_spawn_particle_emitter({
    project_path: projectPath,
    name: "Server Wipe Orbital Laser",
    emitter_type: "orbital_laser_beam",
    position: [0, 2000, 120],
    start_frame: 1450,
    duration_frames: 120,
    particle_color: "#FF0033",
  });

  // ============================================================================
  // 6. AUDIO & SOUND EFFECTS TIMELINE
  // ============================================================================
  console.log("\n[6/10] Mixing Audio Tracks & Vanilla SFX Cues...");

  // Master Orchestral Theme
  await toolHandlers.mineimator_add_audio_track({
    project_path: projectPath,
    sound_file: "epic_orchestral_theme.ogg",
    name: "Cinematic BGM Track",
    start_frame: 0,
    volume: 0.9,
  });

  // Vanilla SFX Cues at Narrative Beats
  await toolHandlers.mineimator_trigger_sfx({ project_path: projectPath, sound_cue: "flint_and_steel", frame: 45 });
  await toolHandlers.mineimator_trigger_sfx({ project_path: projectPath, sound_cue: "tnt_primed", frame: 720 });
  await toolHandlers.mineimator_trigger_sfx({ project_path: projectPath, sound_cue: "explode", frame: 780, volume: 1.0 });
  await toolHandlers.mineimator_trigger_sfx({ project_path: projectPath, sound_cue: "pop", frame: 830 });
  await toolHandlers.mineimator_trigger_sfx({ project_path: projectPath, sound_cue: "orb", frame: 1020 });
  await toolHandlers.mineimator_trigger_sfx({ project_path: projectPath, sound_cue: "wither_spawn", frame: 1220 });
  await toolHandlers.mineimator_trigger_sfx({ project_path: projectPath, sound_cue: "explode", frame: 1450 });

  // ============================================================================
  // 7. KEYFRAMING WITH ANATOMICAL POSES & INVERSE KINEMATICS
  // ============================================================================
  console.log("\n[7/10] Animating Narrative Beats with Verified Poses & IK...");

  // --- BEAT 1 (Frames 0 - 120): The Proposal & The Glitch ---
  console.log("  -> Beat 1 (0:00-0:04): Proposal on Set 1");
  // Steve kneeling offer pose
  await toolHandlers.mineimator_apply_pose({
    project_path: projectPath,
    character_root_id: steve.root_timeline_id,
    pose_name: "kneel_offer",
    frame: 0,
  });
  // Analytical IK: Steve's hand reaches precisely to Alex's hand at [0, 18, 14]
  await toolHandlers.mineimator_solve_ik({
    project_path: projectPath,
    character_root_id: steve.root_timeline_id,
    limb_name: "right_arm",
    target_coords: [0, 18, 14],
    frame: 0,
    apply_to_project: true,
  });

  // Alex standing on Set 1
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: alex.root_timeline_id,
    frame: 0,
    values: { POS_X: 0, POS_Y: 24, POS_Z: 0, ROT_Z: 180, ALPHA: 1 },
  });
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: alex.parts.head,
    frame: 0,
    values: { ROT_X: 18, ROT_Z: 0 },
  });

  // Frame 45: Glitch flash of fire
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: fireLight.timeline_id,
    frame: 45,
    values: { ALPHA: 1 },
  });
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: fireLight.timeline_id,
    frame: 70,
    values: { ALPHA: 0 },
  });

  // Frame 80: Steve waves goodbye
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: steve.root_timeline_id,
    frame: 80,
    values: { POS_X: 0, POS_Y: -20, POS_Z: 0 },
  });
  await toolHandlers.mineimator_apply_pose({
    project_path: projectPath,
    character_root_id: steve.root_timeline_id,
    pose_name: "heroic_stand",
    frame: 80,
  });

  // --- BEAT 2 (Frames 120 - 420): Trek to Birch Hill on Set 2 ---
  console.log("  -> Beat 2 (0:04-0:14): Birch Hill Trek on Set 2");
  // Hide Alex during trek
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: alex.root_timeline_id,
    frame: 120,
    values: { ALPHA: 0 },
  });

  // Steve walk cycle across Birch Hill from Y=700 to Y=850
  await toolHandlers.mineimator_generate_walk_cycle({
    project_path: projectPath,
    character_timeline_id: steve.root_timeline_id,
    start_frame: 120,
    end_frame: 300,
    cycle_length: 24,
    forward_travel: 150,
  });

  // Steve freezes on hill crest at frame 320: Shock Freeze pose
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: steve.root_timeline_id,
    frame: 320,
    values: { POS_X: 0, POS_Y: 850, POS_Z: 32, ROT_Z: 0 },
  });
  await toolHandlers.mineimator_apply_pose({
    project_path: projectPath,
    character_root_id: steve.root_timeline_id,
    pose_name: "shock_freeze",
    frame: 320,
  });

  // --- BEAT 3 (Frames 420 - 810): Griefer Skybase Clash on Set 3 ---
  console.log("  -> Beat 3 (0:14-0:27): Griefer Skybase on Set 3");
  // Griefers shift-twerking on Skybase
  for (let f = 430; f <= 720; f += 20) {
    await toolHandlers.mineimator_apply_pose({
      project_path: projectPath,
      character_root_id: griefer1.root_timeline_id,
      pose_name: "griefer_shift_twerk",
      frame: f,
    });
    await toolHandlers.mineimator_apply_pose({
      project_path: projectPath,
      character_root_id: griefer2.root_timeline_id,
      pose_name: "griefer_shift_twerk",
      frame: f + 10,
    });
  }

  // Frame 730: Griefers vanish / pearl away
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: griefer1.root_timeline_id,
    frame: 730,
    values: { ALPHA: 0 },
  });
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: griefer2.root_timeline_id,
    frame: 730,
    values: { ALPHA: 0 },
  });

  // --- BEAT 4 (Frames 810 - 1170): The Ruins Tragedy on Set 2 ---
  console.log("  -> Beat 4 (0:27-0:39): The Tragedy in the Ruins on Set 2");
  // Steve arrives at ruined cottage at [0, 990, 0]
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: steve.root_timeline_id,
    frame: 810,
    values: { POS_X: 0, POS_Y: 990, POS_Z: 0, ROT_Z: 0 },
  });

  // Alex dying in rubble at [0, 1008, 0]
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: alex.root_timeline_id,
    frame: 820,
    values: { POS_X: 0, POS_Y: 1008, POS_Z: 0, ALPHA: 1 },
  });

  // Steve cradles Alex: Cradle Body pose
  await toolHandlers.mineimator_apply_pose({
    project_path: projectPath,
    character_root_id: steve.root_timeline_id,
    pose_name: "cradle_body",
    frame: 850,
  });

  // Analytical IK: Alex's arm touches Steve's cheek at [0, 995, 20]
  await toolHandlers.mineimator_solve_ik({
    project_path: projectPath,
    character_root_id: alex.root_timeline_id,
    limb_name: "right_arm",
    target_coords: [0, 995, 20],
    frame: 880,
    apply_to_project: true,
  });

  // Frame 970: Alex classic death tilt
  await toolHandlers.mineimator_apply_pose({
    project_path: projectPath,
    character_root_id: alex.root_timeline_id,
    pose_name: "death_tilt",
    frame: 970,
  });
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: alex.root_timeline_id,
    frame: 970,
    values: { COLOR: "#FF2222" },
  });
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: alex.root_timeline_id,
    frame: 1020,
    values: { ALPHA: 0 },
  });

  // Memorial Poppy blooms where Alex was
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: poppy.timeline_id,
    frame: 1019,
    values: { ALPHA: 0 },
  });
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: poppy.timeline_id,
    frame: 1020,
    values: { POS_X: 0, POS_Y: 1008, POS_Z: 0, ALPHA: 1 },
  });

  // Steve head bowed in grief
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: steve.parts.head,
    frame: 1040,
    values: { ROT_X: 55 },
  });

  // Frame 1140: Steve head snaps up, eyes glow crimson
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: steve.parts.head,
    frame: 1140,
    values: { ROT_X: -20, GLOW: true, GLOW_COLOR: "#FF0033" },
  });

  // --- BEAT 5 (Frames 1170 - 1590): God-Mode & Server Wipe on Set 3 ---
  console.log("  -> Beat 5 (0:39-0:53): God-Mode Levitation on Set 3");
  // Steve teleports to Set 3 at [0, 2000, 120]
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: steve.root_timeline_id,
    frame: 1170,
    values: { POS_X: 0, POS_Y: 2000, POS_Z: 120, ROT_Z: 0 },
  });

  // Steve levitates into the sky: God-Mode Levitate pose
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: steve.root_timeline_id,
    frame: 1250,
    values: { POS_Z: 120 },
  });
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: steve.root_timeline_id,
    frame: 1350,
    values: { POS_Z: 240 },
  });
  await toolHandlers.mineimator_apply_pose({
    project_path: projectPath,
    character_root_id: steve.root_timeline_id,
    pose_name: "god_mode_levitate",
    frame: 1350,
  });

  // Frame 1440: Steve invokes command strike
  await toolHandlers.mineimator_apply_pose({
    project_path: projectPath,
    character_root_id: steve.root_timeline_id,
    pose_name: "command_invoke",
    frame: 1440,
  });

  // --- BEAT 6 (Frames 1590 - 1800): Epilogue on Set 4 (Bedrock Void) ---
  console.log("  -> Beat 6 (0:53-1:00): Bedrock Void Epilogue on Set 4");
  // Steve stands in silhouette on Set 4 at [0, 3500, 16]
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: steve.root_timeline_id,
    frame: 1620,
    values: { POS_X: -16, POS_Y: 3500, POS_Z: 16, ROT_Z: -90, COLOR: "#0A0A12" },
  });
  await toolHandlers.mineimator_apply_pose({
    project_path: projectPath,
    character_root_id: steve.root_timeline_id,
    pose_name: "heroic_stand",
    frame: 1620,
  });

  // Plant Alex's blue orchid on the pedestal
  await toolHandlers.mineimator_insert_keyframe({
    project_path: projectPath,
    timeline_id: orchid.timeline_id,
    frame: 1620,
    values: { POS_X: 0, POS_Y: 3500, POS_Z: 32, ALPHA: 1 },
  });

  // ============================================================================
  // 8. DIRECTOR'S SHOT CAMERAS & FRAMING
  // ============================================================================
  console.log("\n[8/10] Constructing Director's Cameras with Hollywood Framing...");

  // Shot 1: Close-up on Porch (Set 1)
  const cam1 = await toolHandlers.mineimator_create_shot_camera({
    project_path: projectPath,
    name: "Cam_Shot1_PorchCloseUp",
    subject_pos: [0, 12, 16],
    framing: "close_up",
  });

  // Shot 2: Birch Hill Dolly Zoom (Set 2)
  const cam2 = await toolHandlers.mineimator_create_shot_camera({
    project_path: projectPath,
    name: "Cam_Shot2_HillDollyZoom",
    subject_pos: [0, 850, 35],
    framing: "medium",
    custom_distance: 25,
  });
  await toolHandlers.mineimator_generate_dolly_zoom({
    project_path: projectPath,
    camera_timeline_id: cam2.cameraId,
    subject_pos: [0, 850, 35],
    start_frame: 320,
    end_frame: 400,
    start_distance: 25,
    end_distance: 50,
    start_fov: 45,
  });

  // Shot 3: Griefer Skybase Medium Shot (Set 3)
  const cam3 = await toolHandlers.mineimator_create_shot_camera({
    project_path: projectPath,
    name: "Cam_Shot3_SkybaseMedium",
    subject_pos: [0, 2000, 150],
    framing: "medium",
  });

  // Shot 4: Ruins Tragedy OTS & Close-up (Set 2)
  const cam4 = await toolHandlers.mineimator_create_shot_camera({
    project_path: projectPath,
    name: "Cam_Shot4_RuinsTragedy",
    subject_pos: [0, 1000, 16],
    framing: "extreme_close_up",
  });

  // Shot 5: God-Mode IMAX Wide (Set 3) + Camera Shake
  const cam5 = await toolHandlers.mineimator_create_shot_camera({
    project_path: projectPath,
    name: "Cam_Shot5_GodModeWide",
    subject_pos: [0, 2000, 240],
    framing: "wide",
    custom_distance: 120,
  });
  await toolHandlers.mineimator_add_camera_shake({
    project_path: projectPath,
    camera_timeline_id: cam5.cameraId,
    start_frame: 1450,
    duration_frames: 40,
    magnitude: 6.5,
    decay: "exponential",
  });

  // Shot 6: Bedrock Void Epilogue Medium (Set 4)
  const cam6 = await toolHandlers.mineimator_create_shot_camera({
    project_path: projectPath,
    name: "Cam_Shot6_VoidEpilogue",
    subject_pos: [0, 3500, 24],
    framing: "medium",
    custom_distance: 40,
  });

  // Compile Master Storyboard
  const sbRes = await toolHandlers.mineimator_compile_storyboard({
    project_path: projectPath,
    shots: [
      { shotName: "The Proposal", cameraId: cam1.cameraId, startFrame: 0, endFrame: 120 },
      { shotName: "The Omen & Dolly Zoom", cameraId: cam2.cameraId, startFrame: 121, endFrame: 420 },
      { shotName: "Griefer Skybase", cameraId: cam3.cameraId, startFrame: 421, endFrame: 810 },
      { shotName: "The Tragedy", cameraId: cam4.cameraId, startFrame: 811, endFrame: 1170 },
      { shotName: "God-Mode Server Wipe", cameraId: cam5.cameraId, startFrame: 1171, endFrame: 1590 },
      { shotName: "Bedrock Epilogue", cameraId: cam6.cameraId, startFrame: 1591, endFrame: 1800 },
    ],
  });
  console.log(`✓ Master Storyboard compiled: ${sbRes.totalShots} shots spanning 1,800 frames.`);

  // ============================================================================
  // 9. VALIDATION & SPATIAL INTEGRITY INSPECTION
  // ============================================================================
  console.log("\n[9/10] Validating Complete Scene Graph & Geometry...");
  const valRes = await toolHandlers.mineimator_validate_project({ project_path: projectPath });
  console.log(`Project Schema Validation: valid = ${valRes.valid}`);
  if (!valRes.valid) {
    console.error("Validation issues:", valRes.issues);
    throw new Error("Project validation failed");
  }

  const graph = await toolHandlers.mineimator_inspect_scene_graph({ project_path: projectPath });
  console.log(`✓ Scene Graph Summary: ${graph.totalEntities} entities across timeline span [${graph.timelineSpan.join(", ")}].`);

  // ============================================================================
  // 10. MULTI-INSTALLATION MIRRORING, STAGING & LIVE RELOAD
  // ============================================================================
  console.log("\n[10/10] Synchronizing with Mine-imator...");
  const dProjects = "D:/Mine-imator/Projects";
  if (fs.existsSync(dProjects) && inst.projectsDir.toLowerCase() !== dProjects.toLowerCase()) {
    const mirrorDir = path.join(dProjects, "MCP Demo 10s");
    fs.cpSync(projectDir, mirrorDir, { recursive: true });
    console.log(`✓ Mirrored project to standard installation: ${mirrorDir}`);
  }

  // Staging into Slot 0 in recent.midata
  await toolHandlers.mineimator_stage_for_launch({
    project_path: projectPath,
    launch_now: false,
  });

  // Live reload & Capture Viewport
  const reloadRes = await toolHandlers.mineimator_live_reload({
    project_path: projectPath,
    mode: "auto",
    capture_after: true,
  });
  console.log(`✓ Live Reload: ${reloadRes.message}`);

  // Visual inspection report
  const visRes = await toolHandlers.mineimator_render_and_inspect_frame({
    project_path: projectPath,
    frame: 0,
    camera_name: "Cam_Shot1_PorchCloseUp",
  });
  console.log(`✓ Viewport Visual Inspection: ${visRes.totalInView} entities confirmed in camera frustum.`);

  console.log("\n================================================================================");
  console.log("  ★ COMPLETE PRODUCTION READY: 'STEVE'S REVENGE: SERVER WIPE' (V2.0)");
  console.log(`  File: ${projectPath}`);
  console.log("  Timeline: 00:00:00.000 to 00:01:00.000 (1800 Frames @ 30 FPS)");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR in animation production:", err);
  process.exit(1);
});
