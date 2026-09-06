import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import type { Project, Shot, UpdateCharacterInput, UpdateShotInput } from "../../shared/types";
import { isProject } from "../../shared/validation";

interface Preferences { activeProjectId?: string; activeProjectPath?: string }

export class ProjectService {
  private readonly projectsRoot: string;
  private readonly preferencesPath: string;
  private current: Project | null = null;

  constructor(private readonly dataRoot: string) {
    this.projectsRoot = join(dataRoot, "projects");
    this.preferencesPath = join(dataRoot, "preferences.json");
  }

  async initialize(): Promise<void> {
    await mkdir(this.projectsRoot, { recursive: true });
  }

  async getCurrent(): Promise<Project | null> {
    if (this.current) return this.current;
    let preferences: Preferences;
    try {
      preferences = JSON.parse(await readFile(this.preferencesPath, "utf8")) as Preferences;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new Error("Project preferences are malformed. Remove preferences.json or repair the JSON.");
    }
    if (!preferences.activeProjectPath) return null;
    this.current = await this.readProject(preferences.activeProjectPath);
    return this.current;
  }

  async requireCurrent(): Promise<Project> {
    const project = await this.getCurrent();
    if (!project) throw new Error("Create a project first.");
    return project;
  }

  async create(name: string): Promise<Project> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 120) throw new Error("Project name is required and must be shorter than 120 characters.");
    const slugBase = slugify(trimmed) || "untitled-project";
    const rootPath = await this.uniqueProjectPath(slugBase);
    const now = new Date().toISOString();
    const project: Project = {
      schemaVersion: 1,
      id: randomUUID(),
      name: trimmed,
      slug: basename(rootPath),
      rootPath,
      createdAt: now,
      updatedAt: now,
      characters: [
        { id: randomUUID(), name: "Mert" },
        { id: randomUUID(), name: "Tuba" },
      ],
      assets: [],
      shots: [],
    };
    await mkdir(join(rootPath, "assets", "characters"), { recursive: true });
    await Promise.all(project.characters.map((character) => mkdir(join(rootPath, "assets", "characters", slugify(character.name)), { recursive: true })));
    await mkdir(join(rootPath, "assets", "scenes"), { recursive: true });
    await mkdir(join(rootPath, "shots"), { recursive: true });
    this.current = project;
    await this.save(project);
    await this.writeJson(this.preferencesPath, { activeProjectId: project.id, activeProjectPath: rootPath });
    return project;
  }

  async addCharacter(name: string): Promise<Project> {
    const project = await this.requireCurrent();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error("Character name is required.");
    project.characters.push({ id: randomUUID(), name: trimmed });
    await mkdir(join(project.rootPath, "assets", "characters", slugify(trimmed)), { recursive: true });
    return this.save(project);
  }

  async updateCharacter(input: UpdateCharacterInput): Promise<Project> {
    const project = await this.requireCurrent();
    const character = project.characters.find((item) => item.id === input.id);
    if (!character) throw new Error("Character not found.");
    if (!input.name.trim() || input.name.length > 100) throw new Error("Character name is required.");
    character.name = input.name.trim();
    character.description = input.description?.trim();
    return this.save(project);
  }

  async createShot(): Promise<Project> {
    const project = await this.requireCurrent();
    const nextNumber = project.shots.reduce((max, shot) => {
      const match = shot.title.match(/^Shot (\d+)$/i);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0) + 1;
    const now = new Date().toISOString();
    const shot: Shot = {
      id: `shot-${String(nextNumber).padStart(3, "0")}`,
      title: `Shot ${String(nextNumber).padStart(3, "0")}`,
      description: "",
      characterReferenceIds: [],
      sceneReferenceIds: [],
      sceneInstructions: "",
      characterContinuityNotes: "",
      outfitContinuityNotes: "",
      mood: "",
      compositionNotes: "",
      prompt: "",
      generations: [],
      createdAt: now,
      updatedAt: now,
    };
    project.shots.push(shot);
    await mkdir(join(project.rootPath, "shots", shot.id, "generations"), { recursive: true });
    await this.writeShot(project, shot);
    return this.save(project);
  }

  async updateShot(input: UpdateShotInput): Promise<Project> {
    const project = await this.requireCurrent();
    const shot = project.shots.find((item) => item.id === input.id);
    if (!shot) throw new Error("Shot not found.");
    const validAssets = new Set(project.assets.map((asset) => asset.id));
    shot.title = input.title.trim();
    shot.description = input.description;
    shot.characterReferenceIds = [...new Set(input.characterReferenceIds.filter((id) => validAssets.has(id)))];
    shot.sceneReferenceIds = [...new Set(input.sceneReferenceIds.filter((id) => validAssets.has(id)))];
    shot.sceneInstructions = input.sceneInstructions;
    shot.characterContinuityNotes = input.characterContinuityNotes;
    shot.outfitContinuityNotes = input.outfitContinuityNotes;
    shot.mood = input.mood;
    shot.compositionNotes = input.compositionNotes;
    shot.prompt = input.prompt;
    shot.approvedGenerationId = input.approvedGenerationId;
    shot.updatedAt = new Date().toISOString();
    await this.writeShot(project, shot);
    return this.save(project);
  }

  async deleteShot(shotId: string): Promise<Project> {
    const project = await this.requireCurrent();
    const index = project.shots.findIndex((shot) => shot.id === shotId);
    if (index < 0) throw new Error("Shot not found.");
    project.shots.splice(index, 1);
    await rm(join(project.rootPath, "shots", shotId), { recursive: true, force: true });
    return this.save(project);
  }

  async approve(shotId: string, generationId: string): Promise<Project> {
    const project = await this.requireCurrent();
    const shot = project.shots.find((item) => item.id === shotId);
    const generation = shot?.generations.find((item) => item.id === generationId);
    if (!shot || !generation || generation.status !== "COMPLETED") throw new Error("Only a completed generation can be approved.");
    shot.approvedGenerationId = generationId;
    shot.updatedAt = new Date().toISOString();
    await this.writeShot(project, shot);
    return this.save(project);
  }

  async save(project: Project): Promise<Project> {
    project.updatedAt = new Date().toISOString();
    await this.writeJson(join(project.rootPath, "project.json"), project);
    this.current = project;
    return project;
  }

  async writeShot(project: Project, shot: Shot): Promise<void> {
    await this.writeJson(join(project.rootPath, "shots", shot.id, "shot.json"), shot);
  }

  async writeGenerationMetadata(project: Project, shot: Shot, versionLabel: string): Promise<void> {
    const generation = shot.generations.find((item) => `v${String(item.version).padStart(3, "0")}` === versionLabel);
    if (!generation) throw new Error("Generation metadata not found.");
    await this.writeJson(join(project.rootPath, "shots", shot.id, "generations", `${versionLabel}.json`), generation);
  }

  isInsideCurrentProject(path: string): boolean {
    if (!this.current) return false;
    const root = resolve(this.current.rootPath) + sep;
    return resolve(path).startsWith(root);
  }

  private async readProject(rootPath: string): Promise<Project> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(join(rootPath, "project.json"), "utf8"));
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(`Malformed project JSON at ${join(rootPath, "project.json")}.`);
      throw error;
    }
    if (!isProject(parsed)) throw new Error(`Invalid project data at ${join(rootPath, "project.json")}.`);
    parsed.rootPath = rootPath;
    return parsed;
  }

  private async writeJson(path: string, data: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, path);
  }

  private async uniqueProjectPath(slug: string): Promise<string> {
    let suffix = 1;
    let candidate = join(this.projectsRoot, slug);
    while (true) {
      try {
        await readFile(join(candidate, "project.json"));
        suffix += 1;
        candidate = join(this.projectsRoot, `${slug}-${suffix}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return candidate;
        throw error;
      }
    }
  }
}

export function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
