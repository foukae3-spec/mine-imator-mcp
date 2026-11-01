import * as fs from "node:fs";
import * as path from "node:path";
import { MinecraftAssetCatalog } from "../types/assets.js";
import { resolveInstallation } from "./installation.js";

export interface ListAssetsOptions {
  category?: "characters" | "blocks" | "special_blocks" | "items" | "particles" | "biomes" | "all";
  filter?: string;
  dataDir?: string;
  version?: string;
}

export interface AssetQueryResult {
  version: string;
  total_matches: number;
  category: string;
  assets: unknown[];
}

export function loadMinecraftMidata(dataDir?: string, version?: string): MinecraftAssetCatalog {
  const installation = resolveInstallation({ dataDir });
  const baseDir = dataDir || installation.dataDir;

  let targetVersion = version;
  if (!targetVersion) {
    targetVersion = installation.defaultAssetVersion || "1.20.2";
  }

  const midataPath = path.join(baseDir, "Minecraft", `${targetVersion}.midata`);

  if (!fs.existsSync(midataPath)) {
    // Try finding any available .midata in the installation Minecraft directory
    const mcDir = path.join(baseDir, "Minecraft");
    if (fs.existsSync(mcDir)) {
      const candidates = fs.readdirSync(mcDir).filter((f) => f.endsWith(".midata"));
      if (candidates.length > 0) {
        candidates.sort().reverse();
        const fallbackPath = path.join(mcDir, candidates[0]);
        const raw = fs.readFileSync(fallbackPath, "utf-8");
        return JSON.parse(raw) as MinecraftAssetCatalog;
      }
    }

    // Try cross-installation fallback
    const fallbacks = [
      "C:\\Users\\RocKeR\\Mine-imator Vexel Build\\Data\\Minecraft\\26.3.midata",
      "D:\\Mine-imator\\Data\\Minecraft\\1.20.2.midata",
      "D:\\Mine-imator\\Data\\Minecraft\\1.18.midata",
    ];
    for (const fb of fallbacks) {
      if (fs.existsSync(fb)) {
        const raw = fs.readFileSync(fb, "utf-8");
        return JSON.parse(raw) as MinecraftAssetCatalog;
      }
    }

    throw new Error(`Minecraft midata file not found at: ${midataPath}`);
  }

  const raw = fs.readFileSync(midataPath, "utf-8");
  return JSON.parse(raw) as MinecraftAssetCatalog;
}

export function listMinecraftAssets(options: ListAssetsOptions = {}): AssetQueryResult {
  const category = options.category || "all";
  const filter = (options.filter || "").toLowerCase();
  const catalog = loadMinecraftMidata(options.dataDir, options.version);

  const results: unknown[] = [];

  const matchFilter = (str: unknown): boolean => {
    if (!filter) return true;
    if (typeof str !== "string") return false;
    return str.toLowerCase().includes(filter);
  };

  if (category === "characters" || category === "all") {
    if (Array.isArray(catalog.characters)) {
      for (const char of catalog.characters) {
        if (matchFilter(char.name)) {
          results.push({
            type: "character",
            name: char.name,
            default_state: char.default_state,
            states: char.states ? Object.keys(char.states) : [],
          });
        }
      }
    }
  }

  if (category === "special_blocks" || category === "all") {
    if (Array.isArray(catalog.special_blocks)) {
      for (const sb of catalog.special_blocks) {
        if (matchFilter(sb.name)) {
          results.push({
            type: "special_block",
            name: sb.name,
            file: sb.file,
            states: sb.states ? Object.keys(sb.states) : [],
          });
        }
      }
    }
  }

  if (category === "blocks" || category === "all") {
    if (Array.isArray(catalog.blocks)) {
      for (const block of catalog.blocks) {
        const name = typeof block === "string" ? block : block.name;
        if (matchFilter(name)) {
          results.push({
            type: "block",
            name,
            states: typeof block === "object" && block.states ? Object.keys(block.states) : [],
          });
        }
      }
    }
  }

  if (category === "items" || category === "all") {
    if (Array.isArray(catalog.item_textures)) {
      for (const item of catalog.item_textures) {
        if (matchFilter(item)) {
          results.push({
            type: "item",
            name: item.replace(/^item\//, ""),
            texture: item,
          });
        }
      }
    }
  }

  if (category === "particles" || category === "all") {
    if (Array.isArray(catalog.particles)) {
      for (const p of catalog.particles) {
        const name = typeof p === "string" ? p : (p as any)?.name;
        if (typeof name === "string" && matchFilter(name)) {
          results.push({
            type: "particle",
            name,
            texture: typeof p === "object" && p ? (p as any).texture : undefined,
          });
        }
      }
    }
  }

  if (category === "biomes" || category === "all") {
    if (Array.isArray(catalog.biomes)) {
      for (const b of catalog.biomes) {
        const name = typeof b === "string" ? b : (b as any)?.name;
        if (typeof name === "string" && matchFilter(name)) {
          results.push({
            type: "biome",
            name,
          });
        }
      }
    }
  }

  return {
    version: catalog.version || options.version || "1.20.2",
    total_matches: results.length,
    category,
    assets: results.slice(0, 500), // Cap at 500 to keep response compact
  };
}
