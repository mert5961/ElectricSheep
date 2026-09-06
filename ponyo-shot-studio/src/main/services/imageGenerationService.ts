import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Generation, GenerationRequestInput, Project } from "../../shared/types";
import type { ImageProvider } from "../providers/image/ImageProvider";
import { ProjectService } from "./projectService";

export class ImageGenerationService {
  constructor(private readonly projects: ProjectService, private readonly providerFactory: () => ImageProvider) {}

  async generate(input: GenerationRequestInput): Promise<Project> {
    const project = await this.projects.requireCurrent();
    const shot = project.shots.find((item) => item.id === input.shotId);
    if (!shot) throw new Error("Shot not found.");
    if (!shot.prompt.trim()) throw new Error("The final prompt is empty. Rebuild or enter a prompt before generating.");
    const provider = this.providerFactory();
    const selectedAssetIds = [...new Set([...shot.characterReferenceIds, ...shot.sceneReferenceIds])];
    const selectedAssets = selectedAssetIds.map((id) => project.assets.find((asset) => asset.id === id)).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
    const sourceGeneration = input.useCurrentGeneration
      ? shot.generations.find((generation) => generation.id === input.currentGenerationId && generation.status === "COMPLETED")
      : undefined;
    if (input.useCurrentGeneration && !sourceGeneration) throw new Error("Choose a completed current generation to use as a variant reference.");
    const version = shot.generations.reduce((max, generation) => Math.max(max, generation.version), 0) + 1;
    const versionLabel = `v${String(version).padStart(3, "0")}`;
    const generationDirectory = join(project.rootPath, "shots", shot.id, "generations");
    const outputPath = join(generationDirectory, `${versionLabel}.png`);
    await mkdir(generationDirectory, { recursive: true });
    const generation: Generation = {
      id: randomUUID(),
      shotId: shot.id,
      version,
      prompt: shot.prompt,
      referenceAssetIds: selectedAssetIds,
      sourceGenerationId: sourceGeneration?.id,
      model: provider.model,
      localImagePath: outputPath,
      createdAt: new Date().toISOString(),
      status: "GENERATING",
      settings: {
        size: input.size,
        quality: input.quality,
        workflow: selectedAssets.length || sourceGeneration ? "reference-edit" : "generation",
        usedCurrentGeneration: Boolean(sourceGeneration),
      },
    };
    shot.generations.push(generation);
    shot.updatedAt = new Date().toISOString();
    await this.persist(project, shot.id, versionLabel);
    try {
      const result = await provider.generate({
        prompt: generation.prompt,
        referenceImages: [...selectedAssets.map((asset) => asset.localPath), ...(sourceGeneration ? [sourceGeneration.localImagePath] : [])],
        outputPath,
        size: input.size,
        quality: input.quality,
      });
      generation.status = "COMPLETED";
      generation.providerRequestId = result.id;
      generation.localImagePath = result.localPath;
    } catch (error) {
      generation.status = "FAILED";
      generation.error = this.safeError(error);
      await this.persist(project, shot.id, versionLabel);
      throw new Error(generation.error);
    }
    await this.persist(project, shot.id, versionLabel);
    return project;
  }

  private async persist(project: Project, shotId: string, versionLabel: string): Promise<void> {
    const shot = project.shots.find((item) => item.id === shotId)!;
    await this.projects.writeGenerationMetadata(project, shot, versionLabel);
    await this.projects.writeShot(project, shot);
    await this.projects.save(project);
  }

  private safeError(error: unknown): string {
    if (error instanceof Error) return error.message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
    return "Image generation failed for an unknown reason.";
  }
}
