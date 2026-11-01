import * as path from "node:path";
import {
  CameraWaypoint,
  clearKeyframes,
  computeLookAtAngles,
  generateCameraPath,
  generateWalkCycle,
  insertKeyframe,
} from "../core/animation.js";
import { createDefaultInheritanceSettings } from "../core/defaults.js";
import { buildCharacterHierarchy } from "../core/hierarchy.js";
import { save_id_create } from "../core/id.js";
import {
  createNewProject,
  readProjectFile,
  resolveProjectPath,
  writeProjectFile,
} from "../core/project.js";
import { listMinecraftAssets } from "../bridge/assets.js";
import { stageProjectForLaunch } from "../bridge/recent.js";
import { importSchematic } from "../bridge/schematic.js";
import {
  captureMineimatorViewport,
  exportVideoAutomation,
  liveReloadAutomation,
  openViaDrop,
} from "../bridge/windows.js";
import { validateMiProject } from "../schema/validation.js";
import {
  BackgroundSettings,
  KeyframeValues,
  MiProject,
  RenderSettings,
  TemplateNode,
  TimelineNode,
  TransitionType,
} from "../types/miproject.js";
import {
  applyIKToCharacter,
  solveLimbIK,
} from "../core/ik.js";
import {
  applyPoseToCharacter,
  listAvailablePoses,
  getPose,
} from "../core/poses.js";
import {
  createSceneSet,
  spawnStructure,
  StructurePresetName,
} from "../core/structures.js";
import {
  spawnParticleEmitter,
  ParticleEmitterType,
} from "../core/particles.js";
import {
  addAudioTrack,
  applyVolumeEnvelope,
  triggerSFX,
} from "../core/audio.js";
import {
  addCameraShake,
  compileStoryboard,
  createShotCamera,
  generateDollyZoom,
  FramingPreset,
  StoryboardShot,
} from "../core/director.js";
import {
  checkEntityVisibility,
  groundSnapCheck,
  inspectSceneGraph,
  renderAndInspectFrame,
} from "../core/vision.js";

export const toolHandlers = {
  // 1. Create Project
  mineimator_create_project: async (args: {
    project_path: string;
    name?: string;
    author?: string;
    description?: string;
    tempo?: number;
    video_width?: number;
    video_height?: number;
    render_settings?: "performance" | "high" | "custom";
  }) => {
    const res = createNewProject(args);
    return {
      success: true,
      project_path: res.projectFilePath,
      format: res.project.format,
      created_in: res.project.created_in,
      project_name: res.project.project.name,
      tempo: res.project.project.tempo,
      resolution: `${res.project.project.video_width}x${res.project.project.video_height}`,
    };
  },

  // 2. Read Project
  mineimator_read_project: async (args: {
    project_path: string;
    include_keyframes?: boolean;
    summary_only?: boolean;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    if (args.summary_only) {
      return {
        project_path: filePath,
        format: project.format,
        created_in: project.created_in,
        project_name: project.project?.name,
        author: project.project?.author,
        tempo: project.project?.tempo,
        resolution: `${project.project?.video_width}x${project.project?.video_height}`,
        templates_count: project.templates?.length || 0,
        timelines_count: project.timelines?.length || 0,
        resources_count: project.resources?.length || 0,
        timelines: (project.timelines || []).map((t) => ({
          id: t.id,
          name: t.name || t.model_part_name || "",
          type: t.type,
          parent: t.parent,
          part_of: t.part_of,
          keyframe_count: Object.keys(t.keyframes || {}).length,
        })),
      };
    }

    if (args.include_keyframes === false) {
      const sanitizedTimelines = (project.timelines || []).map((tl) => {
        const copy = { ...tl };
        copy.keyframes = {};
        return copy;
      });
      return {
        ...project,
        timelines: sanitizedTimelines,
      };
    }

    return project;
  },

  // 3. Set Environment
  mineimator_set_environment: async (args: {
    project_path: string;
    sky_time?: number;
    sky_sun_angle?: number;
    sunlight_strength?: number;
    sunlight_color?: string;
    sky_color?: string;
    ambient_color?: string;
    fog_show?: boolean;
    fog_color?: string;
    fog_distance?: number;
    fog_size?: number;
    wind?: boolean;
    wind_speed?: number;
    wind_strength?: number;
    wind_direction?: number;
    biome?: string;
    ground_name?: string;
    ground_show?: boolean;
    sky_clouds_show?: boolean;
    sky_clouds_speed?: number;
    sky_clouds_height?: number;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    if (!project.background) {
      throw new Error("Project background configuration is missing");
    }

    const bg = project.background as Record<string, unknown>;
    const updateKeys: (keyof typeof args)[] = [
      "sky_time",
      "sky_sun_angle",
      "sunlight_strength",
      "sunlight_color",
      "sky_color",
      "ambient_color",
      "fog_show",
      "fog_color",
      "fog_distance",
      "fog_size",
      "wind",
      "wind_speed",
      "wind_strength",
      "wind_direction",
      "biome",
      "ground_name",
      "ground_show",
      "sky_clouds_show",
      "sky_clouds_speed",
      "sky_clouds_height",
    ];

    for (const key of updateKeys) {
      if (args[key] !== undefined) {
        bg[key] = args[key];
      }
    }

    writeProjectFile(filePath, project);
    return {
      success: true,
      message: "Environment background updated successfully",
      background: project.background,
    };
  },

  // 4. Set Render Pipeline
  mineimator_set_render_pipeline: async (args: {
    project_path: string;
    render_ssao?: boolean;
    render_ssao_radius?: number;
    render_ssao_power?: number;
    render_shadows?: boolean;
    render_shadows_sun_buffer_size?: number;
    render_reflections?: boolean;
    render_glow?: boolean;
    render_glow_intensity?: number;
    render_glow_radius?: number;
    render_aa?: boolean;
    render_samples?: number;
    bend_style?: "blocky" | "curved";
    exposure?: number;
    gamma?: number;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    if (!project.render) {
      throw new Error("Project render configuration is missing");
    }

    const rnd = project.render as Record<string, unknown>;
    const updateKeys: (keyof typeof args)[] = [
      "render_ssao",
      "render_ssao_radius",
      "render_ssao_power",
      "render_shadows",
      "render_shadows_sun_buffer_size",
      "render_reflections",
      "render_glow",
      "render_glow_intensity",
      "render_glow_radius",
      "render_aa",
      "render_samples",
      "bend_style",
      "exposure",
      "gamma",
    ];

    for (const key of updateKeys) {
      if (args[key] !== undefined) {
        rnd[key] = args[key];
      }
    }

    writeProjectFile(filePath, project);
    return {
      success: true,
      message: "Render pipeline settings updated successfully",
      render: project.render,
    };
  },

  // 5. Add Character
  mineimator_add_character: async (args: {
    project_path: string;
    character_name?: string;
    model_name?: string;
    variant?: string;
    type?: "wide" | "slim";
    position?: [number, number, number];
    rotation?: [number, number, number];
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const rootIndex = project.timelines.filter((t) => t.parent === "root").length;
    const charResult = buildCharacterHierarchy(
      {
        name: args.character_name || "Character",
        model_name: args.model_name || "human",
        variant: args.variant || "steve",
        type: args.type || "wide",
        position: args.position,
        rotation: args.rotation,
      },
      rootIndex
    );

    project.templates.push(charResult.template);
    project.timelines.push(charResult.rootTimeline);
    for (const part of charResult.parts) {
      project.timelines.push(part);
    }

    writeProjectFile(filePath, project);

    return {
      success: true,
      root_timeline_id: charResult.rootTimeline.id,
      template_id: charResult.template.id,
      parts: charResult.partIds,
      total_parts_created: charResult.parts.length,
      message: `Character '${args.character_name || "Character"}' added with 7-part hierarchy.`,
    };
  },

  // 6. Add Block
  mineimator_add_block: async (args: {
    project_path: string;
    block_name: string;
    block_state?: Record<string, string>;
    position?: [number, number, number];
    rotation?: [number, number, number];
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    const templateId = save_id_create();
    const timelineId = save_id_create();

    const templateNode: TemplateNode = {
      id: templateId,
      type: "block",
      name: "",
      block: {
        name: args.block_name,
        state: args.block_state || {},
        tex: "default",
        repeat_enable: false,
        repeat: [1, 1, 1],
      },
    };

    const pos = args.position || [0, 0, 0];
    const rot = args.rotation || [0, 0, 0];

    const rootIndex = project.timelines.filter((t) => t.parent === "root").length;

    const timelineNode: TimelineNode = {
      id: timelineId,
      type: "block",
      name: args.block_name,
      temp: templateId,
      color_tag: "null",
      hide: false,
      lock: false,
      ghost: false,
      depth: 0,
      block: {
        name: args.block_name,
        state: args.block_state || {},
      },
      default_values: {
        POS_X: pos[0],
        POS_Y: pos[1],
        POS_Z: pos[2],
        ROT_X: rot[0],
        ROT_Y: rot[1],
        ROT_Z: rot[2],
      },
      keyframes: {},
      parent: "root",
      parent_tree_index: rootIndex,
      lock_bend: true,
      tree_extend: false,
      inherit: createDefaultInheritanceSettings(false),
      scale_resize: false,
      shadows: true,
      ssao: true,
      fog: true,
      blend_mode: "normal",
    };

    project.templates.push(templateNode);
    project.timelines.push(timelineNode);

    writeProjectFile(filePath, project);

    return {
      success: true,
      timeline_id: timelineId,
      template_id: templateId,
      block_name: args.block_name,
    };
  },

  // 7. Add Item
  mineimator_add_item: async (args: {
    project_path: string;
    item_name: string;
    name?: string;
    parent_timeline_id?: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    grip?: "right_hand" | "left_hand" | "none" | "auto";
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    const templateId = save_id_create();
    const timelineId = save_id_create();

    const templateNode: TemplateNode = {
      id: templateId,
      type: "item",
      name: "",
      item: {
        name: args.item_name,
        slot: 0,
        bounce: false,
        spin: false,
      },
    };

    const parentId = args.parent_timeline_id || "root";
    if (parentId !== "root" && !project.timelines.some((t) => t.id === parentId)) {
      throw new Error(`Parent timeline not found: ${parentId}`);
    }
    const isChild = parentId !== "root";
    const siblingIndex = project.timelines.filter((t) => t.parent === parentId).length;

    // Detect parent bodypart to determine realistic grip defaults
    const parentTl = project.timelines.find((t) => t.id === parentId);
    const isRightArm =
      args.grip === "right_hand" ||
      ((!args.grip || args.grip === "auto") &&
        parentTl?.model_part_name === "right_arm");
    const isLeftArm =
      args.grip === "left_hand" ||
      ((!args.grip || args.grip === "auto") &&
        parentTl?.model_part_name === "left_arm");

    let defaultPos: [number, number, number] = [0, 0, 0];
    let defaultRot: [number, number, number] = [0, 0, 0];

    if (isRightArm) {
      // Natural sword/tool grip extending forward from Steve's right hand fist
      defaultPos = [1.0, -8.5, 0.5];
      defaultRot = [-85, 15, -35];
    } else if (isLeftArm) {
      // Mirrored grip for left hand
      defaultPos = [-1.0, -8.5, 0.5];
      defaultRot = [-85, -15, 35];
    }

    const pos = args.position || defaultPos;
    const rot = args.rotation || defaultRot;
    const sca = args.scale || [1, 1, 1];

    const isArmGrip = isRightArm || isLeftArm;
    const inheritance = createDefaultInheritanceSettings(isChild);
    if (isArmGrip) {
      inheritance.bend = true; // Follow elbow bend when swinging
      inheritance.rot_point = false; // Rotate around hilt, not shoulder
    }

    const timelineNode: TimelineNode = {
      id: timelineId,
      type: "item",
      name: args.name || args.item_name,
      temp: templateId,
      color_tag: "null",
      hide: false,
      lock: false,
      ghost: false,
      depth: 0,
      default_values: {
        POS_X: pos[0],
        POS_Y: pos[1],
        POS_Z: pos[2],
        ROT_X: rot[0],
        ROT_Y: rot[1],
        ROT_Z: rot[2],
        SCA_X: sca[0],
        SCA_Y: sca[1],
        SCA_Z: sca[2],
      },
      keyframes: {},
      parent: parentId,
      parent_tree_index: siblingIndex,
      lock_bend: true,
      tree_extend: false,
      inherit: inheritance,
      scale_resize: false,
      shadows: true,
      ssao: true,
      fog: true,
      blend_mode: "normal",
    };

    project.templates.push(templateNode);
    project.timelines.push(timelineNode);

    writeProjectFile(filePath, project);

    return {
      success: true,
      timeline_id: timelineId,
      template_id: templateId,
      item_name: args.item_name,
      parent: timelineNode.parent,
    };
  },

  // 8. Add Light
  mineimator_add_light: async (args: {
    project_path: string;
    light_type?: "point" | "spot";
    name?: string;
    position?: [number, number, number];
    color?: string;
    range?: number;
    fade_size?: number;
    spot_cutoff?: number;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    const timelineId = save_id_create();
    const lightType = args.light_type === "spot" ? "spotlight" : "pointlight";
    const pos = args.position || [0, 0, 50];
    const rootIndex = project.timelines.filter((t) => t.parent === "root").length;

    const timelineNode: TimelineNode = {
      id: timelineId,
      type: lightType,
      name: args.name || (lightType === "spotlight" ? "Spot light" : "Point light"),
      temp: "null",
      color_tag: "null",
      hide: false,
      lock: false,
      ghost: false,
      depth: 0,
      default_values: {
        POS_X: pos[0],
        POS_Y: pos[1],
        POS_Z: pos[2],
        LIGHT_COLOR: args.color || "#FFFFFF",
        LIGHT_RANGE: args.range ?? 250,
        LIGHT_FADE_SIZE: args.fade_size ?? 0.5,
        ...(lightType === "spotlight"
          ? {
              LIGHT_SPOT_RADIUS: args.spot_cutoff ?? 30,
              LIGHT_SPOT_SHARPNESS: 0.5,
            }
          : {}),
      },
      keyframes: {},
      parent: "root",
      parent_tree_index: rootIndex,
      lock_bend: true,
      tree_extend: false,
      inherit: createDefaultInheritanceSettings(false),
      scale_resize: true,
    };

    project.timelines.push(timelineNode);
    writeProjectFile(filePath, project);

    return {
      success: true,
      timeline_id: timelineId,
      light_type: lightType,
      position: pos,
    };
  },

  // 9. Add Camera
  mineimator_add_camera: async (args: {
    project_path: string;
    name?: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    target?: [number, number, number];
    look_at?: [number, number, number];
    fov?: number;
    dof?: boolean;
    dof_distance?: number;
    dof_range?: number;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    const timelineId = save_id_create();
    const pos = args.position || [0, -100, 50];
    let rot = args.rotation;
    if (!rot && (args.target || args.look_at)) {
      rot = computeLookAtAngles(pos, (args.target || args.look_at)!);
    }
    if (!rot) {
      rot = [0, 0, 0];
    }
    const rootIndex = project.timelines.filter((t) => t.parent === "root").length;

    const timelineNode: TimelineNode = {
      id: timelineId,
      type: "camera",
      name: args.name || "Cinematic Camera",
      temp: "null",
      color_tag: "null",
      hide: false,
      lock: false,
      ghost: false,
      depth: 0,
      default_values: {
        POS_X: pos[0],
        POS_Y: pos[1],
        POS_Z: pos[2],
        ROT_X: rot[0],
        ROT_Y: rot[1],
        ROT_Z: rot[2],
        CAM_FOV: args.fov ?? 45,
        ...(args.dof
          ? {
              CAM_DOF: true,
              CAM_DOF_DEPTH: args.dof_distance ?? 100,
              CAM_DOF_RANGE: args.dof_range ?? 20,
            }
          : {}),
      },
      keyframes: {},
      parent: "root",
      parent_tree_index: rootIndex,
      lock_bend: true,
      tree_extend: false,
      inherit: createDefaultInheritanceSettings(false),
      scale_resize: true,
    };

    project.timelines.push(timelineNode);
    writeProjectFile(filePath, project);

    return {
      success: true,
      timeline_id: timelineId,
      name: timelineNode.name,
      position: pos,
      rotation: rot,
      fov: args.fov ?? 45,
    };
  },

  // 10. Insert Keyframe
  mineimator_insert_keyframe: async (args: {
    project_path: string;
    timeline_id: string;
    frame: number;
    values: KeyframeValues;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    const timeline = project.timelines.find((t) => t.id === args.timeline_id);
    if (!timeline) {
      throw new Error(`Timeline not found: ${args.timeline_id}`);
    }

    insertKeyframe(timeline, args.frame, args.values);
    writeProjectFile(filePath, project);

    return {
      success: true,
      timeline_id: args.timeline_id,
      frame: Math.round(args.frame),
      values: args.values,
    };
  },

  // 11. Generate Walk Cycle
  mineimator_generate_walk_cycle: async (args: {
    project_path: string;
    character_timeline_id: string;
    start_frame?: number;
    end_frame?: number;
    cycle_length?: number;
    arm_swing_angle?: number;
    leg_swing_angle?: number;
    bob_height?: number;
    forward_travel?: number;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    const res = generateWalkCycle(project.timelines, args);
    writeProjectFile(filePath, project);

    return {
      success: true,
      character_timeline_id: args.character_timeline_id,
      keyframes_added: res.keyframesAdded,
      affected_timelines: res.affectedTimelines,
    };
  },

  // 12. Generate Camera Path
  mineimator_generate_camera_path: async (args: {
    project_path: string;
    camera_timeline_id: string;
    waypoints: CameraWaypoint[];
    smooth?: boolean;
    interpolation?: "smooth" | "linear";
    sample_interval?: number;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    const isSmooth = Boolean(args.smooth || args.interpolation === "smooth");
    const res = generateCameraPath(project.timelines, {
      ...args,
      smooth: isSmooth,
    });
    writeProjectFile(filePath, project);

    return {
      success: true,
      camera_timeline_id: args.camera_timeline_id,
      keyframes_added: res.keyframesAdded,
      waypoints_count: args.waypoints.length,
      smooth: isSmooth,
    };
  },

  // 13. Clear Keyframes
  mineimator_clear_keyframes: async (args: {
    project_path: string;
    timeline_id: string;
    from_frame?: number;
    to_frame?: number;
    recursive?: boolean;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    if (
      args.timeline_id !== "all" &&
      !project.timelines.some((t) => t.id === args.timeline_id)
    ) {
      throw new Error(`Timeline not found: ${args.timeline_id}`);
    }

    const clearedCount = clearKeyframes(
      project.timelines,
      args.timeline_id,
      args.from_frame,
      args.to_frame,
      args.recursive
    );

    writeProjectFile(filePath, project);

    return {
      success: true,
      timeline_id: args.timeline_id,
      cleared_keyframes_count: clearedCount,
    };
  },

  // 14. List Minecraft Assets
  mineimator_list_minecraft_assets: async (args: {
    category?: "characters" | "blocks" | "special_blocks" | "items" | "particles" | "biomes" | "all";
    filter?: string;
    data_dir?: string;
    version?: string;
  }) => {
    return listMinecraftAssets(args);
  },

  // 15. Import Schematic
  mineimator_import_schematic: async (args: {
    project_path: string;
    schematic_path: string;
    name?: string;
    position?: [number, number, number];
    copy_to_project?: boolean;
  }) => {
    const res = importSchematic(args);
    return {
      success: true,
      resource_id: res.resourceId,
      template_id: res.templateId,
      timeline_id: res.timelineId,
      schematic_file: res.schematicFileName,
    };
  },

  // 16. Stage For Launch
  mineimator_stage_for_launch: async (args: {
    project_path: string;
    data_dir?: string;
    mineimator_exe?: string;
    launch_now?: boolean;
    pinned?: boolean;
  }) => {
    return stageProjectForLaunch(args.project_path, {
      dataDir: args.data_dir,
      mineimatorExe: args.mineimator_exe,
      launchNow: args.launch_now ?? true,
      pinned: args.pinned ?? true,
    });
  },

  // 17. Open Via Drop
  mineimator_open_via_drop: async (args: {
    project_path: string;
    timeout_ms?: number;
    data_dir?: string;
  }) => {
    return openViaDrop(args.project_path, args.timeout_ms, args.data_dir);
  },

  // 18. Validate Project
  mineimator_validate_project: async (args: { project_path: string }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const report = validateMiProject(project);
    return {
      project_path: filePath,
      ...report,
    };
  },

  // 19. Export Video
  mineimator_export_video: async (args: {
    project_path: string;
    output_path: string;
    format?: "mp4" | "wmv" | "png_sequence";
    include_audio?: boolean;
    mineimator_exe?: string;
    data_dir?: string;
  }) => {
    return exportVideoAutomation(
      args.project_path,
      args.output_path,
      args.format || "mp4",
      args.include_audio ?? true,
      args.mineimator_exe,
      args.data_dir
    );
  },

  // 20. Capture Viewport
  mineimator_capture_viewport: async (args: {
    output_image_path?: string;
    output_path?: string;
    window_title?: string;
  }) => {
    const targetOut = args.output_image_path || args.output_path || "viewport_preview.png";
    return captureMineimatorViewport(targetOut, args.window_title);
  },

  // 21. Live Reload Project
  mineimator_live_reload: async (args: {
    project_path: string;
    mode?: "auto" | "relaunch" | "drop" | "focus";
    data_dir?: string;
    mineimator_exe?: string;
    capture_after?: boolean;
  }) => {
    return liveReloadAutomation(args.project_path, {
      mode: args.mode,
      dataDir: args.data_dir,
      mineimatorExe: args.mineimator_exe,
      captureAfter: args.capture_after,
    });
  },

  // 22. Solve Inverse Kinematics (IK)
  mineimator_solve_ik: async (args: {
    limb_name: "right_arm" | "left_arm" | "right_leg" | "left_leg";
    target_coords: [number, number, number];
    shoulder_pos?: [number, number, number];
    project_path?: string;
    character_root_id?: string;
    frame?: number;
    pole_vector?: [number, number, number];
    apply_to_project?: boolean;
  }) => {
    if (args.apply_to_project) {
      if (!args.project_path || !args.character_root_id) {
        throw new Error("project_path and character_root_id are required when apply_to_project is true");
      }
      const filePath = resolveProjectPath(args.project_path);
      const project = readProjectFile(filePath);
      const res = applyIKToCharacter(
        project.timelines,
        args.character_root_id,
        args.limb_name,
        args.target_coords,
        {
          frame: args.frame ?? 0,
          poleVector: args.pole_vector,
        }
      );
      writeProjectFile(filePath, project);
      return {
        success: true,
        applied: true,
        project_path: filePath,
        character_root_id: args.character_root_id,
        limb_timeline_id: res.limbTimelineId,
        solution: res.solution,
      };
    }

    const shoulderPos = args.shoulder_pos || [0, 0, 22];
    const solution = solveLimbIK({
      shoulderPos,
      targetPos: args.target_coords,
      limbType: args.limb_name,
      poleVector: args.pole_vector,
    });
    return {
      success: true,
      applied: false,
      solution,
    };
  },

  // 23. Apply Anatomical Pose
  mineimator_apply_pose: async (args: {
    project_path: string;
    character_root_id: string;
    pose_name: string;
    frame?: number;
    transition?: TransitionType;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const res = applyPoseToCharacter(
      project.timelines,
      args.character_root_id,
      args.pose_name,
      args.frame ?? 0,
      args.transition || "easeinoutquad"
    );
    writeProjectFile(filePath, project);
    return {
      success: true,
      project_path: filePath,
      character_root_id: args.character_root_id,
      pose_applied: res.poseName,
      frame: res.frame,
      affected_timelines: res.affectedTimelines,
    };
  },

  // 24. Spawn Procedural Structure
  mineimator_spawn_structure: async (args: {
    project_path: string;
    preset_name: StructurePresetName;
    origin?: [number, number, number];
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const origin = args.origin || [0, 0, 0];
    const res = spawnStructure(project, args.preset_name, origin);
    writeProjectFile(filePath, project);
    return {
      success: true,
      project_path: filePath,
      preset: res.preset,
      blocks_added: res.blocksAdded,
      origin,
      timeline_ids: res.timelineIds,
    };
  },

  // 25. Create Scene Set
  mineimator_create_scene_set: async (args: {
    project_path: string;
    name: string;
    set_id: string;
    origin: [number, number, number];
    structure_preset?: StructurePresetName;
    create_camera?: boolean;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const manifest = createSceneSet(project, {
      name: args.name,
      setId: args.set_id,
      origin: args.origin,
      structurePreset: args.structure_preset,
      createCamera: args.create_camera ?? true,
    });
    writeProjectFile(filePath, project);
    return {
      success: true,
      project_path: filePath,
      set_manifest: manifest,
    };
  },

  // 26. Spawn Particle Emitter
  mineimator_spawn_particle_emitter: async (args: {
    project_path: string;
    emitter_type: ParticleEmitterType;
    position: [number, number, number];
    name?: string;
    start_frame?: number;
    duration_frames?: number;
    spawn_rate?: number;
    particle_color?: string;
    particle_scale?: number;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const res = spawnParticleEmitter(project, {
      name: args.name || `${args.emitter_type}_emitter`,
      type: args.emitter_type,
      position: args.position,
      startFrame: args.start_frame,
      durationFrames: args.duration_frames,
      spawnRate: args.spawn_rate,
      particleColor: args.particle_color,
      particleScale: args.particle_scale,
    });
    writeProjectFile(filePath, project);
    return {
      project_path: filePath,
      ...res,
    };
  },

  // 27. Add Audio Track
  mineimator_add_audio_track: async (args: {
    project_path: string;
    sound_file: string;
    name?: string;
    start_frame?: number;
    volume?: number;
    pitch?: number;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const res = addAudioTrack(project, {
      soundFile: args.sound_file,
      name: args.name,
      startFrame: args.start_frame,
      volume: args.volume,
      pitch: args.pitch,
      projectDir: path.dirname(filePath),
    });
    writeProjectFile(filePath, project);
    return {
      project_path: filePath,
      ...res,
    };
  },

  // 28. Trigger SFX
  mineimator_trigger_sfx: async (args: {
    project_path: string;
    sound_cue: string;
    frame: number;
    volume?: number;
    pitch?: number;
    timeline_id?: string;
    name?: string;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const res = triggerSFX(project, {
      soundCue: args.sound_cue,
      frame: args.frame,
      volume: args.volume,
      pitch: args.pitch,
      timelineId: args.timeline_id,
      name: args.name,
      projectDir: path.dirname(filePath),
    });
    writeProjectFile(filePath, project);
    return {
      project_path: filePath,
      ...res,
    };
  },

  // 29. Create Shot Camera
  mineimator_create_shot_camera: async (args: {
    project_path: string;
    name: string;
    subject_pos: [number, number, number];
    framing?: FramingPreset;
    angle_yaw_deg?: number;
    custom_fov?: number;
    custom_distance?: number;
    look_at_target?: [number, number, number];
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const res = createShotCamera(project, {
      name: args.name,
      subjectPos: args.subject_pos,
      framing: args.framing,
      angleYawDeg: args.angle_yaw_deg,
      customFov: args.custom_fov,
      customDistance: args.custom_distance,
      lookAtTarget: args.look_at_target,
    });
    writeProjectFile(filePath, project);
    return {
      project_path: filePath,
      ...res,
    };
  },

  // 30. Generate Dolly Zoom
  mineimator_generate_dolly_zoom: async (args: {
    project_path: string;
    camera_timeline_id: string;
    subject_pos: [number, number, number];
    start_frame: number;
    end_frame: number;
    start_distance: number;
    end_distance: number;
    start_fov?: number;
    transition?: TransitionType;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const res = generateDollyZoom(project.timelines, {
      cameraTimelineId: args.camera_timeline_id,
      subjectPos: args.subject_pos,
      startFrame: args.start_frame,
      endFrame: args.end_frame,
      startDistance: args.start_distance,
      endDistance: args.end_distance,
      startFov: args.start_fov,
      transition: args.transition,
    });
    writeProjectFile(filePath, project);
    return {
      project_path: filePath,
      camera_timeline_id: args.camera_timeline_id,
      ...res,
    };
  },

  // 31. Add Camera Shake
  mineimator_add_camera_shake: async (args: {
    project_path: string;
    camera_timeline_id: string;
    start_frame: number;
    duration_frames: number;
    magnitude?: number;
    frequency?: number;
    decay?: "exponential" | "linear";
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const res = addCameraShake(project.timelines, {
      cameraTimelineId: args.camera_timeline_id,
      startFrame: args.start_frame,
      durationFrames: args.duration_frames,
      magnitude: args.magnitude,
      frequency: args.frequency,
      decay: args.decay,
    });
    writeProjectFile(filePath, project);
    return {
      project_path: filePath,
      camera_timeline_id: args.camera_timeline_id,
      ...res,
    };
  },

  // 32. Inspect Scene Graph
  mineimator_inspect_scene_graph: async (args: { project_path: string }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const report = inspectSceneGraph(project);
    return {
      project_path: filePath,
      ...report,
    };
  },

  // 33. Check Camera Frustum
  mineimator_check_camera_frustum: async (args: {
    project_path: string;
    camera_timeline_id: string;
    entity_timeline_id: string;
    frame?: number;
    fov?: number;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    const camera = project.timelines.find((t) => t.id === args.camera_timeline_id);
    if (!camera) {
      throw new Error(`Camera timeline not found: ${args.camera_timeline_id}`);
    }
    const entity = project.timelines.find((t) => t.id === args.entity_timeline_id);
    if (!entity) {
      throw new Error(`Entity timeline not found: ${args.entity_timeline_id}`);
    }

    const report = checkEntityVisibility(camera, entity, {
      frame: args.frame,
      fov: args.fov,
    });

    return {
      project_path: filePath,
      camera_id: args.camera_timeline_id,
      ...report,
    };
  },

  // 34. Snap to Ground
  mineimator_snap_to_ground: async (args: {
    project_path: string;
    entity_timeline_id: string;
    surface_z?: number;
    frame?: number;
    apply_snap?: boolean;
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);

    const entity = project.timelines.find((t) => t.id === args.entity_timeline_id);
    if (!entity) {
      throw new Error(`Entity timeline not found: ${args.entity_timeline_id}`);
    }

    const surfaceZ = args.surface_z ?? 0;
    const frame = args.frame ?? 0;
    const res = groundSnapCheck(entity, surfaceZ, frame);

    if (args.apply_snap) {
      insertKeyframe(entity, frame, {
        POS_Z: res.snappedZ,
        TRANSITION: "instant",
      });
      if (frame === 0 && entity.default_values) {
        entity.default_values.POS_Z = res.snappedZ;
      }
      writeProjectFile(filePath, project);
    }

    return {
      project_path: filePath,
      applied: !!args.apply_snap,
      ...res,
    };
  },

  // 35. Render and Inspect Frame
  mineimator_render_and_inspect_frame: async (args: {
    project_path: string;
    frame?: number;
    camera_name?: string;
    window_title?: string;
    output_image_path?: string;
  }) => {
    return renderAndInspectFrame(args.project_path, {
      frame: args.frame,
      cameraName: args.camera_name,
      windowTitle: args.window_title,
      outputImagePath: args.output_image_path,
    });
  },

  // 36. Compile Storyboard
  mineimator_compile_storyboard: async (args: {
    project_path: string;
    shots: StoryboardShot[];
  }) => {
    const filePath = resolveProjectPath(args.project_path);
    const project = readProjectFile(filePath);
    const res = compileStoryboard(project, args.shots);
    writeProjectFile(filePath, project);
    return {
      project_path: filePath,
      ...res,
    };
  },
};
