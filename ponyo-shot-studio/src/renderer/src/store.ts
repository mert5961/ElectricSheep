import { create } from "zustand";
import { buildShotPrompt } from "../../shared/promptBuilder";
import type { GenerationRequestInput, ImportAssetsInput, Project, Shot, UpdateShotInput } from "../../shared/types";

type ShotPatch = Partial<Pick<Shot, "title" | "description" | "characterReferenceIds" | "sceneReferenceIds" | "sceneInstructions" | "characterContinuityNotes" | "outfitContinuityNotes" | "mood" | "compositionNotes" | "prompt">>;

interface StudioState {
  project: Project | null;
  selectedShotId: string | null;
  selectedGenerationId: string | null;
  imageUrls: Record<string, string>;
  loading: boolean;
  generating: boolean;
  error: string | null;
  config: { model: string; hasApiKey: boolean } | null;
  load(): Promise<void>;
  createProject(name: string): Promise<void>;
  selectShot(id: string): void;
  selectGeneration(id: string): void;
  createShot(): Promise<void>;
  deleteShot(id: string): Promise<void>;
  patchShot(patch: ShotPatch): void;
  saveShot(): Promise<void>;
  toggleReference(id: string, kind: "character" | "scene"): Promise<void>;
  importAssets(input: ImportAssetsInput): Promise<void>;
  rebuildPrompt(): Promise<void>;
  generate(input: Omit<GenerationRequestInput, "shotId" | "currentGenerationId">): Promise<void>;
  approve(): Promise<void>;
  addCharacter(name: string): Promise<void>;
  updateCharacter(id: string, name: string, description?: string): Promise<void>;
  clearError(): void;
}

function toUpdate(shot: Shot): UpdateShotInput {
  const { generations: _generations, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = shot;
  return input;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "An unknown error occurred.";
  return message.replace(/^Error invoking remote method '[^']+': Error: /, "");
}

export const useStudio = create<StudioState>((set, get) => {
  const applyProject = async (project: Project, preferredShotId?: string, preferredGenerationId?: string) => {
    const currentShotId = preferredShotId ?? get().selectedShotId;
    const shot = project.shots.find((item) => item.id === currentShotId) ?? project.shots[0] ?? null;
    const completed = shot?.generations.filter((item) => item.status === "COMPLETED") ?? [];
    const generation = completed.find((item) => item.id === (preferredGenerationId ?? get().selectedGenerationId))
      ?? completed.find((item) => item.id === shot?.approvedGenerationId)
      ?? completed.at(-1)
      ?? null;
    set({ project, selectedShotId: shot?.id ?? null, selectedGenerationId: generation?.id ?? null });
    const paths = [...project.assets.map((asset) => asset.localPath), ...project.shots.flatMap((item) => item.generations.filter((generation) => generation.status === "COMPLETED").map((generation) => generation.localImagePath))];
    const missing = [...new Set(paths)].filter((path) => !get().imageUrls[path]);
    const entries = await Promise.all(missing.map(async (path) => {
      try { return [path, await window.ponyo.assets.getDataUrl(path)] as const; }
      catch { return null; }
    }));
    if (entries.some(Boolean)) set((state) => ({ imageUrls: { ...state.imageUrls, ...Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))) } }));
  };

  const run = async (operation: () => Promise<void>) => {
    set({ error: null });
    try { await operation(); }
    catch (error) { set({ error: errorMessage(error) }); }
  };

  return {
    project: null,
    selectedShotId: null,
    selectedGenerationId: null,
    imageUrls: {},
    loading: true,
    generating: false,
    error: null,
    config: null,
    load: async () => {
      set({ loading: true });
      await run(async () => {
        const [project, config] = await Promise.all([window.ponyo.project.getCurrent(), window.ponyo.generation.getConfig()]);
        set({ config });
        if (project) await applyProject(project);
      });
      set({ loading: false });
    },
    createProject: async (name) => run(async () => applyProject(await window.ponyo.project.create({ name }))),
    selectShot: (id) => {
      const shot = get().project?.shots.find((item) => item.id === id);
      const selected = shot?.generations.find((item) => item.id === shot.approvedGenerationId) ?? shot?.generations.filter((item) => item.status === "COMPLETED").at(-1);
      set({ selectedShotId: id, selectedGenerationId: selected?.id ?? null });
    },
    selectGeneration: (id) => set({ selectedGenerationId: id }),
    createShot: async () => run(async () => {
      const project = await window.ponyo.shots.create();
      await applyProject(project, project.shots.at(-1)?.id);
    }),
    deleteShot: async (id) => run(async () => applyProject(await window.ponyo.shots.delete(id))),
    patchShot: (patch) => set((state) => state.project ? ({ project: { ...state.project, shots: state.project.shots.map((shot) => shot.id === state.selectedShotId ? { ...shot, ...patch } : shot) } }) : state),
    saveShot: async () => run(async () => {
      const shot = get().project?.shots.find((item) => item.id === get().selectedShotId);
      if (shot) await applyProject(await window.ponyo.shots.update(toUpdate(shot)), shot.id, get().selectedGenerationId ?? undefined);
    }),
    toggleReference: async (id, kind) => {
      const shot = get().project?.shots.find((item) => item.id === get().selectedShotId);
      if (!shot) return;
      const field = kind === "character" ? "characterReferenceIds" : "sceneReferenceIds";
      const current = shot[field];
      get().patchShot({ [field]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id] });
      await get().saveShot();
    },
    importAssets: async (input) => run(async () => applyProject(await window.ponyo.assets.import(input), get().selectedShotId ?? undefined)),
    rebuildPrompt: async () => {
      const project = get().project;
      const shot = project?.shots.find((item) => item.id === get().selectedShotId);
      if (!project || !shot) return;
      const rebuilt = buildShotPrompt(project, shot);
      if (shot.prompt.trim() && shot.prompt !== rebuilt && !window.confirm("Replace the manually edited prompt with a rebuilt prompt?")) return;
      get().patchShot({ prompt: rebuilt });
      await get().saveShot();
    },
    generate: async (input) => {
      if (get().generating) return;
      set({ generating: true, error: null });
      try {
        await get().saveShot();
        const shotId = get().selectedShotId;
        if (!shotId) throw new Error("Create and select a shot first.");
        const project = await window.ponyo.generation.generate({ ...input, shotId, currentGenerationId: input.useCurrentGeneration ? get().selectedGenerationId ?? undefined : undefined });
        const newest = project.shots.find((shot) => shot.id === shotId)?.generations.at(-1);
        await applyProject(project, shotId, newest?.status === "COMPLETED" ? newest.id : undefined);
      } catch (error) {
        set({ error: errorMessage(error) });
        try { const project = await window.ponyo.project.getCurrent(); if (project) await applyProject(project); } catch { /* preserve the generation error */ }
      } finally { set({ generating: false }); }
    },
    approve: async () => run(async () => {
      const { selectedShotId, selectedGenerationId } = get();
      if (!selectedShotId || !selectedGenerationId) throw new Error("Select a completed generation to approve.");
      await applyProject(await window.ponyo.shots.approve(selectedShotId, selectedGenerationId), selectedShotId, selectedGenerationId);
    }),
    addCharacter: async (name) => run(async () => applyProject(await window.ponyo.project.addCharacter(name))),
    updateCharacter: async (id, name, description) => run(async () => applyProject(await window.ponyo.project.updateCharacter({ id, name, description }))),
    clearError: () => set({ error: null }),
  };
});
