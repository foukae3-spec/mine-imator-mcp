/**
 * Types for Minecraft assets loaded from Mine-imator midata packages
 */

export interface MinecraftCharacterState {
  value: string;
  file?: string;
  texture?: string;
  shape_texture?: Record<string, string>;
}

export interface MinecraftCharacterDef {
  name: string;
  file?: string;
  states?: Record<string, MinecraftCharacterState[]>;
  default_state?: string;
  version?: number;
}

export interface MinecraftSpecialBlockDef {
  name: string;
  file?: string;
  states?: Record<string, unknown>;
  default_state?: string;
}

export interface MinecraftBlockDef {
  name: string;
  timeline?: boolean;
  tex?: string;
  states?: Record<string, unknown>;
}

export interface MinecraftAssetCatalog {
  version: string;
  characters: MinecraftCharacterDef[];
  special_blocks: MinecraftSpecialBlockDef[];
  blocks: (string | MinecraftBlockDef)[];
  item_textures: string[];
  particle_textures: string[];
  particles: string[];
  biomes: string[];
}
