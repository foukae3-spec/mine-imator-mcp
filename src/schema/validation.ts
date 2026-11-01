import { is_valid_save_id } from "../core/id.js";
import { MiProject } from "../types/miproject.js";

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    format: number;
    created_in: string;
    templates_count: number;
    timelines_count: number;
    timelines_by_type: Record<string, number>;
    keyframes_count: number;
    resources_count: number;
  };
}

const VALID_TRANSITIONS = new Set([
  "linear",
  "instant",
  "bezier",
  "easeinquad",
  "easeoutquad",
  "easeinoutquad",
  "easeincubic",
  "easeoutcubic",
  "easeinoutcubic",
  "easeinquart",
  "easeoutquart",
  "easeinoutquart",
  "easeinquint",
  "easeoutquint",
  "easeinoutquint",
  "easeinsine",
  "easeoutsine",
  "easeinoutsine",
  "easeinexpo",
  "easeoutexpo",
  "easeinoutexpo",
  "easeincirc",
  "easeoutcirc",
  "easeinoutcirc",
  "easeinelastic",
  "easeoutelastic",
  "easeinoutelastic",
  "easeinback",
  "easeoutback",
  "easeinoutback",
  "easeinbounce",
  "easeoutbounce",
  "easeinoutbounce",
]);

const VALID_RESOURCE_TYPES = new Set([
  "schematic",
  "texture",
  "sound",
  "font",
  "particles",
  "language",
  "model",
  "scenery",
]);

export function validateMiProject(project: unknown): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const stats: ValidationReport["stats"] = {
    format: 0,
    created_in: "unknown",
    templates_count: 0,
    timelines_count: 0,
    timelines_by_type: {},
    keyframes_count: 0,
    resources_count: 0,
  };

  if (typeof project !== "object" || project === null) {
    return {
      valid: false,
      errors: ["Project is not a valid JSON object"],
      warnings: [],
      stats,
    };
  }

  const proj = project as Record<string, unknown>;

  // Format check
  if (typeof proj.format !== "number") {
    errors.push("Missing or invalid 'format' number");
  } else {
    stats.format = proj.format;
    if (proj.format !== 34) {
      warnings.push(
        `Project format is ${proj.format}. Mine-imator 2.0.2 uses format 34.`
      );
    }
  }

  if (typeof proj.created_in === "string") {
    stats.created_in = proj.created_in;
  }

  // ID uniqueness registry
  const seenIds = new Map<string, string>(); // id -> description
  const templateIds = new Set<string>();
  const timelineIds = new Set<string>();
  const resourceIds = new Set<string>();
  const timelineMap = new Map<string, Record<string, unknown>>();

  // Check resources
  if (Array.isArray(proj.resources)) {
    stats.resources_count = proj.resources.length;
    for (const res of proj.resources) {
      if (typeof res?.id !== "string") {
        errors.push("Resource missing 'id' property");
        continue;
      }
      if (!is_valid_save_id(res.id)) {
        errors.push(`Invalid resource ID format: '${res.id}'`);
      }
      if (seenIds.has(res.id)) {
        errors.push(
          `Duplicate ID '${res.id}' found in resource (already defined in ${seenIds.get(res.id)})`
        );
      }
      seenIds.set(res.id, `resource '${res.id}'`);
      resourceIds.add(res.id);

      if (
        typeof res.type === "string" &&
        !VALID_RESOURCE_TYPES.has(res.type.toLowerCase())
      ) {
        warnings.push(`Resource '${res.id}' has unexpected type '${res.type}'`);
      }
    }
  } else {
    errors.push("Missing 'resources' array");
  }

  // Check templates
  if (Array.isArray(proj.templates)) {
    stats.templates_count = proj.templates.length;
    for (const t of proj.templates) {
      if (typeof t?.id !== "string") {
        errors.push("Template missing 'id' property");
        continue;
      }
      if (!is_valid_save_id(t.id)) {
        errors.push(`Invalid template ID format: '${t.id}'`);
      }
      if (seenIds.has(t.id)) {
        errors.push(
          `Duplicate ID '${t.id}' found in template (already defined in ${seenIds.get(t.id)})`
        );
      }
      seenIds.set(t.id, `template '${t.name || t.type || t.id}'`);
      templateIds.add(t.id);

      if (t.type === "scenery" && typeof t.scenery === "string") {
        if (!resourceIds.has(t.scenery)) {
          warnings.push(
            `Scenery template '${t.id}' references nonexistent resource ID '${t.scenery}'`
          );
        }
      }
    }
  } else {
    errors.push("Missing 'templates' array");
  }

  // Check timelines
  if (Array.isArray(proj.timelines)) {
    stats.timelines_count = proj.timelines.length;
    for (const tl of proj.timelines) {
      if (typeof tl?.id !== "string") {
        errors.push("Timeline node missing 'id' property");
        continue;
      }
      if (!is_valid_save_id(tl.id)) {
        errors.push(`Invalid timeline ID format: '${tl.id}'`);
      }
      if (seenIds.has(tl.id)) {
        errors.push(
          `Duplicate ID '${tl.id}' found in timeline (already defined in ${seenIds.get(tl.id)})`
        );
      }
      seenIds.set(tl.id, `timeline '${tl.name || tl.type || tl.id}'`);
      timelineIds.add(tl.id);
      timelineMap.set(tl.id, tl as Record<string, unknown>);

      const type = tl.type || "unknown";
      stats.timelines_by_type[type] = (stats.timelines_by_type[type] || 0) + 1;

      // Check keyframes
      if (tl.keyframes && typeof tl.keyframes === "object") {
        for (const [frameKey, kf] of Object.entries(tl.keyframes)) {
          stats.keyframes_count++;
          const frameNum = parseInt(frameKey, 10);
          if (isNaN(frameNum) || frameNum < 0) {
            errors.push(
              `Timeline '${tl.id}' contains invalid frame index '${frameKey}'`
            );
          }
          if (kf && typeof kf === "object") {
            const trans = (kf as Record<string, unknown>).TRANSITION;
            if (
              typeof trans === "string" &&
              !VALID_TRANSITIONS.has(trans.toLowerCase())
            ) {
              warnings.push(
                `Timeline '${tl.id}' at frame ${frameKey} uses unknown transition '${trans}'`
              );
            }
          }
        }
      }
    }

    // Referential integrity and hierarchy checks
    const reportedCycles = new Set<string>();

    for (const tl of proj.timelines) {
      if (!tl) continue;

      // Check template reference
      if (
        typeof tl.temp === "string" &&
        tl.temp !== "null" &&
        tl.temp !== "" &&
        !templateIds.has(tl.temp)
      ) {
        errors.push(
          `Timeline '${tl.id}' (${tl.type}) references non-existent template '${tl.temp}'`
        );
      }

      // Check self-referential parent
      if (tl.parent === tl.id) {
        errors.push(`Timeline '${tl.id}' has self-referential parent`);
      }

      // Check parent reference existence
      if (
        typeof tl.parent === "string" &&
        tl.parent !== "root" &&
        !timelineIds.has(tl.parent)
      ) {
        errors.push(
          `Timeline '${tl.id}' (${tl.type}) has orphaned parent '${tl.parent}'`
        );
      }

      // Cycle detection in parent hierarchy
      if (
        typeof tl.parent === "string" &&
        tl.parent !== "root" &&
        tl.parent !== tl.id &&
        timelineIds.has(tl.parent)
      ) {
        const chain: string[] = [tl.id];
        const visitedInChain = new Set<string>([tl.id]);
        let curr: unknown = tl.parent;

        while (typeof curr === "string" && curr !== "root") {
          if (visitedInChain.has(curr)) {
            const cycleKey = [...Array.from(visitedInChain).sort()].join(",");
            if (!reportedCycles.has(cycleKey)) {
              reportedCycles.add(cycleKey);
              errors.push(
                `Cycle detected in timeline parent hierarchy: ${[
                  ...chain,
                  curr,
                ].join(" -> ")}`
              );
            }
            break;
          }
          visitedInChain.add(curr);
          chain.push(curr);
          const parentNode = timelineMap.get(curr);
          if (!parentNode) break;
          curr = parentNode.parent;
        }
      }

      // Check self-referential part_of
      if (tl.part_of === tl.id) {
        errors.push(`Timeline '${tl.id}' has self-referential part_of`);
      }

      // Check part_of reference existence
      if (
        typeof tl.part_of === "string" &&
        tl.part_of !== "null" &&
        tl.part_of !== "" &&
        !timelineIds.has(tl.part_of)
      ) {
        errors.push(
          `Timeline '${tl.id}' (${tl.type}) has invalid part_of reference '${tl.part_of}'`
        );
      }

      // Check parts array
      if (Array.isArray(tl.parts)) {
        for (const partId of tl.parts) {
          if (!timelineIds.has(partId)) {
            errors.push(
              `Timeline '${tl.id}' (${tl.name || tl.type}) lists missing child part '${partId}'`
            );
          }
        }
      }
    }
  } else {
    errors.push("Missing 'timelines' array");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}
