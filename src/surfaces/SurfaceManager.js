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
    return this._sortSurfaces();
  }

  get count() {
    return this._surfaces.size;
  }

  get editTarget() {
    return this._editTarget;
  }

  addSurface(options = {}) {
    const surface = new Surface({
      ...options,
      order: this._resolveInitialOrder(options.order),
    });
    surface.build(this._scene, this._overlayEl);
    surface.setEditTarget(this._editTarget);
    surface.setDebugVisible(this._debugVisible);
    this._surfaces.set(surface.id, surface);
    this._normalizeSurfaceOrder();
    this.selectSurface(surface.id);
    return surface;
  }

  removeSurface(id) {
    const surface = this._surfaces.get(id);
    if (!surface) return;
    surface.dispose(this._scene);
    this._surfaces.delete(id);
    this._normalizeSurfaceOrder();
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

  bringToFront(id) {
    return this._moveSurfaceToIndex(id, this.count - 1);
  }

  sendToBack(id) {
    return this._moveSurfaceToIndex(id, 0);
  }

  moveForward(id) {
    const surfaces = this._sortSurfaces();
    const currentIndex = surfaces.findIndex((surface) => surface.id === id);
    if (currentIndex < 0 || currentIndex === surfaces.length - 1) {
      return false;
    }

    [surfaces[currentIndex], surfaces[currentIndex + 1]] = [surfaces[currentIndex + 1], surfaces[currentIndex]];
    this._applySurfaceOrder(surfaces);
    return true;
  }

  moveBackward(id) {
    const surfaces = this._sortSurfaces();
    const currentIndex = surfaces.findIndex((surface) => surface.id === id);
    if (currentIndex <= 0) {
      return false;
    }

    [surfaces[currentIndex], surfaces[currentIndex - 1]] = [surfaces[currentIndex - 1], surfaces[currentIndex]];
    this._applySurfaceOrder(surfaces);
    return true;
  }

  moveToIndex(id, targetIndex) {
    const surfaces = this._sortSurfaces();
    const currentIndex = surfaces.findIndex((surface) => surface.id === id);
    if (currentIndex < 0) {
      return false;
    }

    const [surface] = surfaces.splice(currentIndex, 1);
    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, surfaces.length));
    if (currentIndex === boundedTargetIndex) {
      surfaces.splice(currentIndex, 0, surface);
      return false;
    }

    surfaces.splice(boundedTargetIndex, 0, surface);
    this._applySurfaceOrder(surfaces);
    return true;
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

    this._normalizeSurfaceOrder();
  }

  syncSerialized(surfaceStates) {
    if (!Array.isArray(surfaceStates)) {
      return;
    }

    const nextSurfaceIds = new Set();

    surfaceStates.forEach((surfaceState) => {
      if (!surfaceState?.id) {
        return;
      }

      nextSurfaceIds.add(surfaceState.id);
      const existingSurface = this._surfaces.get(surfaceState.id);
      if (existingSurface) {
        existingSurface.deserialize(surfaceState);
        return;
      }

      this.addSurface(surfaceState);
    });

    Array.from(this._surfaces.keys()).forEach((surfaceId) => {
      if (!nextSurfaceIds.has(surfaceId)) {
        this.removeSurface(surfaceId);
      }
    });

    this._normalizeSurfaceOrder();
  }

  _resolveInitialOrder(order) {
    if (Number.isFinite(order)) {
      return Math.max(0, Math.round(order));
    }

    return this._surfaces.size;
  }

  _sortSurfaces() {
    return Array.from(this._surfaces.values()).sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }

      return a.id.localeCompare(b.id);
    });
  }

  _normalizeSurfaceOrder() {
    this._applySurfaceOrder(this._sortSurfaces());
  }

  _applySurfaceOrder(surfaces) {
    surfaces.forEach((surface, index) => {
      surface.setOrder(index);
    });
  }

  _moveSurfaceToIndex(id, targetIndex) {
    const surfaces = this._sortSurfaces();
    const currentIndex = surfaces.findIndex((surface) => surface.id === id);
    if (currentIndex < 0) {
      return false;
    }

    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, surfaces.length - 1));
    if (currentIndex === boundedTargetIndex) {
      return false;
    }

    const [surface] = surfaces.splice(currentIndex, 1);
    surfaces.splice(boundedTargetIndex, 0, surface);
    this._applySurfaceOrder(surfaces);
    return true;
  }
}
