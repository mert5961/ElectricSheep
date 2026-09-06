import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Asset, Character, Generation, ImageQuality, ImageSize, Shot } from "../../shared/types";
import { useStudio } from "./store";

export function App() {
  const { load, loading, project, error, clearError } = useStudio();
  useEffect(() => { void load(); }, [load]);
  if (loading) return <div className="splash"><span className="spinner" /> Loading studio…</div>;
  if (!project) return <CreateProject />;
  return (
    <div className="app-shell">
      <TitleBar />
      {error && <div className="error-banner"><span>{error}</span><button onClick={clearError}>Dismiss</button></div>}
      <div className="workspace"><LeftSidebar /><Viewer /><ShotControls /></div>
    </div>
  );
}

function TitleBar() {
  const project = useStudio((state) => state.project)!;
  const config = useStudio((state) => state.config);
  return <header className="titlebar"><div className="window-drag"><strong>PONYO SHOT STUDIO</strong><span>{project.name}</span></div><div className={`api-state ${config?.hasApiKey ? "online" : "offline"}`}><i />{config?.hasApiKey ? config.model : "API KEY MISSING"}</div></header>;
}

function CreateProject() {
  const create = useStudio((state) => state.createProject);
  const error = useStudio((state) => state.error);
  const [name, setName] = useState("Tuba Ponyo");
  return <main className="create-screen"><div className="create-panel"><div className="wordmark">PSS</div><p className="eyebrow">PONYO SHOT STUDIO</p><h1>Create Project</h1><label>Project Name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void create(name); }} /></label>{error && <p className="inline-error">{error}</p>}<button className="primary" onClick={() => void create(name)}>CREATE</button></div></main>;
}

function LeftSidebar() {
  const project = useStudio((state) => state.project)!;
  const selectedShotId = useStudio((state) => state.selectedShotId);
  const selectShot = useStudio((state) => state.selectShot);
  const createShot = useStudio((state) => state.createShot);
  const deleteShot = useStudio((state) => state.deleteShot);
  const addCharacter = useStudio((state) => state.addCharacter);
  return <aside className="left-panel panel">
    <SectionLabel>PROJECT</SectionLabel><div className="project-name">{project.name}</div><div className="path-note" title={project.rootPath}>{project.rootPath}</div>
    <SectionLabel>CHARACTERS</SectionLabel>
    <div className="character-list">{project.characters.map((character) => <CharacterRow key={character.id} character={character} />)}</div>
    <button className="text-button" onClick={() => { const name = window.prompt("Character name"); if (name) void addCharacter(name); }}>＋ CHARACTER</button>
    <SectionLabel>ASSETS</SectionLabel><div className="asset-summary"><span>Character References</span><b>{project.assets.filter((asset) => asset.type === "CHARACTER_REFERENCE").length}</b></div><div className="asset-summary"><span>Scene References</span><b>{project.assets.filter((asset) => asset.type === "SCENE_REFERENCE").length}</b></div>
    <div className="shots-head"><SectionLabel>SHOTS</SectionLabel><button className="icon-button" title="New shot" onClick={() => void createShot()}>＋</button></div>
    <div className="shot-list">{project.shots.map((shot) => <button key={shot.id} className={`shot-row ${shot.id === selectedShotId ? "active" : ""}`} onClick={() => selectShot(shot.id)}><span>{shot.title}</span>{shot.approvedGenerationId && <i title="Approved generation">★</i>}</button>)}</div>
    {selectedShotId && <button className="danger-text" onClick={() => { const shot = project.shots.find((item) => item.id === selectedShotId); if (shot && window.confirm(`Delete ${shot.title} and all of its generations? Project assets will not be affected.`)) void deleteShot(shot.id); }}>DELETE SHOT</button>}
    <button className="new-shot" onClick={() => void createShot()}>＋ NEW SHOT</button>
  </aside>;
}

function CharacterRow({ character }: { character: Character }) {
  const update = useStudio((state) => state.updateCharacter);
  return <button className="character-row" onDoubleClick={() => { const name = window.prompt("Character name", character.name); if (name) void update(character.id, name, character.description); }}><span className="avatar">{character.name.slice(0, 1).toUpperCase()}</span><span>{character.name}</span></button>;
}

function Viewer() {
  const project = useStudio((state) => state.project)!;
  const shot = useSelectedShot();
  const selectedGenerationId = useStudio((state) => state.selectedGenerationId);
  const selectGeneration = useStudio((state) => state.selectGeneration);
  const urls = useStudio((state) => state.imageUrls);
  const generation = shot?.generations.find((item) => item.id === selectedGenerationId);
  const selectedScenes = project.assets.filter((asset) => shot?.sceneReferenceIds.includes(asset.id));
  return <main className="viewer-column">
    <div className="scene-reference-bar"><span className="micro-label">SCENE REFERENCES</span><div className="mini-strip">{selectedScenes.length ? selectedScenes.map((asset) => <img key={asset.id} src={urls[asset.localPath]} title={asset.filename} />) : <em>No scene references selected</em>}</div></div>
    <ImageViewer generation={generation} url={generation ? urls[generation.localImagePath] : undefined} approved={generation?.id === shot?.approvedGenerationId} />
    <div className="versions-panel"><div className="versions-title"><span>GENERATED VERSIONS</span><small>{shot?.generations.length ?? 0} total</small></div><div className="version-strip">{shot?.generations.map((item) => <VersionTile key={item.id} generation={item} url={urls[item.localImagePath]} selected={item.id === selectedGenerationId} approved={item.id === shot.approvedGenerationId} onClick={() => item.status === "COMPLETED" && selectGeneration(item.id)} />)}{!shot?.generations.length && <div className="empty-versions">Generated versions will appear here.</div>}</div></div>
  </main>;
}

function ImageViewer({ generation, url, approved }: { generation?: Generation; url?: string; approved: boolean }) {
  const [zoom, setZoom] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const scale = zoom === 0 ? 1 : zoom;
  const reset = (value = 0) => { setZoom(value); setPan({ x: 0, y: 0 }); };
  const pointerMove = (event: ReactPointerEvent) => { if (dragging.current) setPan({ x: dragging.current.panX + event.clientX - dragging.current.x, y: dragging.current.panY + event.clientY - dragging.current.y }); };
  return <section className="viewer-stage" onWheel={(event) => { event.preventDefault(); setZoom((current) => Math.min(4, Math.max(0.2, (current || 1) + (event.deltaY < 0 ? 0.1 : -0.1)))); }} onPointerMove={pointerMove} onPointerUp={() => { dragging.current = null; }} onPointerLeave={() => { dragging.current = null; }}>
    <div className="viewer-toolbar"><button onClick={() => reset(0)} className={zoom === 0 ? "active" : ""}>FIT</button><button onClick={() => reset(1)} className={zoom === 1 ? "active" : ""}>100%</button><span className="divider" /><button onClick={() => setZoom((current) => Math.max(0.2, (current || 1) - 0.1))}>−</button><span className="zoom-readout">{zoom === 0 ? "FIT" : `${Math.round(zoom * 100)}%`}</span><button onClick={() => setZoom((current) => Math.min(4, (current || 1) + 0.1))}>＋</button></div>
    {url ? <div className={`image-wrap ${zoom === 0 ? "fit" : "actual"}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragging.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; }}><img src={url} draggable={false} />{approved && <span className="approved-badge">★ APPROVED</span>}</div> : <div className="empty-viewer"><div className="frame-icon" /><strong>{generation?.status === "FAILED" ? "Generation failed" : "No generated image"}</strong><span>{generation?.error || "Build the prompt, select references, and generate a frame."}</span></div>}
  </section>;
}

function VersionTile({ generation, url, selected, approved, onClick }: { generation: Generation; url?: string; selected: boolean; approved: boolean; onClick(): void }) {
  return <button className={`version-tile ${selected ? "selected" : ""} ${generation.status.toLowerCase()}`} onClick={onClick}><div className="version-image">{url ? <img src={url} /> : <span>{generation.status === "FAILED" ? "!" : "…"}</span>}{approved && <i>★</i>}</div><div><b>V{String(generation.version).padStart(3, "0")}</b><small>{generation.status}</small></div></button>;
}

function ShotControls() {
  const project = useStudio((state) => state.project)!;
  const shot = useSelectedShot();
  const patch = useStudio((state) => state.patchShot);
  const save = useStudio((state) => state.saveShot);
  const rebuild = useStudio((state) => state.rebuildPrompt);
  const generating = useStudio((state) => state.generating);
  const selectedGenerationId = useStudio((state) => state.selectedGenerationId);
  const generate = useStudio((state) => state.generate);
  const approve = useStudio((state) => state.approve);
  const [size, setSize] = useState<ImageSize>("1536x1024");
  const [quality, setQuality] = useState<ImageQuality>("high");
  const [useCurrent, setUseCurrent] = useState(false);
  const selectedCount = shot ? shot.characterReferenceIds.length + shot.sceneReferenceIds.length : 0;
  const selectedGeneration = shot?.generations.find((item) => item.id === selectedGenerationId);
  if (!shot) return <aside className="right-panel panel empty-controls"><strong>No shot selected</strong><span>Create a shot to begin.</span></aside>;
  const field = (label: string, key: keyof Shot, rows = 2) => <label className="control-field"><span>{label}</span><textarea rows={rows} value={String(shot[key] ?? "")} onChange={(event) => patch({ [key]: event.target.value })} onBlur={() => void save()} /></label>;
  return <aside className="right-panel panel"><div className="controls-scroll">
    <div className="controls-heading"><div><span className="micro-label">SHOT CONTROLS</span><h2>{shot.title}</h2></div><span className="shot-id">{shot.id}</span></div>
    <label className="control-field"><span>SHOT TITLE</span><input value={shot.title} onChange={(event) => patch({ title: event.target.value })} onBlur={() => void save()} /></label>
    {field("SHOT DESCRIPTION", "description", 3)}{field("SCENE INSTRUCTIONS", "sceneInstructions", 3)}{field("CHARACTER CONTINUITY NOTES", "characterContinuityNotes")}{field("OUTFIT CONTINUITY NOTES", "outfitContinuityNotes")}{field("MOOD", "mood")}{field("COMPOSITION NOTES", "compositionNotes", 3)}
    <ReferenceLibrary />
    <div className="prompt-heading"><span>PROMPT EDITOR</span><button onClick={() => void rebuild()}>↻ REBUILD PROMPT</button></div><textarea className="prompt-editor" value={shot.prompt} onChange={(event) => patch({ prompt: event.target.value })} onBlur={() => void save()} placeholder="Rebuild the prompt from the structured shot fields, then edit it here." />
  </div><div className="generation-controls"><div className="settings-row"><label>SIZE<select value={size} onChange={(event) => setSize(event.target.value as ImageSize)}><option>1536x1024</option><option>1024x1024</option><option>1024x1536</option><option>2048x1152</option><option>2048x2048</option><option>3840x2160</option><option>2160x3840</option><option>auto</option></select></label><label>QUALITY<select value={quality} onChange={(event) => setQuality(event.target.value as ImageQuality)}><option>high</option><option>medium</option><option>low</option><option>auto</option></select></label></div><label className="checkbox-line"><input type="checkbox" checked={useCurrent} disabled={!selectedGeneration} onChange={(event) => setUseCurrent(event.target.checked)} /> Use current generation as additional reference</label><div className="selected-count">{selectedCount} reference image{selectedCount === 1 ? "" : "s"} selected{useCurrent && selectedGeneration ? " + current generation" : ""}</div><div className="action-grid"><button className="generate" disabled={generating || !shot.prompt.trim()} onClick={() => void generate({ size, quality, useCurrentGeneration: false })}>{generating ? "GENERATING…" : "GENERATE"}</button><button disabled={generating || !shot.prompt.trim()} onClick={() => void generate({ size, quality, useCurrentGeneration: useCurrent })}>GENERATE VARIANT</button><button className="approve" disabled={!selectedGeneration || selectedGeneration.status !== "COMPLETED" || selectedGeneration.id === shot.approvedGenerationId} onClick={() => void approve()}>★ APPROVE</button></div></div>
  </aside>;
}

function ReferenceLibrary() {
  const project = useStudio((state) => state.project)!;
  const shot = useSelectedShot()!;
  return <div className="reference-library"><SectionLabel>REFERENCE SELECTION</SectionLabel>{project.characters.map((character) => <AssetGroup key={character.id} label={`${character.name.toUpperCase()} REFERENCES`} assets={project.assets.filter((asset) => asset.type === "CHARACTER_REFERENCE" && asset.characterId === character.id)} selected={shot.characterReferenceIds} kind="character" characterId={character.id} />)}<AssetGroup label="SCENE REFERENCES" assets={project.assets.filter((asset) => asset.type === "SCENE_REFERENCE")} selected={shot.sceneReferenceIds} kind="scene" /></div>;
}

function AssetGroup({ label, assets, selected, kind, characterId }: { label: string; assets: Asset[]; selected: string[]; kind: "character" | "scene"; characterId?: string }) {
  const urls = useStudio((state) => state.imageUrls);
  const toggle = useStudio((state) => state.toggleReference);
  const importAssets = useStudio((state) => state.importAssets);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const importFiles = (files: File[]) => {
    const paths = files.map((file) => window.ponyo.files.getPath(file)).filter(Boolean);
    if (paths.length) void importAssets({ paths, type: kind === "character" ? "CHARACTER_REFERENCE" : "SCENE_REFERENCE", characterId });
  };
  const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); importFiles(Array.from(event.dataTransfer.files)); };
  return <div className={`asset-group ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}><div className="asset-group-head"><span>{label}</span><button onClick={() => inputRef.current?.click()}>＋ IMPORT</button><input ref={inputRef} hidden multiple type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(event) => { importFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></div><div className="asset-grid">{assets.map((asset) => <button key={asset.id} className={selected.includes(asset.id) ? "selected" : ""} title={asset.filename} onClick={() => void toggle(asset.id, kind)}><img src={urls[asset.localPath]} /><span className="check">✓</span></button>)}<button className="drop-cell" onClick={() => inputRef.current?.click()}>DROP<br />IMAGES</button></div></div>;
}

function useSelectedShot(): Shot | undefined {
  const project = useStudio((state) => state.project);
  const id = useStudio((state) => state.selectedShotId);
  return useMemo(() => project?.shots.find((shot) => shot.id === id), [project, id]);
}

function SectionLabel({ children }: { children: ReactNode }) { return <div className="section-label">{children}</div>; }
