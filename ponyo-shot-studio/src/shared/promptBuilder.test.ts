import { describe, expect, it } from "vitest";
import { buildShotPrompt } from "./promptBuilder";
import type { Project, Shot } from "./types";

describe("buildShotPrompt", () => {
  it("labels selected character and scene references", () => {
    const shot = { id: "s1", title: "Shot 001", description: "On a cliff", characterReferenceIds: ["a1"], sceneReferenceIds: ["a2"], sceneInstructions: "Wind in the hair", characterContinuityNotes: "", outfitContinuityNotes: "", mood: "Hopeful", compositionNotes: "Wide shot", prompt: "", generations: [], createdAt: "now", updatedAt: "now" } satisfies Shot;
    const project = { schemaVersion: 1, id: "p1", name: "Tuba Ponyo", slug: "tuba-ponyo", rootPath: "/tmp", createdAt: "now", updatedAt: "now", characters: [{ id: "c1", name: "Mert" }], assets: [{ id: "a1", type: "CHARACTER_REFERENCE", characterId: "c1", filename: "mert.jpg", localPath: "/tmp/mert.jpg", createdAt: "now" }, { id: "a2", type: "SCENE_REFERENCE", filename: "scene.png", localPath: "/tmp/scene.png", createdAt: "now" }], shots: [shot] } satisfies Project;
    const prompt = buildShotPrompt(project, shot);
    expect(prompt).toContain("Mert: use the 1 selected Mert reference image");
    expect(prompt).toContain("Use the 1 selected scene reference image");
    expect(prompt).toContain("Wind in the hair");
  });
});
