import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { toolHandlers } from "../tools/index.js";
import { withFileLock } from "../core/file_lock.js";
import { createNewProject, readProjectFile, writeProjectFile } from "../core/project.js";
import { buildCharacterHierarchy } from "../core/hierarchy.js";
import { sequenceCameraCuts } from "../core/director.js";
import { inspectRig, setFacialExpression } from "../core/facial.js";
import { analyzeAudioEnvelope, applyLipSyncToCharacter } from "../core/audio_analysis.js";

describe("Argon V2.0 Addendum Features", () => {
  const tempDir = path.join(os.tmpdir(), "mi_addendum_test_" + Date.now());
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  it("1. Async mutex lock and atomic write should prevent concurrent corruption", async () => {
    const projPath = path.join(tempDir, "ConcurrentProj.miproject");
    await toolHandlers.mineimator_create_project({ project_path: projPath, name: "Concurrent Test" });

    // Add a character first to get a valid timeline ID
    const char = await toolHandlers.mineimator_add_character({
      project_path: projPath,
      character_name: "Async Steve",
    });
    const charId = char.root_timeline_id;

    // Spawn 10 parallel tool invocations writing to the same file simultaneously
    const writes = Array.from({ length: 10 }).map((_, i) =>
      toolHandlers.mineimator_insert_keyframe({
        project_path: projPath,
        timeline_id: charId,
        frame: i * 10,
        values: { POS_X: i * 5 },
      })
    );

    const results = await Promise.all(writes);
    assert.equal(results.length, 10);

    // Verify project file is clean and parseable with all keyframes intact
    const proj = readProjectFile(projPath);
    const rootTl = proj.timelines.find((t) => t.id === charId)!;
    assert.ok(rootTl);
    for (let i = 0; i < 10; i++) {
      assert.equal(rootTl.keyframes[String(i * 10)]?.POS_X, i * 5);
    }
  });

  it("2. mineimator_batch_execute should execute multiple mutations in a single cycle", async () => {
    const projPath = path.join(tempDir, "BatchProj.miproject");
    await toolHandlers.mineimator_create_project({
      project_path: projPath,
      name: "Batch Proj",
    });

    const res = await toolHandlers.mineimator_batch_execute({
      project_path: projPath,
      operations: [
        {
          tool: "mineimator_add_character",
          args: { character_name: "Steve Batch" },
        },
        {
          tool: "mineimator_add_block",
          args: { block_name: "gold_block", position: [10, 20, 0] },
        },
        {
          tool: "mineimator_add_light",
          args: { name: "SunLight", position: [0, 0, 50], light_type: "point" },
        },
      ],
    });

    assert.equal(res.success, true);
    assert.equal(res.total_operations, 3);
    assert.equal(res.results.length, 3);

    const proj = readProjectFile(projPath);
    assert.ok(proj.timelines.some((t) => t.name === "Steve Batch"));
    assert.ok(proj.timelines.some((t) => t.name === "gold_block"));
    assert.ok(proj.timelines.some((t) => t.name === "SunLight"));
  });

  it("3. Camera cut sequencing should set VISIBLE true/false with instant transition", () => {
    const projPath = path.join(tempDir, "CutProj.miproject");
    const { project } = createNewProject({ project_path: projPath, name: "Cut Proj" });

    // Add 2 cameras
    project.timelines.push(
      {
        id: "CAM_WIDE_001",
        type: "camera",
        name: "Cam Wide",
        temp: "null",
        default_values: {},
        keyframes: {},
        parent: "root",
        parent_tree_index: 0,
        inherit: {} as any,
      },
      {
        id: "CAM_CLOSE_002",
        type: "camera",
        name: "Cam Close",
        temp: "null",
        default_values: {},
        keyframes: {},
        parent: "root",
        parent_tree_index: 1,
        inherit: {} as any,
      }
    );

    const cutRes = sequenceCameraCuts(project, [
      { cameraId: "CAM_WIDE_001", startFrame: 0, endFrame: 48 },
      { cameraId: "CAM_CLOSE_002", startFrame: 48, endFrame: 96 },
    ]);

    assert.equal(cutRes.success, true);
    assert.equal(cutRes.totalCuts, 2);

    const camWide = project.timelines.find((t) => t.id === "CAM_WIDE_001")!;
    const camClose = project.timelines.find((t) => t.id === "CAM_CLOSE_002")!;

    // At frame 0: Wide is visible, Close is hidden
    assert.equal(camWide.keyframes["0"]?.VISIBLE, true);
    assert.equal(camWide.keyframes["0"]?.TRANSITION, "instant");
    assert.equal(camClose.keyframes["0"]?.VISIBLE, false);
    assert.equal(camClose.keyframes["0"]?.TRANSITION, "instant");

    // At frame 48: Wide is hidden, Close is visible
    assert.equal(camWide.keyframes["48"]?.VISIBLE, false);
    assert.equal(camClose.keyframes["48"]?.VISIBLE, true);
  });

  it("4. inspectRig should detect biped parts and custom facial bones", () => {
    const projPath = path.join(tempDir, "RigProj.miproject");
    const { project } = createNewProject({ project_path: projPath, name: "Rig Proj" });
    const char = buildCharacterHierarchy({ name: "Rig Steve" });
    project.timelines.push(char.rootTimeline, ...char.parts);

    const reportVanilla = inspectRig(project, char.rootTimeline.id);
    assert.equal(reportVanilla.rigType, "vanilla_biped");
    assert.equal(reportVanilla.hasFacialRig, false);

    // Now attach custom facial bones (jaw, eyes, brow)
    project.timelines.push(
      {
        id: "BONE_EYES_01",
        type: "bodypart",
        name: "eyes",
        model_part_name: "eyes",
        part_of: char.rootTimeline.id,
        parent: char.partIds.head!,
        temp: "null",
        default_values: {},
        keyframes: {},
        parent_tree_index: 0,
        inherit: {} as any,
      },
      {
        id: "BONE_JAW_01",
        type: "bodypart",
        name: "jaw",
        model_part_name: "jaw",
        part_of: char.rootTimeline.id,
        parent: char.partIds.head!,
        temp: "null",
        default_values: {},
        keyframes: {},
        parent_tree_index: 1,
        inherit: {} as any,
      }
    );

    const reportFacial = inspectRig(project, char.rootTimeline.id);
    assert.equal(reportFacial.rigType, "advanced_facial");
    assert.equal(reportFacial.hasFacialRig, true);
    assert.equal(reportFacial.faceBones.eyes, "BONE_EYES_01");
    assert.equal(reportFacial.faceBones.jaw, "BONE_JAW_01");
  });

  it("5. setFacialExpression should apply expressions, blinks, and god_mode", () => {
    const projPath = path.join(tempDir, "FaceProj.miproject");
    const { project } = createNewProject({ project_path: projPath, name: "Face Proj" });
    const char = buildCharacterHierarchy({ name: "Expressive Alex" });
    project.timelines.push(char.rootTimeline, ...char.parts);

    // Apply shocked expression at frame 24
    const resShock = setFacialExpression(project.timelines, char.rootTimeline.id, {
      frame: 24,
      expression: "shocked",
      blink: true,
    });
    assert.equal(resShock.success, true);
    assert.equal(resShock.expression, "shocked");

    // Head tilts back in shock
    const head = project.timelines.find((t) => t.id === char.partIds.head)!;
    assert.equal(head.keyframes["24"]?.ROT_X, -14);

    // Apply god_mode at frame 72 with custom crimson color
    const resGod = setFacialExpression(project.timelines, char.rootTimeline.id, {
      frame: 72,
      expression: "god_mode",
      glow_color: "#FF2200",
    });
    assert.equal(resGod.success, true);
    assert.equal(head.keyframes["72"]?.GLOW, true);
    assert.equal(head.keyframes["72"]?.GLOW_COLOR, "#FF2200");
  });

  it("6. analyzeAudioEnvelope should calculate RMS, detect peaks, and generate jaw keyframes", () => {
    // Generate synthetic test WAV with loud pulses
    const sampleRate = 44100;
    const duration = 2.0;
    const numSamples = Math.floor(sampleRate * duration);
    const wavHeaderLen = 44;
    const buf = Buffer.alloc(wavHeaderLen + numSamples * 2);

    buf.write("RIFF", 0);
    buf.writeUInt32LE(buf.length - 8, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); // PCM
    buf.writeUInt16LE(1, 22); // mono
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(numSamples * 2, 40);

    // Generate background audio with prominent burst at sample 22050 (0.5s -> frame 12)
    for (let s = 0; s < numSamples; s++) {
      let sampleVal = Math.sin((s / sampleRate) * 440 * 2 * Math.PI) * 1000;
      if (Math.abs(s - 22050) < 3000) {
        sampleVal = 30000; // Strong impact pulse
      }
      buf.writeInt16LE(Math.round(sampleVal), wavHeaderLen + s * 2);
    }

    const testWavPath = path.join(tempDir, "test_sfx.wav");
    fs.writeFileSync(testWavPath, buf);

    const report = analyzeAudioEnvelope({
      wavPath: testWavPath,
      fps: 24,
      peakThreshold: 0.3,
    });

    assert.equal(report.success, true);
    assert.equal(report.totalFrames >= 40, true);
    assert.ok(report.peakFrames.length >= 1, "Expected at least 1 peak frame detected");
    assert.ok(report.generatedJawKeyframes.length > 0);

    // Test applying to character
    const { project } = createNewProject({
      project_path: path.join(tempDir, "LipSync.miproject"),
    });
    const char = buildCharacterHierarchy({ name: "Singer" });
    project.timelines.push(char.rootTimeline, ...char.parts);

    const lipRes = applyLipSyncToCharacter(project.timelines, char.rootTimeline.id, {
      wavPath: testWavPath,
      fps: 24,
    });
    assert.equal(lipRes.success, true);
    assert.ok(lipRes.keyframesInserted > 0);
  });
});
