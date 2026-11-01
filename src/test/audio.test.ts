import { describe, it, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  addAudioTrack,
  applyVolumeEnvelope,
  createDuckingEnvelope,
  ensureSoundAssetExists,
  triggerSFX,
  VANILLA_SOUND_FILES,
} from "../core/audio.js";
import { createNewProject } from "../core/project.js";
import { validateMiProject } from "../schema/validation.js";

describe("Audio & Sound Effect Engine", () => {
  after(() => {
    ["temp_audio.miproject", "temp_audio2.miproject", "temp_audio3.miproject", "temp_audio4.miproject"].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });
  it("should add audio track resource and timeline node", () => {
    const { project } = createNewProject({ project_path: "temp_audio.miproject" });
    const res = addAudioTrack(project, {
      soundFile: "custom_bgm.ogg",
      name: "BGM Track",
      startFrame: 0,
      volume: 0.8,
    });

    assert.equal(res.success, true);
    assert.equal(project.resources.length, 1);
    assert.equal(project.resources[0].type, "sound");
    assert.equal(project.resources[0].filename, "custom_bgm.ogg");

    const tl = project.timelines.find((t) => t.id === res.timelineId);
    assert.ok(tl);
    assert.equal(tl.type, "audio");
    assert.equal(tl.keyframes["0"]?.SOUND_VOLUME, 0.8);
  });

  it("should map vanilla sound effect cues and reuse sound resources", () => {
    const { project } = createNewProject({ project_path: "temp_audio2.miproject" });

    // Trigger TNT primed cue
    const res1 = triggerSFX(project, { soundCue: "tnt_primed", frame: 30 });
    assert.equal(res1.success, true);
    assert.equal(project.resources[0].filename, VANILLA_SOUND_FILES.tnt_primed);

    // Trigger again: should reuse same resource
    const res2 = triggerSFX(project, { soundCue: "tnt_primed", frame: 60 });
    assert.equal(res2.resourceId, res1.resourceId);
    assert.equal(project.resources.length, 1);
  });

  it("should apply volume ducking envelopes across keyframes", () => {
    const { project } = createNewProject({ project_path: "temp_audio3.miproject" });
    const track = addAudioTrack(project, { soundFile: "bgm.ogg" });
    const audioTl = project.timelines.find((t) => t.id === track.timelineId)!;

    const duckEnvelope = createDuckingEnvelope(100, 160, 1.0, 0.2, 10);
    const envRes = applyVolumeEnvelope(audioTl, duckEnvelope);

    assert.equal(envRes.keyframesAdded, 4);
    assert.equal(audioTl.keyframes["100"]?.SOUND_VOLUME, 0.2);
    assert.equal(audioTl.keyframes["160"]?.SOUND_VOLUME, 0.2);
  });

  it("should validate project with sound resources and audio timelines", () => {
    const { project } = createNewProject({ project_path: "temp_audio4.miproject" });
    triggerSFX(project, { soundCue: "explode", frame: 90 });
    triggerSFX(project, { soundCue: "sword_slash", frame: 120 });

    const report = validateMiProject(project);
    assert.equal(report.valid, true);
    assert.equal(report.errors.length, 0);
  });

  it("should generate silent WAV buffer and ensure sound asset exists on disk", () => {
    const testDir = "C:/Users/RocKeR/.gemini/antigravity/scratch/mine-imator-mcp/test_audio_dir";
    const testFile = "test_sfx.wav";
    const fullPath = ensureSoundAssetExists(testDir, testFile);

    assert.ok(fs.existsSync(fullPath));
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size >= 44);

    // Clean up
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should reject negative frames in audio track and triggerSFX", () => {
    const { project } = createNewProject({ project_path: "temp_audio5.miproject" });
    assert.throws(
      () => addAudioTrack(project, { soundFile: "test.ogg", startFrame: -10 }),
      /startFrame cannot be negative/
    );

    assert.throws(
      () => triggerSFX(project, { soundCue: "explode", frame: -1 }),
      /frame cannot be negative/
    );

    if (fs.existsSync("temp_audio5.miproject")) fs.unlinkSync("temp_audio5.miproject");
  });
});
