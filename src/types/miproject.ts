/**
 * Mine-imator 2.0.2 Project Format (Format 34) Type Definitions
 */

export type TransitionType =
  | "linear"
  | "instant"
  | "easeinquad"
  | "easeoutquad"
  | "easeinoutquad"
  | "easeincubic"
  | "easeoutcubic"
  | "easeinoutcubic"
  | "easeinquart"
  | "easeoutquart"
  | "easeinoutquart"
  | "easeinquint"
  | "easeoutquint"
  | "easeinoutquint"
  | "easeinsine"
  | "easeoutsine"
  | "easeinoutsine"
  | "easeinexpo"
  | "easeoutexpo"
  | "easeinoutexpo"
  | "easeincirc"
  | "easeoutcirc"
  | "easeinoutcirc"
  | "easeinelastic"
  | "easeoutelastic"
  | "easeinoutelastic"
  | "easeinback"
  | "easeoutback"
  | "easeinoutback"
  | "easeinbounce"
  | "easeoutbounce"
  | "easeinoutbounce"
  | "bezier";

export interface KeyframeValues {
  POS_X?: number;
  POS_Y?: number;
  POS_Z?: number;
  ROT_X?: number;
  ROT_Y?: number;
  ROT_Z?: number;
  SCA_X?: number;
  SCA_Y?: number;
  SCA_Z?: number;
  BEND_ANGLE_X?: number;
  BEND_ANGLE_Y?: number;
  BEND_ANGLE_Z?: number;
  ALPHA?: number;
  COLOR?: string;
  LIGHT_COLOR?: string;
  LIGHT_STRENGTH?: number;
  LIGHT_SPECULAR_STRENGTH?: number;
  LIGHT_SIZE?: number;
  LIGHT_RANGE?: number;
  LIGHT_FADE_SIZE?: number;
  LIGHT_SPOT_SHARPNESS?: number;
  LIGHT_SPOT_RADIUS?: number;
  CAM_FOV?: number;
  CAM_ROTATE?: boolean;
  CAM_ROTATE_DISTANCE?: number;
  CAM_ROTATE_ANGLE_XY?: number;
  CAM_ROTATE_ANGLE_Z?: number;
  CAM_DOF?: boolean;
  CAM_DOF_DEPTH?: number;
  CAM_DOF_RANGE?: number;
  CAM_DOF_FADE_SIZE?: number;
  CAM_DOF_BLUR_SIZE?: number;
  CAM_BLOOM?: boolean;
  CAM_BLOOM_THRESHOLD?: number;
  CAM_BLOOM_INTENSITY?: number;
  CAM_BLOOM_RADIUS?: number;
  TRANSITION?: TransitionType | string;
  [key: string]: unknown;
}

export interface InheritanceSettings {
  position: boolean;
  rotation: boolean;
  scale: boolean;
  alpha: boolean;
  color: boolean;
  texture: boolean;
  surface?: boolean;
  subsurface?: boolean;
  visibility: boolean;
  bend: boolean;
  rot_point: boolean;
  glow_color: boolean;
  select: boolean;
  pose?: boolean;
}

export interface TimelineNode {
  id: string;
  type: string;
  name: string;
  temp: string;
  color_tag?: string | null;
  hide?: boolean;
  lock?: boolean;
  ghost?: boolean;
  depth?: number;
  model_part_name?: string;
  part_of?: string | null;
  part_root?: string | null;
  parts?: string[];
  block?: {
    name: string;
    state?: Record<string, string>;
  };
  default_values: Record<string, unknown>;
  keyframes: Record<string, KeyframeValues>;
  parent: string;
  parent_tree_index: number;
  lock_bend?: boolean;
  tree_extend?: boolean;
  inherit: InheritanceSettings;
  scale_resize?: boolean;
  rot_point_custom?: boolean;
  rot_point?: [number, number, number];
  backfaces?: boolean;
  texture_blur?: boolean;
  texture_filtering?: boolean;
  shadows?: boolean;
  ssao?: boolean;
  glow?: boolean;
  glow_texture?: boolean;
  only_render_glow?: boolean;
  glint_mode?: number;
  glint_scale?: number;
  glint_speed?: number;
  glint_strength?: number;
  glint_tex?: string;
  fog?: boolean;
  hq_hiding?: boolean;
  lq_hiding?: boolean;
  blend_mode?: string;
  alpha_mode?: number;
  [key: string]: unknown;
}

export interface TemplateNode {
  id: string;
  type: string;
  name: string;
  model_tex?: string;
  model_tex_material?: string;
  model_tex_normal?: string;
  model_use_blend_color?: boolean;
  model_blend_color?: string;
  model?: {
    name: string;
    state?: Record<string, string>;
    model_version?: number;
  };
  item?: {
    name: string;
    slot?: number;
    bounce?: boolean;
    spin?: boolean;
  };
  block?: {
    name?: string;
    state?: Record<string, string>;
    tex?: string;
    repeat_enable?: boolean;
    repeat?: [number, number, number];
  };
  scenery?: string;
  [key: string]: unknown;
}

export interface ResourceNode {
  id: string;
  type: string;
  filename: string;
  scenery_tl_add?: boolean;
  [key: string]: unknown;
}

export interface ProjectSettings {
  name: string;
  author: string;
  description: string;
  video_width: number;
  video_height: number;
  video_keep_aspect_ratio: boolean;
  render_settings: string;
  tempo: number;
  grid_rows?: number;
  grid_columns?: number;
  view_main_camera?: number;
  view_second_camera?: number;
  timeline?: {
    repeat: boolean;
    seamless_repeat: boolean;
    intervals_show?: boolean;
    interval_size?: number;
    interval_offset?: number;
    marker: number;
    list_width: number;
    hor_scroll: number;
    zoom: number;
    region_start: string | null;
    region_end: string | null;
    hide_color_tag?: number[];
  };
  work_camera?: {
    focus: [number, number, number];
    angle_xy: number;
    angle_z: number;
    roll: number;
    zoom: number;
  };
  [key: string]: unknown;
}

export interface RenderSettings {
  render_samples: number;
  render_distance: number;
  render_ssao: boolean;
  render_ssao_radius: number;
  render_ssao_power: number;
  render_ssao_color: string;
  render_shadows: boolean;
  render_shadows_sun_buffer_size: number;
  render_shadows_spot_buffer_size: number;
  render_shadows_point_buffer_size: number;
  render_shadows_transparent: number;
  render_subsurface_samples: number;
  render_subsurface_highlight: number;
  render_subsurface_highlight_strength: number;
  render_indirect: boolean;
  render_indirect_precision: number;
  render_indirect_blur_radius: number;
  render_indirect_strength: number;
  render_reflections: boolean;
  render_reflections_precision: number;
  render_reflections_thickness: number;
  render_reflections_fade_amount: number;
  render_glow: boolean;
  render_glow_radius: number;
  render_glow_intensity: number;
  render_glow_falloff: boolean;
  render_glow_falloff_radius: number;
  render_glow_falloff_intensity: number;
  render_aa: boolean;
  render_aa_power: number;
  bend_style: "blocky" | "curved";
  opaque_leaves: boolean;
  liquid_animation: boolean;
  water_reflections: boolean;
  block_emissive: number;
  block_subsurface: number;
  glint_speed: number;
  glint_strength: number;
  texture_filtering: boolean;
  transparent_block_texture_filtering: boolean;
  texture_filtering_level: number;
  render_alpha_mode: number;
  tonemapper: number;
  exposure: number;
  gamma: number;
  material_maps: boolean;
  [key: string]: unknown;
}

export interface BackgroundSettings {
  image_show: boolean;
  image: string;
  image_type: string;
  image_stretch: boolean;
  image_box_mapped: boolean;
  image_rotation: number;
  sky_sun_tex: string;
  sky_sun_angle: number;
  sky_sun_scale: number;
  sky_moon_tex: string;
  sky_moon_phase: number;
  sky_moon_angle: number;
  sky_moon_scale: number;
  sky_time: number;
  sky_rotation: number;
  sunlight_strength: number;
  sunlight_angle: number;
  twilight: boolean;
  sky_clouds_show: boolean;
  sky_clouds_mode: string;
  sky_clouds_tex: string;
  sky_clouds_speed: number;
  sky_clouds_height: number;
  sky_clouds_size: number;
  sky_clouds_thickness: number;
  sky_clouds_offset: number;
  ground_show: boolean;
  ground_name: string;
  ground_tex: string;
  ground_tex_material: string;
  ground_tex_normal: string;
  biome: string;
  sky_color: string;
  sky_clouds_color: string;
  sunlight_color: string;
  ambient_color: string;
  night_color: string;
  foliage_color: string;
  grass_color: string;
  water_color: string;
  leaves_oak_color: string;
  leaves_spruce_color: string;
  leaves_birch_color: string;
  leaves_jungle_color: string;
  leaves_acacia_color: string;
  leaves_dark_oak_color: string;
  leaves_mangrove_color: string;
  fog_show: boolean;
  fog_sky: boolean;
  fog_color_custom: boolean;
  fog_color: string;
  fog_object_color_custom: boolean;
  fog_object_color: string;
  fog_distance: number;
  fog_size: number;
  fog_height: number;
  wind: boolean;
  wind_speed: number;
  wind_strength: number;
  wind_direction: number;
  wind_directional_speed: number;
  wind_directional_strength: number;
  texture_animation_speed: number;
  [key: string]: unknown;
}

export interface MiProject {
  format: 34;
  created_in: string;
  project: ProjectSettings;
  render: RenderSettings;
  background: BackgroundSettings;
  templates: TemplateNode[];
  timelines: TimelineNode[];
  resources: ResourceNode[];
  [key: string]: unknown;
}
