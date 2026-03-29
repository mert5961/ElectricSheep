import * as THREE from 'three';
import { ShaderMaterialFactory } from '../shaders/ShaderMaterialFactory.js';
import {
  createQuadFromUnitBounds,
  cloneQuad,
  solveQuadToQuadMatrix,
  solveScreenToUnitMatrix,
  transformQuad,
} from './QuadTransform.js';
import {
  DEFAULT_SUBTRACT_FEATHER,
  EDIT_TARGET_CONTENT,
  EDIT_TARGET_SUBTRACT,
  EDIT_TARGET_SURFACE,
  MAX_SUBTRACT_FEATHER,
  MAX_SUBTRACT_QUADS,
  MAX_SURFACE_FEATHER,
  SURFACE_RENDER_ORDER_STEP,
} from './SurfaceConstants.js';

let surfaceCounter = 0;

/**
 * Quad vertex layout:
 *   0 ---- 1
 *   |      |
 *   2 ---- 3
 *
 * Index buffer: [0,2,1, 1,2,3]
 * UVs fixed:    (0,1) (1,1) (0,0) (1,0)
 */
const QUAD_INDICES = new Uint16Array([0, 2, 1, 1, 2, 3]);
const QUAD_UVS = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);

const HANDLE_SIZE = 10;

const HANDLE_THEME = {
  surface: {
    accent: '#33ff33',
    background: 'rgba(51, 255, 51, 0.14)',
    border: 'rgba(51, 255, 51, 0.55)',
    transform: 'translate(-50%, -50%)',
    shape: '50%',
    glow: '0 0 10px rgba(51, 255, 51, 0.16)',
  },
  content: {
    accent: '#9bff8f',
    background: 'rgba(155, 255, 143, 0.12)',
    border: 'rgba(155, 255, 143, 0.5)',
    transform: 'translate(-50%, -50%) rotate(45deg)',
    shape: '2px',
    glow: '0 0 10px rgba(155, 255, 143, 0.14)',
  },
  subtract: {
    accent: '#ff6f61',
    background: 'rgba(255, 111, 97, 0.12)',
    border: 'rgba(255, 111, 97, 0.5)',
    transform: 'translate(-50%, -50%)',
    shape: '50%',
    glow: '0 0 10px rgba(255, 111, 97, 0.12)',
  },
};

const OUTLINE_THEME = {
  surface: { color: 0x33ff33 },
  content: { color: 0x9bff8f },
  subtract: { color: 0xff6f61 },
};

const OUTLINE_RENDER_ORDER_OFFSET = {
  surface: 1,
  content: 2,
  subtract: 3,
};

function normalizeColor(color) {
  if (color instanceof THREE.Color) {
    return color.clone();
  }

  if (Array.isArray(color) && color.length === 3) {
    return new THREE.Color(color[0], color[1], color[2]);
  }

  return null;
}

function clampFeather(value, maxFeather) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0.0), maxFeather);
}

function normalizeOrder(order, fallback = 0) {
  if (!Number.isFinite(order)) return fallback;
  return Math.max(0, Math.round(order));
}

function cloneSubtractQuadEntry(subtractQuad) {
  return {
    quad: cloneQuad(subtractQuad.quad),
    feather: subtractQuad.feather,
    visible: subtractQuad.visible,
    order: subtractQuad.order,
  };
}

function createSubtractQuadEntry({
  quad,
  feather = 0.0,
  visible = true,
  order = 0,
} = {}) {
  return {
    quad: cloneQuad(quad),
    feather: clampFeather(feather, MAX_SUBTRACT_FEATHER),
    visible: visible !== false,
    order: normalizeOrder(order),
  };
}

function reindexSubtractQuads(subtractQuads) {
  return subtractQuads
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((subtractQuad, index) => ({
      ...cloneSubtractQuadEntry(subtractQuad),
      order: index,
    }));
}

function normalizeSubtractQuads(subtractQuads) {
  if (!Array.isArray(subtractQuads)) return [];

  return reindexSubtractQuads(
    subtractQuads
      .map((entry, index) => {
        if (Array.isArray(entry)) {
          return createSubtractQuadEntry({
            quad: entry,
            feather: 0.0,
            visible: true,
            order: index,
          });
        }

        if (entry && Array.isArray(entry.quad)) {
          return createSubtractQuadEntry({
            quad: entry.quad,
            feather: entry.feather ?? 0.0,
            visible: entry.visible,
            order: entry.order ?? index,
          });
        }

        return null;
      })
      .filter(Boolean)
      .slice(0, MAX_SUBTRACT_QUADS),
  );
}

function clampSubtractIndex(index, subtractQuads) {
  if (subtractQuads.length === 0) return -1;
  if (!Number.isInteger(index)) return 0;
  return Math.min(Math.max(index, 0), subtractQuads.length - 1);
}

function createUniformMatrixArray() {
  return Array.from({ length: MAX_SUBTRACT_QUADS }, () => new THREE.Matrix3().identity());
}

function createUniformFloatArray() {
  return Array.from({ length: MAX_SUBTRACT_QUADS }, () => 0);
}

export class Surface {
  constructor({
    id = null,
    name = null,
    surfaceQuad = null,
    contentQuad = null,
    subtractQuads = null,
    activeSubtractQuadIndex = null,
    corners = null,
    feather = 0.05,
    order = 0,
    color = null,
    visible = true,
    assignedOutputId = null,
  } = {}) {
    surfaceCounter++;
    this.id = id || `surface-${surfaceCounter}`;
    this.name = name || `Surface ${surfaceCounter}`;

    const initialSurfaceQuad = cloneQuad(surfaceQuad || corners || Surface.defaultSurfaceQuad());
    this.surfaceQuad = initialSurfaceQuad;
    this.contentQuad = cloneQuad(contentQuad || initialSurfaceQuad);
    this.subtractQuads = normalizeSubtractQuads(subtractQuads);
    this._activeSubtractQuadIndex = clampSubtractIndex(activeSubtractQuadIndex, this.subtractQuads);
    this.feather = clampFeather(feather, MAX_SURFACE_FEATHER);
    this.order = normalizeOrder(order);
    this.color = normalizeColor(color) || new THREE.Color(
      0.2 + Math.random() * 0.6,
      0.2 + Math.random() * 0.6,
      0.2 + Math.random() * 0.6,
    );
    this.visible = visible;
    this.assignedOutputId = assignedOutputId;
    this.isSelected = false;

    this.mesh = null;
    this._scene = null;
    this._geometry = null;
    this._material = null;
    this._surfaceOutline = null;
    this._contentOutline = null;
    this._subtractOutlines = [];
    this._overlayEl = null;
    this._debugVisible = true;
    this._editTarget = EDIT_TARGET_SURFACE;
    this._lastValidContentTransform = new THREE.Matrix3().identity();
    this._surfaceHandles = [];
    this._contentHandles = [];
    this._subtractHandles = [];
  }

  static defaultSurfaceQuad() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const hw = 150;
    const hh = 100;
    return [
      { x: cx - hw, y: cy - hh },
      { x: cx + hw, y: cy - hh },
      { x: cx - hw, y: cy + hh },
      { x: cx + hw, y: cy + hh },
    ];
  }

  get subtractQuadCount() {
    return this.subtractQuads.length;
  }

  get activeSubtractQuadIndex() {
    return this._activeSubtractQuadIndex;
  }

  get activeSubtractQuad() {
    return this.activeSubtractQuadEntry?.quad || null;
  }

  get activeSubtractQuadEntry() {
    if (this._activeSubtractQuadIndex < 0) return null;
    return this.subtractQuads[this._activeSubtractQuadIndex] || null;
  }

  get activeSubtractFeather() {
    return this.activeSubtractQuadEntry?.feather ?? 0.0;
  }

  get subtractQuadLimit() {
    return MAX_SUBTRACT_QUADS;
  }

  build(scene, overlayEl) {
    this._scene = scene;
    this._overlayEl = overlayEl;

    this._geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(4 * 3);
    this._geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this._geometry.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS.slice(), 2));
    this._geometry.setIndex(new THREE.BufferAttribute(QUAD_INDICES.slice(), 1));

    const initialContentTransform = solveScreenToUnitMatrix(this.contentQuad);
    if (initialContentTransform) {
      this._lastValidContentTransform.copy(initialContentTransform);
    }

    this._material = ShaderMaterialFactory.createSurfaceMaterial({
      feather: this.feather,
      outputTexture: ShaderMaterialFactory.getBlankOutputTexture(),
      contentTransform: this._lastValidContentTransform,
      subtractTransforms: createUniformMatrixArray(),
      subtractFeathers: createUniformFloatArray(),
      subtractCount: 0,
    });

    this.mesh = new THREE.Mesh(this._geometry, this._material);
    this.mesh.visible = this.visible;
    this.mesh.userData.surfaceId = this.id;
    this._syncRenderOrder();
    scene.add(this.mesh);

    this._surfaceOutline = this._createOutline(OUTLINE_THEME.surface.color);
    this._contentOutline = this._createOutline(OUTLINE_THEME.content.color);
    scene.add(this._surfaceOutline, this._contentOutline);
    this._syncRenderOrder();

    this._syncSurfaceGeometry();
    this._syncContentTransform();
    this._syncSubtractMask();
    this._createFixedHandles();
    this._rebuildSubtractDebugElements();
    this._syncHandles();
    this._syncOutlines();
    this._syncDebugState();
    return this;
  }

  updateQuadCorner(quadType, cornerIndex, x, y, subtractIndex = null) {
    const nextQuad = cloneQuad(this._getQuad(quadType, subtractIndex));
    if (nextQuad.length === 0) return;

    nextQuad[cornerIndex] = { x, y };
    this.updateQuad(quadType, nextQuad, subtractIndex);
  }

  updateQuad(quadType, quad, subtractIndex = null) {
    if (quadType === EDIT_TARGET_SURFACE) {
      const previousSurfaceQuad = cloneQuad(this.surfaceQuad);
      this.surfaceQuad = cloneQuad(quad);

      const surfaceTransform = solveQuadToQuadMatrix(previousSurfaceQuad, this.surfaceQuad);
      if (surfaceTransform) {
        this.contentQuad = transformQuad(surfaceTransform, this.contentQuad);
        this.subtractQuads = this.subtractQuads.map((subtractQuad) => ({
          ...cloneSubtractQuadEntry(subtractQuad),
          quad: transformQuad(surfaceTransform, subtractQuad.quad),
        }));
      }

      this._syncSurfaceGeometry();
    } else if (quadType === EDIT_TARGET_CONTENT) {
      this.contentQuad = cloneQuad(quad);
    } else if (quadType === EDIT_TARGET_SUBTRACT) {
      const targetIndex = clampSubtractIndex(
        subtractIndex ?? this._activeSubtractQuadIndex,
        this.subtractQuads,
      );
      if (targetIndex < 0) return;

      this._activeSubtractQuadIndex = targetIndex;
      this.subtractQuads = this.subtractQuads.map((subtractQuad, index) => (
        index === targetIndex
          ? { ...cloneSubtractQuadEntry(subtractQuad), quad: cloneQuad(quad) }
          : subtractQuad
      ));
    } else {
      return;
    }

    this._syncContentTransform();
    this._syncSubtractMask();
    this._syncHandles();
    this._syncOutlines();
  }

  updateFeather(value) {
    this.feather = clampFeather(value, MAX_SURFACE_FEATHER);
    if (this._material) {
      this._material.uniforms.u_feather.value = this.feather;
    }
  }

  updateSubtractQuad(quad, subtractIndex = null) {
    this.updateQuad(EDIT_TARGET_SUBTRACT, quad, subtractIndex);
  }

  setSubtractQuadFeather(value, subtractIndex = null) {
    const targetIndex = clampSubtractIndex(
      subtractIndex ?? this._activeSubtractQuadIndex,
      this.subtractQuads,
    );
    if (targetIndex < 0) {
      return false;
    }

    this._activeSubtractQuadIndex = targetIndex;
    const feather = clampFeather(value, MAX_SUBTRACT_FEATHER);
    this.subtractQuads = this.subtractQuads.map((subtractQuad, index) => (
      index === targetIndex
        ? { ...cloneSubtractQuadEntry(subtractQuad), feather }
        : subtractQuad
    ));

    this._syncSubtractMask();
    this._syncDebugState();
    return true;
  }

  setOrder(order) {
    this.order = normalizeOrder(order, this.order);
    this._syncRenderOrder();
  }

  addSubtractQuad() {
    if (this.subtractQuads.length >= MAX_SUBTRACT_QUADS) {
      return null;
    }

    this.subtractQuads = [
      ...this.subtractQuads,
      createSubtractQuadEntry({
        quad: createQuadFromUnitBounds(this.surfaceQuad, {
          minX: 0.32,
          maxX: 0.68,
          minY: 0.32,
          maxY: 0.68,
        }),
        feather: DEFAULT_SUBTRACT_FEATHER,
        visible: true,
        order: this.subtractQuads.length,
      }),
    ];
    this.subtractQuads = reindexSubtractQuads(this.subtractQuads);
    this._activeSubtractQuadIndex = this.subtractQuads.length - 1;

    this._rebuildSubtractDebugElements();
    this._syncSubtractMask();
    this._syncHandles();
    this._syncOutlines();
    return this.activeSubtractQuad;
  }

  removeActiveSubtractQuad() {
    if (this._activeSubtractQuadIndex < 0) {
      return false;
    }

    this.subtractQuads = reindexSubtractQuads(
      this.subtractQuads.filter((_, index) => index !== this._activeSubtractQuadIndex),
    );
    this._activeSubtractQuadIndex = clampSubtractIndex(this._activeSubtractQuadIndex, this.subtractQuads);

    this._rebuildSubtractDebugElements();
    this._syncSubtractMask();
    this._syncHandles();
    this._syncOutlines();
    return true;
  }

  cycleSubtractQuad(direction = 1) {
    if (this.subtractQuads.length === 0) {
      return false;
    }

    const offset = direction >= 0 ? 1 : -1;
    const currentIndex = this._activeSubtractQuadIndex < 0 ? 0 : this._activeSubtractQuadIndex;
    this._activeSubtractQuadIndex = (
      currentIndex + offset + this.subtractQuads.length
    ) % this.subtractQuads.length;

    this._syncHandleStyles();
    this._syncDebugState();
    return true;
  }

  selectSubtractQuad(index) {
    const nextIndex = clampSubtractIndex(index, this.subtractQuads);
    if (nextIndex < 0) return false;

    this._activeSubtractQuadIndex = nextIndex;
    this._syncHandleStyles();
    this._syncDebugState();
    return true;
  }

  setSelected(selected) {
    this.isSelected = selected;
    this._syncHandleStyles();
    this._syncDebugState();
  }

  setVisible(v) {
    this.visible = v;
    if (this.mesh) this.mesh.visible = v;
    this._syncHandleStyles();
    this._syncDebugState();
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
    this._syncHandleStyles();
    this._syncDebugState();
  }

  setDebugVisible(visible) {
    this._debugVisible = visible;
    this._syncHandleStyles();
    this._syncDebugState();
  }

  assignOutput(outputId) {
    this.assignedOutputId = outputId;
  }

  setOutputTexture(texture) {
    if (!this._material) return;
    this._material.uniforms.u_outputTexture.value = texture || ShaderMaterialFactory.getBlankOutputTexture();
  }

  updateTime() {
    // Geo Master now composites Shader Master output textures instead of driving per-surface shader time.
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      surfaceQuad: cloneQuad(this.surfaceQuad),
      contentQuad: cloneQuad(this.contentQuad),
      subtractQuads: this.subtractQuads.map((subtractQuad) => cloneSubtractQuadEntry(subtractQuad)),
      activeSubtractQuadIndex: this._activeSubtractQuadIndex,
      feather: this.feather,
      order: this.order,
      color: [this.color.r, this.color.g, this.color.b],
      visible: this.visible,
      assignedOutputId: this.assignedOutputId,
    };
  }

  deserialize(data) {
    this.id = data.id;
    this.name = data.name;
    this.surfaceQuad = cloneQuad(data.surfaceQuad || data.corners || Surface.defaultSurfaceQuad());
    this.contentQuad = cloneQuad(data.contentQuad || data.surfaceQuad || data.corners || this.surfaceQuad);
    this.subtractQuads = normalizeSubtractQuads(data.subtractQuads);
    this._activeSubtractQuadIndex = clampSubtractIndex(data.activeSubtractQuadIndex, this.subtractQuads);
    this.feather = clampFeather(data.feather ?? this.feather, MAX_SURFACE_FEATHER);
    this.order = normalizeOrder(data.order ?? this.order, this.order);
    this.color = normalizeColor(data.color) || this.color;
    this.visible = data.visible ?? this.visible;
    this.assignedOutputId = data.assignedOutputId;

    if (this._material) {
      this._material.uniforms.u_feather.value = this.feather;
    }
    if (this.mesh) this.mesh.visible = this.visible;
    this._syncRenderOrder();

    this._syncSurfaceGeometry();
    this._syncContentTransform();
    this._syncSubtractMask();
    this._rebuildSubtractDebugElements();
    this._syncHandles();
    this._syncOutlines();
    this._syncDebugState();
    return this;
  }

  dispose(scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
    }
    if (this._surfaceOutline) {
      scene.remove(this._surfaceOutline);
      this._surfaceOutline.geometry.dispose();
      this._surfaceOutline.material.dispose();
      this._surfaceOutline = null;
    }
    if (this._contentOutline) {
      scene.remove(this._contentOutline);
      this._contentOutline.geometry.dispose();
      this._contentOutline.material.dispose();
      this._contentOutline = null;
    }
    this._disposeSubtractDebugElements();
    if (this._geometry) {
      this._geometry.dispose();
      this._geometry = null;
    }
    if (this._material) {
      this._material.dispose();
      this._material = null;
    }

    this._surfaceHandles.forEach((handle) => handle.remove());
    this._contentHandles.forEach((handle) => handle.remove());
    this._surfaceHandles = [];
    this._contentHandles = [];
    this.mesh = null;
    this._scene = null;
  }

  _getQuad(quadType, subtractIndex = null) {
    if (quadType === EDIT_TARGET_CONTENT) return this.contentQuad;
    if (quadType === EDIT_TARGET_SURFACE) return this.surfaceQuad;
    if (quadType === EDIT_TARGET_SUBTRACT) {
      const resolvedIndex = clampSubtractIndex(
        subtractIndex ?? this._activeSubtractQuadIndex,
        this.subtractQuads,
      );
      return resolvedIndex < 0 ? [] : this.subtractQuads[resolvedIndex].quad;
    }
    return [];
  }

  _syncRenderOrder() {
    const baseRenderOrder = this.order * SURFACE_RENDER_ORDER_STEP;

    if (this.mesh) {
      this.mesh.renderOrder = baseRenderOrder;
    }

    if (this._surfaceOutline) {
      this._surfaceOutline.renderOrder = baseRenderOrder + OUTLINE_RENDER_ORDER_OFFSET.surface;
    }

    if (this._contentOutline) {
      this._contentOutline.renderOrder = baseRenderOrder + OUTLINE_RENDER_ORDER_OFFSET.content;
    }

    this._subtractOutlines.forEach((outline) => {
      outline.renderOrder = baseRenderOrder + OUTLINE_RENDER_ORDER_OFFSET.subtract;
    });
  }

  _syncSurfaceGeometry() {
    if (!this._geometry) return;
    const positionAttribute = this._geometry.attributes.position;
    for (let i = 0; i < 4; i++) {
      positionAttribute.setXYZ(i, this.surfaceQuad[i].x, this.surfaceQuad[i].y, 0);
    }
    positionAttribute.needsUpdate = true;
  }

  _syncContentTransform() {
    if (!this._material) return;

    const nextTransform = solveScreenToUnitMatrix(this.contentQuad);
    if (nextTransform) {
      this._lastValidContentTransform.copy(nextTransform);
    }

    this._material.uniforms.u_contentTransform.value.copy(this._lastValidContentTransform);
  }

  _syncSubtractMask() {
    if (!this._material) return;

    const subtractTransforms = [];
    let validTransformCount = 0;

    const subtractFeathers = [];

    for (const subtractQuad of this.subtractQuads) {
      if (subtractTransforms.length >= MAX_SUBTRACT_QUADS) break;
      if (subtractQuad.visible === false) continue;

      const transform = solveScreenToUnitMatrix(subtractQuad.quad);
      if (transform) {
        subtractTransforms.push(transform);
        subtractFeathers.push(subtractQuad.feather);
        validTransformCount++;
      }
    }

    while (subtractTransforms.length < MAX_SUBTRACT_QUADS) {
      subtractTransforms.push(new THREE.Matrix3().identity());
      subtractFeathers.push(0);
    }

    this._material.uniforms.u_subtractTransforms.value = subtractTransforms;
    this._material.uniforms.u_subtractFeathers.value = subtractFeathers;
    this._material.uniforms.u_subtractCount.value = validTransformCount;
  }

  _createFixedHandles() {
    if (!this._overlayEl) return;
    this._surfaceHandles = this._createHandleSet(EDIT_TARGET_SURFACE);
    this._contentHandles = this._createHandleSet(EDIT_TARGET_CONTENT);
  }

  _createHandleSet(quadType, subtractIndex = null) {
    const handles = [];
    const theme = HANDLE_THEME[quadType];

    for (let i = 0; i < 4; i++) {
      const handle = document.createElement('div');
      handle.className = 'handle';
      handle.dataset.surfaceId = this.id;
      handle.dataset.quadType = quadType;
      handle.dataset.cornerIndex = i;
      if (subtractIndex !== null) {
        handle.dataset.subtractIndex = subtractIndex;
      }

      Object.assign(handle.style, {
        position: 'absolute',
        width: `${HANDLE_SIZE}px`,
        height: `${HANDLE_SIZE}px`,
        borderRadius: theme.shape,
        background: theme.background,
        border: `1px solid ${theme.border}`,
        boxShadow: `0 0 0 1px rgba(0, 0, 0, 0.45), ${theme.glow}`,
        transform: theme.transform,
        cursor: 'grab',
        zIndex: quadType === EDIT_TARGET_CONTENT ? '12' : '10',
        touchAction: 'none',
      });

      this._overlayEl.appendChild(handle);
      handles.push(handle);
    }

    return handles;
  }

  _rebuildSubtractDebugElements() {
    this._disposeSubtractDebugElements();
    if (!this._overlayEl || !this._scene) return;

    this._subtractHandles = this.subtractQuads.map((_, index) => (
      this._createHandleSet(EDIT_TARGET_SUBTRACT, index)
    ));
    this._subtractOutlines = this.subtractQuads.map(() => {
      const outline = this._createOutline(OUTLINE_THEME.subtract.color);
      this._scene.add(outline);
      return outline;
    });
    this._syncRenderOrder();
  }

  _disposeSubtractDebugElements() {
    this._subtractHandles.flat().forEach((handle) => handle.remove());
    this._subtractHandles = [];

    if (this._scene) {
      this._subtractOutlines.forEach((outline) => {
        this._scene.remove(outline);
        outline.geometry.dispose();
        outline.material.dispose();
      });
    }
    this._subtractOutlines = [];
  }

  _syncHandles() {
    this._syncFixedHandlePositions(this._surfaceHandles, this.surfaceQuad);
    this._syncFixedHandlePositions(this._contentHandles, this.contentQuad);
    this._subtractHandles.forEach((handleSet, index) => {
      this._syncFixedHandlePositions(handleSet, this.subtractQuads[index]?.quad);
    });
    this._syncHandleStyles();
  }

  _syncFixedHandlePositions(handles, quad) {
    if (!quad) return;
    for (let i = 0; i < handles.length; i++) {
      handles[i].style.left = `${quad[i].x}px`;
      handles[i].style.top = `${quad[i].y}px`;
    }
  }

  _syncHandleStyles() {
    const debugEnabled = this._debugVisible && this.visible;
    const fixedHandleSets = [
      { quadType: EDIT_TARGET_SURFACE, handles: this._surfaceHandles },
      { quadType: EDIT_TARGET_CONTENT, handles: this._contentHandles },
    ];

    fixedHandleSets.forEach(({ quadType, handles }) => {
      const theme = HANDLE_THEME[quadType];
      const isActiveTarget = quadType === this._editTarget;
      const opacity = this.isSelected ? '1' : '0.72';
      const display = debugEnabled && isActiveTarget ? 'block' : 'none';

      handles.forEach((handle) => {
        handle.style.display = display;
        handle.style.opacity = opacity;
        handle.style.pointerEvents = display === 'block' ? 'auto' : 'none';
        handle.style.borderColor = this.isSelected ? theme.accent : theme.border;
        handle.style.background = this.isSelected ? `${theme.accent}33` : theme.background;
        handle.style.boxShadow = this.isSelected
          ? `0 0 0 1px rgba(0, 0, 0, 0.52), ${theme.glow}`
          : '0 0 0 1px rgba(0, 0, 0, 0.42)';
      });
    });

    const subtractTargetActive = this._editTarget === EDIT_TARGET_SUBTRACT;
    this._subtractHandles.forEach((handles, index) => {
      const isActiveSubtract = index === this._activeSubtractQuadIndex;
      const isVisibleSubtract = this.subtractQuads[index]?.visible !== false;
      const display = debugEnabled && subtractTargetActive && isActiveSubtract && isVisibleSubtract ? 'block' : 'none';

      handles.forEach((handle) => {
        handle.style.display = display;
        handle.style.opacity = this.isSelected ? '1' : '0.72';
        handle.style.pointerEvents = display === 'block' ? 'auto' : 'none';
        handle.style.borderColor = this.isSelected ? HANDLE_THEME.subtract.accent : HANDLE_THEME.subtract.border;
        handle.style.background = this.isSelected ? `${HANDLE_THEME.subtract.accent}33` : HANDLE_THEME.subtract.background;
        handle.style.boxShadow = this.isSelected
          ? `0 0 0 1px rgba(0, 0, 0, 0.52), ${HANDLE_THEME.subtract.glow}`
          : '0 0 0 1px rgba(0, 0, 0, 0.42)';
      });
    });
  }

  _createOutline(color) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    });

    const outline = new THREE.LineLoop(geometry, material);
    outline.visible = false;
    outline.renderOrder = 20;
    return outline;
  }

  _syncOutlines() {
    this._syncOutlineGeometry(this._surfaceOutline, this.surfaceQuad);
    this._syncOutlineGeometry(this._contentOutline, this.contentQuad);
    this._subtractOutlines.forEach((outline, index) => {
      this._syncOutlineGeometry(outline, this.subtractQuads[index]?.quad);
    });
    this._syncDebugState();
  }

  _syncOutlineGeometry(outline, quad) {
    if (!outline || !quad) return;
    const positions = outline.geometry.attributes.position;
    for (let i = 0; i < 4; i++) {
      positions.setXYZ(i, quad[i].x, quad[i].y, 0);
    }
    positions.needsUpdate = true;
  }

  _syncDebugState() {
    const debugEnabled = this._debugVisible && this.visible && this.isSelected;

    if (this._surfaceOutline) {
      this._surfaceOutline.visible = debugEnabled;
      this._surfaceOutline.material.opacity = this._editTarget === EDIT_TARGET_SURFACE ? 0.95 : 0.35;
    }

    if (this._contentOutline) {
      this._contentOutline.visible = debugEnabled;
      this._contentOutline.material.opacity = this._editTarget === EDIT_TARGET_CONTENT ? 0.95 : 0.55;
    }

    this._subtractOutlines.forEach((outline, index) => {
      outline.visible = debugEnabled && this.subtractQuads[index]?.visible !== false;
      if (this._editTarget === EDIT_TARGET_SUBTRACT) {
        outline.material.opacity = index === this._activeSubtractQuadIndex ? 0.95 : 0.28;
      } else {
        outline.material.opacity = 0.32;
      }
    });
  }
}
