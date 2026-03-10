import { Surface } from './Surface.js';
import {
  EDIT_TARGET_CONTENT,
  EDIT_TARGET_SUBTRACT,
  EDIT_TARGET_SURFACE,
} from './SurfaceConstants.js';

export class SurfaceManager {
  constructor(scene, overlayEl) {
    this._scene = scene;
    this._overlayEl = overlayEl;
    this._surfaces = new Map();
    this._activeSurfaceId = null;
    this._debugVisible = true;
    this._editTarget = EDIT_TARGET_SURFACE;
  }

  get activeSurface() {
    return this._activeSurfaceId ? this._surfaces.get(this._activeSurfaceId) : null;
  }

  get all() {
    return Array.from(this._surfaces.values());
  }

  get count() {
    return this._surfaces.size;
  }

  get editTarget() {
    return this._editTarget;
  }

  addSurface(options = {}) {
    const surface = new Surface(options);
    surface.build(this._scene, this._overlayEl);
    surface.setEditTarget(this._editTarget);
    surface.setDebugVisible(this._debugVisible);
    this._surfaces.set(surface.id, surface);
    this.selectSurface(surface.id);
    return surface;
  }

  removeSurface(id) {
    const surface = this._surfaces.get(id);
    if (!surface) return;
    surface.dispose(this._scene);
    this._surfaces.delete(id);
    if (this._activeSurfaceId === id) {
      this._activeSurfaceId = null;
      const remaining = this.all;
      if (remaining.length > 0) {
        this.selectSurface(remaining[remaining.length - 1].id);
      }
    }
  }

  removeActiveSurface() {
    if (this._activeSurfaceId) {
      this.removeSurface(this._activeSurfaceId);
    }
  }

  selectSurface(id) {
    if (this._activeSurfaceId) {
      const prev = this._surfaces.get(this._activeSurfaceId);
      if (prev) prev.setSelected(false);
    }
    this._activeSurfaceId = id;
    const next = this._surfaces.get(id);
    if (next) next.setSelected(true);
  }

  selectByHandle(surfaceId) {
    if (this._surfaces.has(surfaceId)) {
      this.selectSurface(surfaceId);
    }
  }

  getSurface(id) {
    return this._surfaces.get(id) || null;
  }

  updateTime(time) {
    for (const surface of this._surfaces.values()) {
      surface.updateTime(time);
    }
  }

  setEditTarget(target) {
    if (
      target !== EDIT_TARGET_SURFACE &&
      target !== EDIT_TARGET_CONTENT &&
      target !== EDIT_TARGET_SUBTRACT
    ) {
      return;
    }
    this._editTarget = target;
    for (const surface of this._surfaces.values()) {
      surface.setEditTarget(target);
    }
  }

  setDebugVisible(v) {
    this._debugVisible = v;
    for (const surface of this._surfaces.values()) {
      surface.setDebugVisible(v);
    }
  }

  serializeAll() {
    return this.all.map((s) => s.serialize());
  }

  clear() {
    for (const id of Array.from(this._surfaces.keys())) {
      this.removeSurface(id);
    }
  }

  loadSerialized(surfaceStates) {
    this.clear();
    if (!Array.isArray(surfaceStates)) return;

    surfaceStates.forEach((surfaceState) => {
      this.addSurface(surfaceState);
    });
  }
}
