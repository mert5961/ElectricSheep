import { extname } from "node:path";
import type { AssetType, GenerationRequestInput, ImageQuality, ImageSize, Shot, UpdateShotInput } from "./types";
import { IMAGE_EXTENSIONS } from "./types";

const sizes: ImageSize[] = ["auto", "1024x1024", "1536x1024", "1024x1536", "2048x2048", "2048x1152", "3840x2160", "2160x3840"];
const qualities: ImageQuality[] = ["auto", "low", "medium", "high"];

export function assertText(value: unknown, label: string, max = 20_000): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} is required and must be shorter than ${max} characters.`);
}

export function assertAssetType(value: unknown): asserts value is AssetType {
  if (value !== "CHARACTER_REFERENCE" && value !== "SCENE_REFERENCE") throw new Error("Invalid asset type.");
}

export function assertSupportedImage(path: string): void {
  if (!IMAGE_EXTENSIONS.includes(extname(path).toLowerCase() as (typeof IMAGE_EXTENSIONS)[number])) {
    throw new Error(`Unsupported image format: ${extname(path) || "unknown"}. Use PNG, JPG, JPEG, or WEBP.`);
  }
}

export function validateShotInput(value: unknown): asserts value is UpdateShotInput {
  if (!value || typeof value !== "object") throw new Error("Invalid shot payload.");
  const shot = value as Partial<Shot>;
  assertText(shot.id, "Shot ID", 200);
  assertText(shot.title, "Shot title", 300);
  const fields = ["description", "sceneInstructions", "characterContinuityNotes", "outfitContinuityNotes", "mood", "compositionNotes", "prompt"] as const;
  for (const field of fields) if (typeof shot[field] !== "string" || shot[field]!.length > 20_000) throw new Error(`Invalid ${field}.`);
  if (!Array.isArray(shot.characterReferenceIds) || !Array.isArray(shot.sceneReferenceIds)) throw new Error("Invalid reference selection.");
}

export function validateGenerationInput(value: unknown): asserts value is GenerationRequestInput {
  if (!value || typeof value !== "object") throw new Error("Invalid generation request.");
  const input = value as Partial<GenerationRequestInput>;
  assertText(input.shotId, "Shot ID", 200);
  if (!sizes.includes(input.size as ImageSize)) throw new Error("Unsupported image size.");
  if (!qualities.includes(input.quality as ImageQuality)) throw new Error("Unsupported image quality.");
  if (typeof input.useCurrentGeneration !== "boolean") throw new Error("Invalid variant option.");
  if (input.currentGenerationId !== undefined && typeof input.currentGenerationId !== "string") throw new Error("Invalid source generation.");
}

export function isProject(value: unknown): value is import("./types").Project {
  const item = value as Partial<import("./types").Project> | null;
  return Boolean(item && item.schemaVersion === 1 && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.characters) && Array.isArray(item.assets) && Array.isArray(item.shots));
}
