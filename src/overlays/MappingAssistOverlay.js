import {
  OUTPUT_DISPLAY_MODE_CALIBRATION,
  OUTPUT_DISPLAY_MODE_MAPPING_ASSIST,
  OUTPUT_DISPLAY_MODE_SHOW,
} from '../core/AppModes.js';

export class MappingAssistOverlay {
  constructor(containerEl) {
    this._containerEl = containerEl;
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._mode = OUTPUT_DISPLAY_MODE_SHOW;
    this._selectedSurfaceId = null;
    this._surfaces = [];

    Object.assign(this._canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    });

    if (this._containerEl) {
      this._containerEl.appendChild(this._canvas);
    }
  }

  setMode(mode) {
    this._mode = mode;
  }

  update({ surfaces = [], selectedSurfaceId = null }) {
    this._surfaces = surfaces;
    this._selectedSurfaceId = selectedSurfaceId;
  }

  resize(width, height) {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (this._canvas.width !== nextWidth) this._canvas.width = nextWidth;
    if (this._canvas.height !== nextHeight) this._canvas.height = nextHeight;
  }

  render() {
    if (!this._ctx) return;

    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    if (this._mode === OUTPUT_DISPLAY_MODE_SHOW) {
      return;
    }

    if (this._mode === OUTPUT_DISPLAY_MODE_CALIBRATION) {
      this._drawCalibrationGrid(ctx);
    } else {
      this._drawAlignmentGrid(ctx);
    }

    this._drawViewportGuides(ctx);

    this._surfaces.forEach((surface) => {
      this._drawSurface(ctx, surface, surface.id === this._selectedSurfaceId);
    });
  }

  dispose() {
    this._canvas.remove();
  }

  _drawCalibrationGrid(ctx) {
    const step = 64;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (let y = 0; y < this._canvas.height; y += step) {
      for (let x = (Math.floor(y / step) % 2) * step; x < this._canvas.width; x += step * 2) {
        ctx.fillRect(x, y, step, step);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this._canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this._canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this._canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this._canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawViewportGuides(ctx) {
    ctx.save();
    ctx.strokeStyle = this._mode === OUTPUT_DISPLAY_MODE_CALIBRATION
      ? 'rgba(255,255,255,0.35)'
      : 'rgba(111, 194, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(12.5, 12.5, this._canvas.width - 25, this._canvas.height - 25);

    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(this._canvas.width / 2, 0);
    ctx.lineTo(this._canvas.width / 2, this._canvas.height);
    ctx.moveTo(0, this._canvas.height / 2);
    ctx.lineTo(this._canvas.width, this._canvas.height / 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawAlignmentGrid(ctx) {
    const step = 120;
    ctx.save();
    ctx.strokeStyle = 'rgba(111, 194, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this._canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this._canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this._canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this._canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawSurface(ctx, surface, isSelected) {
    const accent = this._mode === OUTPUT_DISPLAY_MODE_CALIBRATION
      ? (isSelected ? '#ffe58c' : '#ffffff')
      : (isSelected ? '#ffb454' : '#66d4ff');

    this._drawQuad(ctx, surface.surfaceQuad, accent, isSelected ? 2.2 : 1.4, false);
    this._drawQuad(ctx, surface.contentQuad, isSelected ? '#ffd699' : '#ffb454', 1.2, true);

    if (this._mode === OUTPUT_DISPLAY_MODE_CALIBRATION) {
      this._drawQuadDiagonals(ctx, surface.surfaceQuad, accent);
      this._drawQuadDiagonals(ctx, surface.contentQuad, 'rgba(255, 180, 84, 0.55)');
    }

    surface.subtractQuads?.forEach((subtractQuad, index) => {
      this._drawQuad(ctx, subtractQuad.quad, '#ff6f61', 1, true);
      if (this._mode === OUTPUT_DISPLAY_MODE_CALIBRATION) {
        const center = this._computeQuadCenter(subtractQuad.quad);
        this._drawLabel(ctx, `S${index + 1}`, center.x + 8, center.y - 8, '#ffb5a7');
      }
    });

    surface.surfaceQuad.forEach((corner, index) => {
      this._drawMarker(ctx, corner.x, corner.y, accent, isSelected ? 6 : 4);
      if (this._mode === OUTPUT_DISPLAY_MODE_CALIBRATION) {
        this._drawLabel(ctx, String(index + 1), corner.x + 8, corner.y - 8, accent);
      }
    });

    const center = this._computeQuadCenter(surface.surfaceQuad);
    this._drawLabel(
      ctx,
      `${surface.name} • feather ${Number(surface.feather ?? 0).toFixed(2)}`,
      center.x + 10,
      center.y - 12,
      accent,
    );
  }

  _drawQuadDiagonals(ctx, quad, color) {
    if (!Array.isArray(quad) || quad.length !== 4) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    ctx.lineTo(quad[3].x, quad[3].y);
    ctx.moveTo(quad[1].x, quad[1].y);
    ctx.lineTo(quad[2].x, quad[2].y);
    ctx.stroke();
    ctx.restore();
  }

  _drawQuad(ctx, quad, color, lineWidth, dashed) {
    if (!Array.isArray(quad) || quad.length !== 4) return;

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash(dashed ? [8, 6] : []);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.moveTo(quad[0].x, quad[0].y);
    quad.slice(1).forEach((corner) => {
      ctx.lineTo(corner.x, corner.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  _drawMarker(ctx, x, y, color, radius) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawLabel(ctx, text, x, y, color) {
    ctx.save();
    ctx.font = '12px "Segoe UI", sans-serif';
    const width = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.66)';
    ctx.fillRect(x - 6, y - 14, width, 20);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  _computeQuadCenter(quad) {
    return quad.reduce((accumulator, corner) => ({
      x: accumulator.x + (corner.x / quad.length),
      y: accumulator.y + (corner.y / quad.length),
    }), { x: 0, y: 0 });
  }
}
