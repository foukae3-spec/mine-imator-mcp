#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { toolHandlers } from "./tools/index.js";

const server = new Server(
  {
    name: "mine-imator-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOLS = [
  {
    name: "mineimator_create_project",
    description:
      "Scaffold a fresh Mine-imator 2.0.2 project (.miproject Format 34) with custom FPS, resolution, render settings, and environment defaults.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Target directory or .miproject file path to create.",
        },
        name: {
          type: "string",
          description: "Display name of the project.",
        },
        author: {
          type: "string",
          description: "Author name.",
        },
        description: {
          type: "string",
          description: "Project description.",
        },
        tempo: {
          type: "number",
          description: "Animation framerate / FPS (default: 24).",
        },
        video_width: {
          type: "number",
          description: "Output render width in pixels (default: 1280).",
        },
        video_height: {
          type: "number",
          description: "Output render height in pixels (default: 720).",
        },
        render_settings: {
          type: "string",
          enum: ["performance", "high", "custom"],
          description: "Preset render fidelity (default: 'performance').",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_read_project",
    description:
      "Parse and inspect a Mine-imator .miproject file, retrieving scene entities, hierarchies, keyframes, render pipeline, and environment configuration.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the .miproject file or project folder.",
        },
        include_keyframes: {
          type: "boolean",
          description: "Whether to include full keyframe data (default: true).",
        },
        summary_only: {
          type: "boolean",
          description:
            "If true, returns a concise structural summary instead of the full JSON tree.",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_set_environment",
    description:
      "Configure environment settings: time of day, sun position, sky color, sunlight, fog, wind, biome, and clouds in a Mine-imator project.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        sky_time: {
          type: "number",
          description:
            "Time of day in degrees (-45 is midday, 135 is midnight).",
        },
        sky_sun_angle: {
          type: "number",
          description: "Sun rotation angle around horizon in degrees.",
        },
        sunlight_strength: {
          type: "number",
          description: "Sunlight intensity multiplier (0 to 1).",
        },
        sunlight_color: {
          type: "string",
          description: "Sunlight hex color code (e.g., '#FFF7E4').",
        },
        sky_color: {
          type: "string",
          description: "Sky hex color code (e.g., '#78A7FF').",
        },
        ambient_color: {
          type: "string",
          description: "Ambient shadow hex color code (e.g., '#66708C').",
        },
        fog_show: {
          type: "boolean",
          description: "Toggle distance fog.",
        },
        fog_color: {
          type: "string",
          description: "Fog hex color code.",
        },
        fog_distance: {
          type: "number",
          description: "Distance at which fog reaches max density.",
        },
        fog_size: {
          type: "number",
          description: "Thickness of fog transition zone.",
        },
        wind: {
          type: "boolean",
          description: "Toggle foliage and foliage wind animation.",
        },
        wind_speed: {
          type: "number",
          description: "Wind oscillation speed.",
        },
        wind_strength: {
          type: "number",
          description: "Wind displacement strength.",
        },
        wind_direction: {
          type: "number",
          description: "Wind compass angle in degrees.",
        },
        biome: {
          type: "string",
          description: "Minecraft biome (e.g., 'plains', 'desert', 'forest').",
        },
        ground_name: {
          type: "string",
          description: "Ground block texture identifier.",
        },
        ground_show: {
          type: "boolean",
          description: "Whether ground plane is rendered.",
        },
        sky_clouds_show: {
          type: "boolean",
          description: "Toggle volumetric clouds.",
        },
        sky_clouds_speed: {
          type: "number",
          description: "Cloud movement velocity.",
        },
        sky_clouds_height: {
          type: "number",
          description: "Cloud layer elevation.",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_set_render_pipeline",
    description:
      "Configure graphics pipeline: SSAO, volumetric shadows, raytraced reflections, bloom, anti-aliasing, and color grading.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        render_ssao: {
          type: "boolean",
          description: "Enable Screen Space Ambient Occlusion.",
        },
        render_ssao_radius: {
          type: "number",
          description: "SSAO sample kernel radius.",
        },
        render_ssao_power: {
          type: "number",
          description: "SSAO darkening contrast exponent.",
        },
        render_shadows: {
          type: "boolean",
          description: "Enable cascaded shadow mapping.",
        },
        render_shadows_sun_buffer_size: {
          type: "number",
          enum: [512, 1024, 2048, 4096],
          description: "Shadow map texture resolution.",
        },
        render_reflections: {
          type: "boolean",
          description: "Enable screen space reflections.",
        },
        render_glow: {
          type: "boolean",
          description: "Enable bloom / emissive glow post-process.",
        },
        render_glow_intensity: {
          type: "number",
          description: "Glow brightness multiplier.",
        },
        render_glow_radius: {
          type: "number",
          description: "Glow blur radius.",
        },
        render_aa: {
          type: "boolean",
          description: "Enable anti-aliasing.",
        },
        render_samples: {
          type: "number",
          description: "Accumulation multisamples (e.g. 24 or 64).",
        },
        bend_style: {
          type: "string",
          enum: ["blocky", "curved"],
          description: "Limb bend geometric style.",
        },
        exposure: {
          type: "number",
          description: "Camera exposure multiplier.",
        },
        gamma: {
          type: "number",
          description: "Display gamma curve (standard: 2.2).",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_add_character",
    description:
      "Spawn a Minecraft character (human, zombie, skeleton, creeper, etc.) with a fully rigged 7-part biped hierarchy (head, hat, torso, arms, legs).",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        character_name: {
          type: "string",
          description: "Display name of the character.",
        },
        model_name: {
          type: "string",
          description: "Model type: 'human', 'zombie', 'skeleton', etc.",
        },
        variant: {
          type: "string",
          description: "Skin variant (e.g., 'steve', 'alex', 'zombie', 'husk').",
        },
        type: {
          type: "string",
          enum: ["wide", "slim"],
          description: "Player model arm geometry ('wide' or 'slim').",
        },
        position: {
          type: "array",
          items: { type: "number" },
          description: "Initial [X, Y, Z] world position.",
        },
        rotation: {
          type: "array",
          items: { type: "number" },
          description: "Initial [RX, RY, RZ] rotation in degrees.",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_add_block",
    description: "Insert a 3D block with custom texture and state.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        block_name: {
          type: "string",
          description: "Block registry name (e.g., 'stone', 'diamond_block', 'oak_stairs').",
        },
        block_state: {
          type: "object",
          description: "Block state key-value pairs (e.g. { facing: 'north' }).",
        },
        position: {
          type: "array",
          items: { type: "number" },
          description: "[X, Y, Z] position.",
        },
        rotation: {
          type: "array",
          items: { type: "number" },
          description: "[RX, RY, RZ] rotation.",
        },
      },
      required: ["project_path", "block_name"],
    },
  },
  {
    name: "mineimator_add_item",
    description:
      "Insert an item (sword, tool, food) and optionally attach/parent it to a character's hand or body part.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        item_name: {
          type: "string",
          description: "Item name (e.g. 'diamond_sword', 'iron_pickaxe').",
        },
        name: {
          type: "string",
          description: "Optional custom display name for the item timeline.",
        },
        parent_timeline_id: {
          type: "string",
          description: "Parent timeline ID (e.g. right_arm ID) or 'root'.",
        },
        grip: {
          type: "string",
          enum: ["right_hand", "left_hand", "none", "auto"],
          description: "Grip transform preset. 'auto' applies realistic sword/item grip when parent is an arm.",
        },
        position: {
          type: "array",
          items: { type: "number" },
          description: "[X, Y, Z] offset (defaults to realistic hand grip if attached to an arm).",
        },
        rotation: {
          type: "array",
          items: { type: "number" },
          description: "[RX, RY, RZ] rotation (defaults to realistic hand grip if attached to an arm).",
        },
        scale: {
          type: "array",
          items: { type: "number" },
          description: "[SX, SY, SZ] scale.",
        },
      },
      required: ["project_path", "item_name"],
    },
  },
  {
    name: "mineimator_add_light",
    description:
      "Place a point light or spot light with custom color, range, and shadow attenuation.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        light_type: {
          type: "string",
          enum: ["point", "spot"],
          description: "Type of light source ('point' or 'spot').",
        },
        name: {
          type: "string",
          description: "Light timeline name.",
        },
        position: {
          type: "array",
          items: { type: "number" },
          description: "[X, Y, Z] coordinates.",
        },
        color: {
          type: "string",
          description: "Hex color (default: '#FFFFFF').",
        },
        range: {
          type: "number",
          description: "Illumination radius in units (default: 250).",
        },
        fade_size: {
          type: "number",
          description: "Attenuation falloff sharpness (0.0 to 1.0).",
        },
        spot_cutoff: {
          type: "number",
          description: "Cone radius for spotlight in degrees.",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_add_camera",
    description:
      "Create a cinematic camera with FOV control and depth of field parameters.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        name: {
          type: "string",
          description: "Camera name.",
        },
        position: {
          type: "array",
          items: { type: "number" },
          description: "[X, Y, Z] camera position.",
        },
        rotation: {
          type: "array",
          items: { type: "number" },
          description: "[RX, RY, RZ] camera angles (pitch, roll, yaw).",
        },
        target: {
          type: "array",
          items: { type: "number" },
          description: "[X, Y, Z] target point to orient the camera towards (computes pitch and yaw automatically).",
        },
        look_at: {
          type: "array",
          items: { type: "number" },
          description: "Alias for target [X, Y, Z].",
        },
        fov: {
          type: "number",
          description: "Field of view in degrees (default: 45).",
        },
        dof: {
          type: "boolean",
          description: "Enable Depth of Field blur.",
        },
        dof_distance: {
          type: "number",
          description: "Focal plane distance.",
        },
        dof_range: {
          type: "number",
          description: "In-focus sharp range depth.",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_insert_keyframe",
    description:
      "Insert or update a keyframe on any timeline node at a specific frame number.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        timeline_id: {
          type: "string",
          description: "Target timeline ID.",
        },
        frame: {
          type: "number",
          description: "Frame index (integer >= 0).",
        },
        values: {
          type: "object",
          description:
            "Keyframe properties (POS_X/Y/Z, ROT_X/Y/Z, SCA_X/Y/Z, BEND_ANGLE_X, TRANSITION, ALPHA, etc.).",
        },
      },
      required: ["project_path", "timeline_id", "frame", "values"],
    },
  },
  {
    name: "mineimator_generate_walk_cycle",
    description:
      "Compute and generate natural sinusoidal Minecraft walking keyframes across character limbs (arms, legs, torso vertical bob, and forward travel).",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        character_timeline_id: {
          type: "string",
          description: "Root character timeline ID.",
        },
        start_frame: {
          type: "number",
          description: "Start frame for walk animation (default: 0).",
        },
        end_frame: {
          type: "number",
          description: "End frame for walk animation (default: 48).",
        },
        cycle_length: {
          type: "number",
          description: "Frames per full 2-step cycle (default: 24).",
        },
        arm_swing_angle: {
          type: "number",
          description: "Max arm swing angle in degrees (default: 35).",
        },
        leg_swing_angle: {
          type: "number",
          description: "Max leg swing angle in degrees (default: 35).",
        },
        bob_height: {
          type: "number",
          description: "Torso vertical bounce amplitude in units (default: 1.2).",
        },
        forward_travel: {
          type: "number",
          description: "Total distance to translate forward along Y axis (default: 0).",
        },
      },
      required: ["project_path", "character_timeline_id"],
    },
  },
  {
    name: "mineimator_generate_camera_path",
    description:
      "Generate smooth 3D spline camera motions with automatic Look-At target tracking.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        camera_timeline_id: {
          type: "string",
          description: "Camera timeline ID.",
        },
        waypoints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              frame: { type: "number" },
              position: {
                type: "array",
                items: { type: "number" },
              },
              rotation: {
                type: "array",
                items: { type: "number" },
              },
              look_at: {
                type: "array",
                items: { type: "number" },
                description: "[X, Y, Z] target point to track automatically.",
              },
              transition: { type: "string" },
            },
            required: ["frame", "position"],
          },
          description: "Keyframe waypoint sequence.",
        },
        smooth: {
          type: "boolean",
          description:
            "If true, computes Catmull-Rom cubic spline interpolation across intermediate frames.",
        },
        interpolation: {
          type: "string",
          enum: ["smooth", "linear"],
          description: "Interpolation style ('smooth' for Catmull-Rom spline, 'linear' for direct keyframing).",
        },
        sample_interval: {
          type: "number",
          description: "Frames between interpolated samples (default: 4).",
        },
      },
      required: ["project_path", "camera_timeline_id", "waypoints"],
    },
  },
  {
    name: "mineimator_clear_keyframes",
    description:
      "Delete or trim keyframes across specified timelines and frame windows.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        timeline_id: {
          type: "string",
          description: "Timeline ID to clear, or 'all' to clear all timelines.",
        },
        from_frame: {
          type: "number",
          description: "Optional start of frame deletion window.",
        },
        to_frame: {
          type: "number",
          description: "Optional end of frame deletion window.",
        },
        recursive: {
          type: "boolean",
          description: "If true, also clears keyframes in all child body parts.",
        },
      },
      required: ["project_path", "timeline_id"],
    },
  },
  {
    name: "mineimator_list_minecraft_assets",
    description:
      "Query available Minecraft characters, blocks, items, biomes, and particles from Mine-imator data libraries.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [
            "characters",
            "blocks",
            "special_blocks",
            "items",
            "particles",
            "biomes",
            "all",
          ],
          description: "Asset category to inspect.",
        },
        filter: {
          type: "string",
          description: "Search keyword substring filter.",
        },
        data_dir: {
          type: "string",
          description: "Optional custom path to Mine-imator Data directory.",
        },
        version: {
          type: "string",
          description: "Minecraft data version (default: '1.20.2').",
        },
      },
    },
  },
  {
    name: "mineimator_import_schematic",
    description:
      "Attach a .schematic or world export file to the scene with automatic companion .meshcache management.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project.",
        },
        schematic_path: {
          type: "string",
          description: "Path to .schematic or .nbt file.",
        },
        name: {
          type: "string",
          description: "Optional scenery display name.",
        },
        position: {
          type: "array",
          items: { type: "number" },
          description: "[X, Y, Z] world position.",
        },
        copy_to_project: {
          type: "boolean",
          description:
            "Whether to copy the schematic file into the project folder (default: true).",
        },
      },
      required: ["project_path", "schematic_path"],
    },
  },
  {
    name: "mineimator_stage_for_launch",
    description:
      "Inject and pin project to slot 0 in Mine-imator's Data/recent.midata and launch Mine-imator.exe for instant opening.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project file to stage.",
        },
        data_dir: {
          type: "string",
          description: "Path to Mine-imator Data directory (default: 'D:/Mine-imator/Data').",
        },
        mineimator_exe: {
          type: "string",
          description: "Path to Mine-imator.exe executable (default: 'D:/Mine-imator/Mine-imator.exe').",
        },
        launch_now: {
          type: "boolean",
          description: "Whether to launch Mine-imator.exe immediately (default: true).",
        },
        pinned: {
          type: "boolean",
          description: "Pin to top of recent files dashboard (default: true).",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_open_via_drop",
    description:
      "Bring running Mine-imator window to foreground and load staged project.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to project to load.",
        },
        timeout_ms: {
          type: "number",
          description: "Window activation timeout in milliseconds (default: 5000).",
        },
        data_dir: {
          type: "string",
          description: "Optional custom path to Mine-imator Data directory.",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_validate_project",
    description:
      "Lint and validate a Mine-imator project for orphaned body parts, missing IDs, invalid transitions, and schema compliance.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project file.",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_export_video",
    description:
      "Stage project and prepare video rendering export automation.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to project.",
        },
        output_path: {
          type: "string",
          description: "Destination video file path (.mp4, .wmv).",
        },
        format: {
          type: "string",
          enum: ["mp4", "wmv", "png_sequence"],
          description: "Export format (default: 'mp4').",
        },
        include_audio: {
          type: "boolean",
          description: "Include project audio tracks (default: true).",
        },
        mineimator_exe: {
          type: "string",
          description: "Path to Mine-imator.exe executable.",
        },
        data_dir: {
          type: "string",
          description: "Optional custom path to Mine-imator Data directory.",
        },
      },
      required: ["project_path", "output_path"],
    },
  },
  {
    name: "mineimator_capture_viewport",
    description:
      "Capture a high-resolution screenshot of the Mine-imator Direct3D viewport via Win32 GDI.",
    inputSchema: {
      type: "object",
      properties: {
        output_image_path: {
          type: "string",
          description: "Destination PNG file path.",
        },
        window_title: {
          type: "string",
          description: "Window title substring to locate (default: 'Mine-imator').",
        },
      },
      required: ["output_image_path"],
    },
  },
  {
    name: "mineimator_live_reload",
    description:
      "Hot-reload or relaunch Mine-imator (Vexel Build or standard) live with the current project, and optionally capture a visual confirmation screenshot.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the .miproject file to reload.",
        },
        mode: {
          type: "string",
          enum: ["auto", "relaunch", "drop", "focus"],
          description:
            "Reload mode: 'auto' (reloads/relaunches running instance), 'relaunch' (cleanly restarts with project), 'drop' (posts WM_DROPFILES to active window), 'focus' (activates window only).",
        },
        data_dir: {
          type: "string",
          description: "Optional custom Mine-imator Data directory.",
        },
        mineimator_exe: {
          type: "string",
          description: "Optional custom Mine-imator executable path.",
        },
        capture_after: {
          type: "boolean",
          description: "Whether to capture a viewport screenshot after reload (default: true).",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_solve_ik",
    description:
      "Solve 2-bone analytical Inverse Kinematics (Law of Cosines) for a limb and optionally apply shoulder/hip rotation and elbow/knee bend to a character timeline.",
    inputSchema: {
      type: "object",
      properties: {
        limb_name: {
          type: "string",
          enum: ["right_arm", "left_arm", "right_leg", "left_leg"],
          description: "Target limb to solve IK for.",
        },
        target_coords: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3,
          description: "Target 3D position [X, Y, Z] to reach for.",
        },
        shoulder_pos: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3,
          description: "Optional custom shoulder/hip pivot position [X, Y, Z].",
        },
        project_path: {
          type: "string",
          description: "Optional project path to inject keyframe into.",
        },
        character_root_id: {
          type: "string",
          description: "Optional character root timeline ID if applying to project.",
        },
        frame: {
          type: "number",
          description: "Keyframe number to inject into (default: 0).",
        },
        pole_vector: {
          type: "array",
          items: { type: "number" },
          description: "Direction vector guiding joint bending plane.",
        },
        apply_to_project: {
          type: "boolean",
          description: "Whether to write keyframe to the project file (default: false).",
        },
      },
      required: ["limb_name", "target_coords"],
    },
  },
  {
    name: "mineimator_apply_pose",
    description:
      "Apply an anatomically verified Minecraft biped pose (heroic stand, kneeling offer, death tilt, levitation, crouch twerk, bow aim, cradle body, shock freeze, etc.) to a character at a specific frame.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        character_root_id: {
          type: "string",
          description: "Root timeline ID of character.",
        },
        pose_name: {
          type: "string",
          description:
            "Name of pose (e.g. 'heroic_stand', 'kneel_offer', 'death_tilt', 'god_mode_levitate', 'griefer_shift_twerk', 'bow_aim', 'cradle_body', 'shock_freeze', 'sword_strike', 'shield_block', 'sitting', 'celebrate', 'sprint', 'falling', 'command_invoke').",
        },
        frame: {
          type: "number",
          description: "Timeline frame to insert pose keyframes at (default: 0).",
        },
        transition: {
          type: "string",
          description: "Interpolation transition type (default: 'easeinoutquad').",
        },
      },
      required: ["project_path", "character_root_id", "pose_name"],
    },
  },
  {
    name: "mineimator_spawn_structure",
    description:
      "Spawn a procedural voxel structure preset (cottage porch, birch forest hill, burnt cottage ruins, griefer skybase, bedrock void pedestal) into a project.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        preset_name: {
          type: "string",
          enum: [
            "cottage_porch",
            "birch_forest_hill",
            "ruined_cottage",
            "griefer_skybase",
            "bedrock_void",
          ],
          description: "Structure preset to generate.",
        },
        origin: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3,
          description: "World coordinates [X, Y, Z] to anchor structure at.",
        },
      },
      required: ["project_path", "preset_name"],
    },
  },
  {
    name: "mineimator_create_scene_set",
    description:
      "Create a physically segregated spatial scene set with designated origin, architecture, bounding envelope, and dedicated shot camera to prevent prop collisions across beats.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        name: {
          type: "string",
          description: "Display name of the scene set.",
        },
        set_id: {
          type: "string",
          description: "Unique identifier for this set.",
        },
        origin: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3,
          description: "Anchor coordinate [X, Y, Z] for the physical set.",
        },
        structure_preset: {
          type: "string",
          enum: [
            "cottage_porch",
            "birch_forest_hill",
            "ruined_cottage",
            "griefer_skybase",
            "bedrock_void",
          ],
          description: "Optional structure preset to populate the set.",
        },
        create_camera: {
          type: "boolean",
          description:
            "Whether to generate a dedicated shot camera framed on this set (default: true).",
        },
      },
      required: ["project_path", "name", "set_id", "origin"],
    },
  },
  {
    name: "mineimator_spawn_particle_emitter",
    description:
      "Generate native Mine-imator particle emitters (fire plume, black smoke column, explosion burst, XP dissolve orbs, orbital laser beam).",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        emitter_type: {
          type: "string",
          enum: [
            "fire_plume",
            "black_smoke_column",
            "explosion_burst",
            "xp_dissolve_orbs",
            "orbital_laser_beam",
            "custom",
          ],
          description: "Type of particle system.",
        },
        position: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3,
          description: "World coordinates [X, Y, Z] to spawn emitter at.",
        },
        name: {
          type: "string",
          description: "Display name for the particle spawner.",
        },
        start_frame: {
          type: "number",
          description: "Frame where particle spawning starts.",
        },
        duration_frames: {
          type: "number",
          description: "Duration in frames before emitter stops spawning.",
        },
        spawn_rate: {
          type: "number",
          description: "Particles emitted per second.",
        },
        particle_color: {
          type: "string",
          description: "Hex color code (#RRGGBB) tint for particles.",
        },
        particle_scale: {
          type: "number",
          description: "Scale multiplier for particle size.",
        },
      },
      required: ["project_path", "emitter_type", "position"],
    },
  },
  {
    name: "mineimator_add_audio_track",
    description:
      "Add an audio resource and a dedicated sound track timeline to the project.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        sound_file: {
          type: "string",
          description: "Audio filename (.ogg, .wav, .mp3) or vanilla sound name.",
        },
        name: {
          type: "string",
          description: "Display name of the audio track.",
        },
        start_frame: {
          type: "number",
          description: "Timeline frame to trigger audio.",
        },
        volume: {
          type: "number",
          description: "Playback volume from 0.0 to 1.0 (default: 1.0).",
        },
        pitch: {
          type: "number",
          description: "Playback pitch multiplier (default: 1.0).",
        },
      },
      required: ["project_path", "sound_file"],
    },
  },
  {
    name: "mineimator_trigger_sfx",
    description:
      "Trigger a vanilla Minecraft game sound effect (TNT primed, explosion, flint & steel, XP orb, pop, anvil, sword slash, teleport, bow shoot, wither spawn) at a specific frame.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        sound_cue: {
          type: "string",
          description:
            "Vanilla sound cue (e.g. 'tnt_primed', 'explode', 'flint_and_steel', 'orb', 'pop', 'anvil_land', 'sword_slash', 'teleport', 'bow_shoot', 'wither_spawn').",
        },
        frame: {
          type: "number",
          description: "Timeline frame number to play sound at.",
        },
        volume: {
          type: "number",
          description: "Playback volume (default: 1.0).",
        },
        pitch: {
          type: "number",
          description: "Playback pitch (default: 1.0).",
        },
        timeline_id: {
          type: "string",
          description: "Optional existing audio timeline ID to reuse.",
        },
        name: {
          type: "string",
          description: "Optional display name for track.",
        },
      },
      required: ["project_path", "sound_cue", "frame"],
    },
  },
  {
    name: "mineimator_create_shot_camera",
    description:
      "Create a director camera framed according to Hollywood rules (extreme close-up, close-up, medium shot, wide shot, over-the-shoulder) targeted at a subject.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        name: {
          type: "string",
          description: "Camera name (e.g. 'Cam_Shot1_CloseUp').",
        },
        subject_pos: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3,
          description: "Subject 3D coordinate [X, Y, Z] to frame.",
        },
        framing: {
          type: "string",
          enum: [
            "extreme_close_up",
            "close_up",
            "medium",
            "wide",
            "over_the_shoulder",
          ],
          description: "Cinematography framing preset (default: 'medium').",
        },
        angle_yaw_deg: {
          type: "number",
          description:
            "Horizontal orbital angle in degrees around subject (0: in front, 90: side).",
        },
        custom_fov: {
          type: "number",
          description: "Override camera Field of View in degrees.",
        },
        custom_distance: {
          type: "number",
          description: "Override distance from subject.",
        },
        look_at_target: {
          type: "array",
          items: { type: "number" },
          description: "Explicit look-at target [X, Y, Z].",
        },
      },
      required: ["project_path", "name", "subject_pos"],
    },
  },
  {
    name: "mineimator_generate_dolly_zoom",
    description:
      "Generate Hitchcock vertigo / dolly zoom keyframes on a camera timeline, preserving subject screen height while perspective expands or compresses.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        camera_timeline_id: {
          type: "string",
          description: "Camera timeline ID.",
        },
        subject_pos: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3,
          description: "Subject focus position [X, Y, Z].",
        },
        start_frame: {
          type: "number",
          description: "Start frame of dolly zoom.",
        },
        end_frame: {
          type: "number",
          description: "End frame of dolly zoom.",
        },
        start_distance: {
          type: "number",
          description: "Initial camera distance from subject.",
        },
        end_distance: {
          type: "number",
          description: "Final camera distance from subject.",
        },
        start_fov: {
          type: "number",
          description: "Initial camera FOV in degrees (default: 45).",
        },
        transition: {
          type: "string",
          description: "Keyframe interpolation transition.",
        },
      },
      required: [
        "project_path",
        "camera_timeline_id",
        "subject_pos",
        "start_frame",
        "end_frame",
        "start_distance",
        "end_distance",
      ],
    },
  },
  {
    name: "mineimator_add_camera_shake",
    description:
      "Inject procedural high-frequency camera shake keyframes to simulate TNT blasts, meteor impacts, earthquakes, or explosions.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        camera_timeline_id: {
          type: "string",
          description: "Camera timeline ID.",
        },
        start_frame: {
          type: "number",
          description: "Frame where shake begins.",
        },
        duration_frames: {
          type: "number",
          description: "Duration of tremor in frames.",
        },
        magnitude: {
          type: "number",
          description: "Max rotational shake amplitude in degrees (default: 4.5).",
        },
        frequency: {
          type: "number",
          description: "Oscillation frequency (default: 0.6).",
        },
        decay: {
          type: "string",
          enum: ["exponential", "linear"],
          description: "Damping envelope mode (default: 'exponential').",
        },
      },
      required: [
        "project_path",
        "camera_timeline_id",
        "start_frame",
        "duration_frames",
      ],
    },
  },
  {
    name: "mineimator_inspect_scene_graph",
    description:
      "Inspect the full 3D spatial scene graph: list all entities, types, parents, coordinates, rotations, bounding estimates, and active keyframe spans.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_check_camera_frustum",
    description:
      "Evaluate whether a target entity is within the camera's view frustum and compute its 2D screen coordinates, NDC position, depth, and framing zone.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        camera_timeline_id: {
          type: "string",
          description: "Camera timeline ID to test against.",
        },
        entity_timeline_id: {
          type: "string",
          description: "Target entity timeline ID to evaluate.",
        },
        frame: {
          type: "number",
          description: "Frame index to check (default: 0).",
        },
        fov: {
          type: "number",
          description: "Optional override for camera FOV in degrees.",
        },
      },
      required: ["project_path", "camera_timeline_id", "entity_timeline_id"],
    },
  },
  {
    name: "mineimator_snap_to_ground",
    description:
      "Detect whether an entity or character's feet are penetrating or floating above a ground surface and optionally snap POS_Z to exact contact height.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        entity_timeline_id: {
          type: "string",
          description: "Entity timeline ID to inspect and snap.",
        },
        surface_z: {
          type: "number",
          description: "Ground surface elevation Z (default: 0).",
        },
        frame: {
          type: "number",
          description: "Frame index to check (default: 0).",
        },
        apply_snap: {
          type: "boolean",
          description:
            "Whether to update project with corrected POS_Z (default: false).",
        },
      },
      required: ["project_path", "entity_timeline_id"],
    },
  },
  {
    name: "mineimator_render_and_inspect_frame",
    description:
      "Capture the active Mine-imator viewport and compute 2D screen bounding boxes for all in-frame entities, returning visual perception data for AI closed-loop inspection.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        frame: {
          type: "number",
          description: "Frame number to inspect (default: 0).",
        },
        camera_name: {
          type: "string",
          description: "Optional specific camera name to inspect from.",
        },
        window_title: {
          type: "string",
          description: "Mine-imator window title substring.",
        },
        output_image_path: {
          type: "string",
          description: "Destination file path for captured viewport PNG.",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "mineimator_compile_storyboard",
    description:
      "Compile a master multi-scene storyboard manifest into the project timeline, validating shot boundaries and camera switches.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to .miproject file.",
        },
        shots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              shotName: { type: "string" },
              cameraId: { type: "string" },
              startFrame: { type: "number" },
              endFrame: { type: "number" },
              description: { type: "string" },
            },
            required: ["shotName", "cameraId", "startFrame", "endFrame"],
          },
          description: "Ordered list of shot cameras and frame spans.",
        },
      },
      required: ["project_path", "shots"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handler = (toolHandlers as Record<string, Function>)[name];
  if (!handler) {
    throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
  }

  try {
    const result = await handler(args || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${msg}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mine-imator MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting Mine-imator MCP server:", err);
  process.exit(1);
});
