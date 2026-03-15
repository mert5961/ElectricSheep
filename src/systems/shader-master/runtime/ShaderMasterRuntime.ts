import * as THREE from 'three';
import type { ShaderMasterStore } from '../store/shaderMasterStore.ts';
import { resolveMappedAudioUniforms } from './resolveMappedAudioUniforms.ts';
import { renderSurfaceOutput } from './renderSurfaceOutput.ts';
import { ShaderCache } from './shaderCache.ts';

export class ShaderMasterRuntime {
  private readonly renderer: THREE.WebGLRenderer;

  private readonly store: ShaderMasterStore;

  private readonly scene: THREE.Scene;

  private readonly camera: THREE.OrthographicCamera;

  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;

  private readonly shaderCache: ShaderCache;

  private readonly renderTargets = new Map<string, THREE.WebGLRenderTarget>();

  private readonly drawingBufferSize = new THREE.Vector2();

  private lastRenderTime: number | null = null;

  constructor({
    renderer,
    store,
  }: {
    renderer: THREE.WebGLRenderer;
    store: ShaderMasterStore;
  }) {
    this.renderer = renderer;
    this.store = store;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.shaderCache = new ShaderCache();

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  render(time: number): void {
    const deltaTimeMs = this.lastRenderTime === null
      ? 0
      : Math.max(0, (time - this.lastRenderTime) * 1000);
    this.lastRenderTime = time;

    this.store.getState().advanceVisualStateTransition(deltaTimeMs);

    const state = this.store.getState();
    this.renderer.getDrawingBufferSize(this.drawingBufferSize);

    state.setRuntimeUniforms({
      u_time: time,
      u_resolution: [this.drawingBufferSize.x, this.drawingBufferSize.y],
    });

    const latestState = this.store.getState();
    const mappedAudioUniforms = resolveMappedAudioUniforms(
      latestState.audioUniforms,
      latestState.audioVisualMapping,
    );
    const assignedOutputIds = new Set(
      Object.values(latestState.surfaceAssignments)
        .filter((outputId): outputId is string => Boolean(outputId)),
    );

    this.cleanupUnusedTargets(assignedOutputIds);

    assignedOutputIds.forEach((outputId) => {
      const output = latestState.outputs[outputId];
      const preset = output ? latestState.presetRegistry[output.presetId] : null;
      if (!output || !preset || !output.enabled) {
        return;
      }

      const target = this.ensureRenderTarget(outputId);
      renderSurfaceOutput({
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        mesh: this.mesh,
        shaderCache: this.shaderCache,
        preset,
        output,
        target,
        runtimeUniforms: latestState.runtimeUniforms,
        audioUniforms: mappedAudioUniforms,
        feelingUniforms: latestState.feelingUniforms,
      });
    });
  }

  getOutputTexture(outputId: string | null): THREE.Texture | null {
    if (!outputId) {
      return null;
    }

    const state = this.store.getState();
    const output = state.outputs[outputId];
    if (!output || !output.enabled) {
      return null;
    }

    return this.renderTargets.get(outputId)?.texture || null;
  }

  dispose(): void {
    this.shaderCache.dispose();
    this.renderTargets.forEach((target) => target.dispose());
    this.renderTargets.clear();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  private ensureRenderTarget(outputId: string): THREE.WebGLRenderTarget {
    const existingTarget = this.renderTargets.get(outputId);
    const width = Math.max(1, Math.floor(this.drawingBufferSize.x));
    const height = Math.max(1, Math.floor(this.drawingBufferSize.y));

    if (existingTarget) {
      if (existingTarget.width !== width || existingTarget.height !== height) {
        existingTarget.setSize(width, height);
      }

      return existingTarget;
    }

    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    renderTarget.texture.generateMipmaps = false;
    this.renderTargets.set(outputId, renderTarget);
    return renderTarget;
  }

  private cleanupUnusedTargets(activeOutputIds: Set<string>): void {
    this.renderTargets.forEach((target, outputId) => {
      if (activeOutputIds.has(outputId)) {
        return;
      }

      target.dispose();
      this.renderTargets.delete(outputId);
    });
  }
}
