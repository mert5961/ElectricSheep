import type { Project, Shot } from "./types";

export function buildShotPrompt(project: Project, shot: Shot): string {
  const selected = project.assets.filter((asset) => shot.characterReferenceIds.includes(asset.id));
  const subjectLines = project.characters
    .map((character) => {
      const count = selected.filter((asset) => asset.characterId === character.id).length;
      return count ? `- ${character.name}: use the ${count} selected ${character.name} reference image${count === 1 ? "" : "s"} as identity and wardrobe reference.${character.description ? ` ${character.description}` : ""}` : "";
    })
    .filter(Boolean);

  return [
    "SUBJECTS",
    subjectLines.length ? subjectLines.join("\n") : "No character references selected. Follow the written scene description.",
    "",
    "IDENTITY CONTINUITY",
    "Preserve each referenced person's recognizable facial appearance, hairstyle, and visible body proportions. Keep the identities distinct and faithful to their corresponding selected photographs.",
    shot.characterContinuityNotes || "No additional character continuity notes.",
    "",
    "CLOTHING CONTINUITY",
    "Use the clothing visible in each person's selected photographs. Do not arbitrarily redesign clothing unless explicitly requested.",
    shot.outfitContinuityNotes || "No additional outfit continuity notes.",
    "",
    "SCENE",
    shot.description || "Create the scene described by the user instructions below.",
    "",
    "SCENE REFERENCE",
    shot.sceneReferenceIds.length
      ? `Use the ${shot.sceneReferenceIds.length} selected scene reference image${shot.sceneReferenceIds.length === 1 ? "" : "s"} for staging, environment, framing, mood, and composition. Adapt the scene with the referenced people; do not copy or introduce unrelated characters.`
      : "No scene reference image is selected; rely on the written scene and composition notes.",
    "",
    "COMPOSITION",
    shot.compositionNotes || "Use intentional cinematic camera placement and clear subject positioning.",
    "",
    "MOOD",
    shot.mood || "Follow the scene's emotional tone with coherent lighting and atmosphere.",
    "",
    "USER INSTRUCTIONS",
    shot.sceneInstructions || "No additional shot-specific instructions.",
  ].join("\n");
}
