import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, parse } from "node:path";
import type { ImportAssetsInput, Project } from "../../shared/types";
import { assertSupportedImage } from "../../shared/validation";
import { ProjectService, slugify } from "./projectService";

const mimeTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

export class AssetService {
  constructor(private readonly projects: ProjectService) {}

  async import(input: ImportAssetsInput): Promise<Project> {
    const project = await this.projects.requireCurrent();
    if (!input.paths.length || input.paths.length > 100) throw new Error("Choose between 1 and 100 images to import.");
    if (input.type === "CHARACTER_REFERENCE" && !project.characters.some((character) => character.id === input.characterId)) throw new Error("Choose a valid character for these references.");
    for (const sourcePath of input.paths) {
      assertSupportedImage(sourcePath);
      const fileStat = await stat(sourcePath);
      if (!fileStat.isFile()) throw new Error(`${basename(sourcePath)} is not a file.`);
      const destinationDirectory = input.type === "SCENE_REFERENCE"
        ? join(project.rootPath, "assets", "scenes")
        : join(project.rootPath, "assets", "characters", slugify(project.characters.find((item) => item.id === input.characterId)!.name));
      await mkdir(destinationDirectory, { recursive: true });
      const destinationPath = await this.uniquePath(destinationDirectory, basename(sourcePath));
      try {
        await copyFile(sourcePath, destinationPath);
      } catch (error) {
        throw new Error(`Could not copy ${basename(sourcePath)}: ${(error as Error).message}`);
      }
      project.assets.push({
        id: randomUUID(),
        type: input.type,
        characterId: input.type === "CHARACTER_REFERENCE" ? input.characterId : undefined,
        filename: basename(destinationPath),
        localPath: destinationPath,
        createdAt: new Date().toISOString(),
      });
    }
    return this.projects.save(project);
  }

  async getDataUrl(localPath: string): Promise<string> {
    await this.projects.requireCurrent();
    if (!this.projects.isInsideCurrentProject(localPath)) throw new Error("Image path is outside the active project.");
    assertSupportedImage(localPath);
    const bytes = await readFile(localPath);
    const mime = mimeTypes[extname(localPath).toLowerCase()];
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }

  private async uniquePath(directory: string, filename: string): Promise<string> {
    const parsed = parse(filename);
    const safeName = `${slugify(parsed.name) || "image"}${parsed.ext.toLowerCase()}`;
    let candidate = join(directory, safeName);
    let number = 2;
    while (true) {
      try {
        await stat(candidate);
        candidate = join(directory, `${slugify(parsed.name) || "image"}-${number}${parsed.ext.toLowerCase()}`);
        number += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return candidate;
        throw error;
      }
    }
  }
}
