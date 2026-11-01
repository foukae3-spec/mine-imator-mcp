import {
  TemplateNode,
  TimelineNode,
} from "../types/miproject.js";
import { createDefaultInheritanceSettings } from "./defaults.js";
import { save_id_create } from "./id.js";

export interface AddCharacterOptions {
  name: string;
  model_name?: string;
  variant?: string;
  type?: "wide" | "slim";
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export interface CreatedCharacterResult {
  template: TemplateNode;
  rootTimeline: TimelineNode;
  parts: TimelineNode[];
  partIds: {
    root: string;
    body?: string;
    head?: string;
    hat?: string;
    right_arm?: string;
    left_arm?: string;
    right_leg?: string;
    left_leg?: string;
  };
}

export function buildCharacterHierarchy(
  options: AddCharacterOptions,
  parentTreeIndex: number = 0
): CreatedCharacterResult {
  const modelName = options.model_name || "human";
  const variant = options.variant || "steve";
  const armType = options.type || "wide";

  const templateId = save_id_create();
  const rootId = save_id_create();

  const template: TemplateNode = {
    id: templateId,
    type: "char",
    name: "",
    model_tex: "default",
    model_tex_material: "default",
    model_tex_normal: "default",
    model_use_blend_color: false,
    model_blend_color: "#FFFFFF",
    model: {
      name: modelName,
      state: {
        variant,
        type: armType,
      },
      model_version: 1,
    },
  };

  const pos = options.position || [0, 0, 0];
  const rot = options.rotation || [0, 0, 0];

  const rootTimeline: TimelineNode = {
    id: rootId,
    type: "char",
    name: options.name || "Character",
    temp: templateId,
    color_tag: "null",
    hide: false,
    lock: false,
    ghost: false,
    depth: 0,
    parts: [],
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
    parent_tree_index: parentTreeIndex,
    lock_bend: true,
    tree_extend: true,
    inherit: createDefaultInheritanceSettings(false),
    scale_resize: true,
    rot_point_custom: false,
    rot_point: [0, 0, 0],
    backfaces: false,
    texture_blur: false,
    texture_filtering: false,
    shadows: true,
    ssao: true,
    glow: false,
    glow_texture: true,
    only_render_glow: false,
    glint_mode: 0,
    glint_scale: 1,
    glint_speed: 1,
    glint_strength: 1,
    glint_tex: "default",
    fog: true,
    hq_hiding: false,
    lq_hiding: false,
    blend_mode: "normal",
    alpha_mode: 2,
  };

  // Check if biped model (human, zombie, skeleton, player, villager, piglin, etc.)
  const isBiped = [
    "human",
    "player",
    "steve",
    "alex",
    "zombie",
    "skeleton",
    "drowned",
    "husk",
    "stray",
    "wither_skeleton",
    "piglin",
    "zombified_piglin",
    "piglin_brute",
    "villager",
    "zombie_villager",
    "pillager",
    "witch",
    "evoker",
    "vindicator",
    "illusioner",
    "wandering_trader",
  ].includes(modelName.toLowerCase());

  const parts: TimelineNode[] = [];
  const partMap: CreatedCharacterResult["partIds"] = { root: rootId };

  if (isBiped) {
    const hatId = save_id_create();
    const headId = save_id_create();
    const rightArmId = save_id_create();
    const leftArmId = save_id_create();
    const bodyId = save_id_create();
    const rightLegId = save_id_create();
    const leftLegId = save_id_create();

    partMap.body = bodyId;
    partMap.head = headId;
    partMap.hat = hatId;
    partMap.right_arm = rightArmId;
    partMap.left_arm = leftArmId;
    partMap.right_leg = rightLegId;
    partMap.left_leg = leftLegId;

    // Root parts array order matching Mine-imator convention:
    rootTimeline.parts = [
      hatId,
      headId,
      rightArmId,
      leftArmId,
      bodyId,
      rightLegId,
      leftLegId,
    ];

    const createPartNode = (
      id: string,
      partName: string,
      parentId: string,
      treeIndex: number,
      treeExtend: boolean = false
    ): TimelineNode => ({
      id,
      type: "bodypart",
      name: "",
      temp: templateId,
      color_tag: "null",
      hide: false,
      lock: false,
      ghost: false,
      depth: 0,
      model_part_name: partName,
      part_of: rootId,
      default_values: {},
      keyframes: {},
      parent: parentId,
      parent_tree_index: treeIndex,
      lock_bend: true,
      tree_extend: treeExtend,
      inherit: createDefaultInheritanceSettings(true),
      scale_resize: false,
      rot_point_custom: false,
      rot_point: [0, 0, 0],
      backfaces: false,
      texture_blur: false,
      texture_filtering: false,
      shadows: true,
      ssao: true,
      glow: false,
      glow_texture: true,
      only_render_glow: false,
      glint_mode: 0,
      glint_scale: 1,
      glint_speed: 1,
      glint_strength: 1,
      glint_tex: "default",
      fog: true,
      hq_hiding: false,
      lq_hiding: false,
      blend_mode: "normal",
      alpha_mode: 2,
    });

    parts.push(createPartNode(hatId, "hat", headId, 0, false));
    parts.push(createPartNode(headId, "head", bodyId, 0, false));
    parts.push(createPartNode(rightArmId, "right_arm", bodyId, 1, false));
    parts.push(createPartNode(leftArmId, "left_arm", bodyId, 2, false));
    parts.push(createPartNode(bodyId, "body", rootId, 0, true));
    parts.push(createPartNode(rightLegId, "right_leg", rootId, 1, false));
    parts.push(createPartNode(leftLegId, "left_leg", rootId, 2, false));
  }

  return {
    template,
    rootTimeline,
    parts,
    partIds: partMap,
  };
}
