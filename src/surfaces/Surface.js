import * as THREE from 'three';
import { ShaderMaterialFactory } from '../shaders/ShaderMaterialFactory.js';

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

const HANDLE_SIZE = 12;

export class Surface {
  constructor({
    id = null,
    name = null,
    corners = null,
    feather = 0.05,
    color = null,
    visible = true,
    assignedOutputId = null,
  } = {}) {
    surfaceCounter++;
    this.id = id || `surface-${surfaceCounter}`;
    this.name = name || `Surface ${surfaceCounter}`;

    this.corners = corners || Surface.defaultCorners();
    this.feather = Math.min(Math.max(feather, 0.0), 0.25);
    this.color = color || new THREE.Color(
      0.2 + Math.random() * 0.6,
      0.2 + Math.random() * 0.6,
      0.2 + Math.random() * 0.6,
    );
    this.visible = visible;
    this.assignedOutputId = assignedOutputId;
    this.isSelected = false;

    this.mesh = null;
    this._geometry = null;
    this._material = null;
    this._handleElements = [];
    this._overlayEl = null;
  }

  static defaultCorners() {
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

  build(scene, overlayEl) {
    this._overlayEl = overlayEl;

    this._geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(4 * 3);
    this._geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this._geometry.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS.slice(), 2));
    this._geometry.setIndex(new THREE.BufferAttribute(QUAD_INDICES.slice(), 1));

    this._material = ShaderMaterialFactory.createDebugMaterial({
      color: this.color,
      feather: this.feather,
    });

    this.mesh = new THREE.Mesh(this._geometry, this._material);
    this.mesh.visible = this.visible;
    this.mesh.userData.surfaceId = this.id;
    scene.add(this.mesh);

    this._syncPositions();
    this._createHandles();
    return this;
  }

  // --- Public API ---

  updateGeometry(cornerIndex, x, y) {
    this.corners[cornerIndex].x = x;
    this.corners[cornerIndex].y = y;
    this._syncPositions();
    this._syncHandles();
  }

  updateAllCorners(corners) {
    for (let i = 0; i < 4; i++) {
      this.corners[i].x = corners[i].x;
      this.corners[i].y = corners[i].y;
    }
    this._syncPositions();
    this._syncHandles();
  }

  updateFeather(value) {
    this.feather = Math.min(Math.max(value, 0.0), 0.25);
    if (this._material) {
      this._material.uniforms.u_feather.value = this.feather;
    }
  }

  setSelected(selected) {
    this.isSelected = selected;
    this._handleElements.forEach((el) => {
      el.style.borderColor = selected ? '#fff' : 'rgba(255,255,255,0.4)';
      el.style.background = selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)';
    });
  }

  setVisible(v) {
    this.visible = v;
    if (this.mesh) this.mesh.visible = v;
  }

  setHandlesVisible(v) {
    this._handleElements.forEach((el) => {
      el.style.display = v ? 'block' : 'none';
    });
  }

  assignOutput(outputId) {
    this.assignedOutputId = outputId;
  }

  updateTime(time) {
    if (this._material) {
      this._material.uniforms.u_time.value = time;
    }
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      corners: this.corners.map((c) => ({ x: c.x, y: c.y })),
      feather: this.feather,
      color: [this.color.r, this.color.g, this.color.b],
      visible: this.visible,
      assignedOutputId: this.assignedOutputId,
    };
  }

  deserialize(data) {
    this.id = data.id;
    this.name = data.name;
    this.corners = data.corners.map((c) => ({ x: c.x, y: c.y }));
    this.feather = data.feather;
    this.color = new THREE.Color(data.color[0], data.color[1], data.color[2]);
    this.visible = data.visible;
    this.assignedOutputId = data.assignedOutputId;

    if (this._material) {
      this._material.uniforms.u_color.value.copy(this.color);
      this._material.uniforms.u_feather.value = this.feather;
    }
    if (this.mesh) this.mesh.visible = this.visible;
    this._syncPositions();
    this._syncHandles();
    return this;
  }

  dispose(scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
    }
    if (this._geometry) {
      this._geometry.dispose();
      this._geometry = null;
    }
    if (this._material) {
      this._material.dispose();
      this._material = null;
    }
    this._handleElements.forEach((el) => el.remove());
    this._handleElements = [];
    this.mesh = null;
  }

  // --- Internal ---

  _syncPositions() {
    if (!this._geometry) return;
    const pos = this._geometry.attributes.position;
    for (let i = 0; i < 4; i++) {
      pos.setXYZ(i, this.corners[i].x, this.corners[i].y, 0);
    }
    pos.needsUpdate = true;
  }

  _createHandles() {
    if (!this._overlayEl) return;
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div');
      el.className = 'handle';
      el.dataset.surfaceId = this.id;
      el.dataset.cornerIndex = i;
      Object.assign(el.style, {
        position: 'absolute',
        width: `${HANDLE_SIZE}px`,
        height: `${HANDLE_SIZE}px`,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.3)',
        border: '1.5px solid rgba(255,255,255,0.4)',
        transform: 'translate(-50%, -50%)',
        cursor: 'grab',
        zIndex: '10',
        touchAction: 'none',
      });
      this._overlayEl.appendChild(el);
      this._handleElements.push(el);
    }
    this._syncHandles();
  }

  _syncHandles() {
    for (let i = 0; i < 4; i++) {
      const el = this._handleElements[i];
      if (!el) continue;
      el.style.left = `${this.corners[i].x}px`;
      el.style.top = `${this.corners[i].y}px`;
    }
  }
}
