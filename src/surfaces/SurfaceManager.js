import { Surface } from './Surface.js';

export class SurfaceManager {
  constructor(scene, overlayEl) {
    this._scene = scene;
    this._overlayEl = overlayEl;
    this._surfaces = new Map();
    this._activeSurfaceId = null;
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

  addSurface(options = {}) {
    const surface = new Surface(options);
    surface.build(this._scene, this._overlayEl);
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

  setHandlesVisible(v) {
    for (const surface of this._surfaces.values()) {
      surface.setHandlesVisible(v);
    }
  }

  serializeAll() {
    return this.all.map((s) => s.serialize());
  }
}
