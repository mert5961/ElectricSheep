export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

export type AssetType = "CHARACTER_REFERENCE" | "SCENE_REFERENCE";
export type GenerationStatus = "QUEUED" | "GENERATING" | "COMPLETED" | "FAILED";
export type ImageSize = "auto" | "1024x1024" | "1536x1024" | "1024x1536" | "2048x2048" | "2048x1152" | "3840x2160" | "2160x3840";
export type ImageQuality = "auto" | "low" | "medium" | "high";

export interface Character {
  id: string;
  name: string;
  description?: string;
}

export interface Asset {
  id: string;
  type: AssetType;
  characterId?: string;
  filename: string;
  localPath: string;
  createdAt: string;
}

export interface GenerationSettings {
  size: ImageSize;
  quality: ImageQuality;
  workflow: "generation" | "reference-edit";
  usedCurrentGeneration: boolean;
}

export interface Generation {
  id: string;
  shotId: string;
  version: number;
  prompt: string;
  referenceAssetIds: string[];
  sourceGenerationId?: string;
  model: string;
  localImagePath: string;
  createdAt: string;
  status: GenerationStatus;
  settings: GenerationSettings;
  providerRequestId?: string;
  error?: string;
}

export interface Shot {
  id: string;
  title: string;
  description: string;
  characterReferenceIds: string[];
  sceneReferenceIds: string[];
  sceneInstructions: string;
  characterContinuityNotes: string;
  outfitContinuityNotes: string;
  mood: string;
  compositionNotes: string;
  prompt: string;
  generations: Generation[];
  approvedGenerationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  slug: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
  characters: Character[];
  assets: Asset[];
  shots: Shot[];
}

export interface CreateProjectInput { name: string }
export interface UpdateCharacterInput { id: string; name: string; description?: string }
export interface ImportAssetsInput { paths: string[]; type: AssetType; characterId?: string }
export interface UpdateShotInput extends Omit<Shot, "generations" | "createdAt" | "updatedAt"> {}

export interface GenerationRequestInput {
  shotId: string;
  size: ImageSize;
  quality: ImageQuality;
  useCurrentGeneration: boolean;
  currentGenerationId?: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  referenceImages: string[];
  outputPath: string;
  size?: ImageSize;
  quality?: ImageQuality;
}

export interface ImageGenerationResult {
  id: string;
  localPath: string;
  createdAt: string;
  model: string;
}

export interface PonyoApi {
  project: {
    getCurrent(): Promise<Project | null>;
    create(input: CreateProjectInput): Promise<Project>;
    addCharacter(name: string): Promise<Project>;
    updateCharacter(input: UpdateCharacterInput): Promise<Project>;
  };
  assets: {
    import(input: ImportAssetsInput): Promise<Project>;
    getDataUrl(localPath: string): Promise<string>;
  };
  shots: {
    create(): Promise<Project>;
    update(shot: UpdateShotInput): Promise<Project>;
    delete(shotId: string): Promise<Project>;
    approve(shotId: string, generationId: string): Promise<Project>;
  };
  generation: {
    generate(input: GenerationRequestInput): Promise<Project>;
    getConfig(): Promise<{ model: string; hasApiKey: boolean }>;
  };
  files: { getPath(file: File): string };
}
