import { ipcMain } from "electron";
import type { ImportAssetsInput, UpdateCharacterInput, UpdateShotInput } from "../../shared/types";
import { assertAssetType, assertText, validateGenerationInput, validateShotInput } from "../../shared/validation";
import { AssetService } from "../services/assetService";
import { ImageGenerationService } from "../services/imageGenerationService";
import { ProjectService } from "../services/projectService";

function register<TArgs extends unknown[], TResult>(channel: string, handler: (...args: TArgs) => Promise<TResult>): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]") : "Unknown application error.";
      console.error(`[Ponyo Shot Studio] ${channel}: ${message}`);
      throw new Error(message);
    }
  });
}

export function registerHandlers(projects: ProjectService, assets: AssetService, generations: ImageGenerationService, getConfig: () => { model: string; hasApiKey: boolean }): void {
  register("project:get-current", () => projects.getCurrent());
  register("project:create", async (input: { name?: unknown }) => {
    assertText(input?.name, "Project name", 120);
    return projects.create(input.name);
  });
  register("project:add-character", async (name: unknown) => {
    assertText(name, "Character name", 100);
    return projects.addCharacter(name);
  });
  register("project:update-character", async (input: UpdateCharacterInput) => {
    assertText(input?.id, "Character ID", 200);
    assertText(input?.name, "Character name", 100);
    if (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 2_000)) throw new Error("Invalid character description.");
    return projects.updateCharacter(input);
  });
  register("asset:import", async (input: ImportAssetsInput) => {
    assertAssetType(input?.type);
    if (!Array.isArray(input.paths) || input.paths.some((path) => typeof path !== "string" || !path)) throw new Error("Invalid image paths.");
    if (input.characterId !== undefined && typeof input.characterId !== "string") throw new Error("Invalid character ID.");
    return assets.import(input);
  });
  register("asset:data-url", async (path: unknown) => {
    assertText(path, "Image path", 4_000);
    return assets.getDataUrl(path);
  });
  register("shot:create", () => projects.createShot());
  register("shot:update", async (input: UpdateShotInput) => {
    validateShotInput(input);
    return projects.updateShot(input);
  });
  register("shot:delete", async (shotId: unknown) => {
    assertText(shotId, "Shot ID", 200);
    return projects.deleteShot(shotId);
  });
  register("shot:approve", async (shotId: unknown, generationId: unknown) => {
    assertText(shotId, "Shot ID", 200);
    assertText(generationId, "Generation ID", 200);
    return projects.approve(shotId, generationId);
  });
  register("generation:generate", async (input: unknown) => {
    validateGenerationInput(input);
    return generations.generate(input);
  });
  register("generation:config", async () => getConfig());
}
