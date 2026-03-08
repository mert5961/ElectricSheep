import * as THREE from 'three';

export class RendererManager {
  constructor(canvas) {
    this.canvas = canvas;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.debug.checkShaderErrors = true;

    // OrthographicCamera: 1 unit = 1 pixel, origin at top-left
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera = new THREE.OrthographicCamera(0, w, 0, h, -1000, 1000);
    this.camera.position.z = 1;

    this._clock = new THREE.Clock();
    this._frameCallbacks = [];
    this._animationId = null;

    this._handleResize = this._onResize.bind(this);
    window.addEventListener('resize', this._handleResize);
    this._updateSize();
  }

  get time() {
    return this._clock.getElapsedTime();
  }

  onFrame(callback) {
    this._frameCallbacks.push(callback);
  }

  removeFrameCallback(callback) {
    const idx = this._frameCallbacks.indexOf(callback);
    if (idx !== -1) this._frameCallbacks.splice(idx, 1);
  }

  start() {
    if (this._animationId !== null) return;
    this._clock.start();
    this._loop();
  }

  stop() {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  _loop() {
    this._animationId = requestAnimationFrame(() => this._loop());

    const time = this._clock.getElapsedTime();
    for (const cb of this._frameCallbacks) {
      cb(time);
    }

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this._updateSize();
  }

  _updateSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.renderer.setSize(w, h);

    // Update ortho camera to match new viewport (origin top-left, Y points down)
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._handleResize);
    this.renderer.dispose();
  }
}
