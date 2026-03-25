const PERSPECTIVE_PX = 1200;
const MAX_ROTATE_X_DEG = 2.8;
const MAX_ROTATE_Y_DEG = 3.6;
const MAX_TRANSLATE_X_PX = 6;
const MAX_TRANSLATE_Y_PX = 5;
const MAX_DEPTH_PX = 10;
const ACTIVE_SCALE = 1.008;
const ACTIVE_LERP = 0.10;
const IDLE_LERP = 0.12;
const EPSILON = 0.005;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(current, target, amount) {
  return current + ((target - current) * amount);
}

function isNearlyEqual(a, b, epsilon = EPSILON) {
  return Math.abs(a - b) <= epsilon;
}

function setNeutral(state) {
  state.rotateX = 0;
  state.rotateY = 0;
  state.translateX = 0;
  state.translateY = 0;
  state.depth = 0;
  state.scale = 1;
}

class StageProjectionTiltController {
  constructor(frameEl) {
    this._frameEl = frameEl;

    this._current = { rotateX: 0, rotateY: 0, translateX: 0, translateY: 0, depth: 0, scale: 1 };
    this._target = { rotateX: 0, rotateY: 0, translateX: 0, translateY: 0, depth: 0, scale: 1 };
    this._isActive = false;
    this._rafId = null;

    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseLeave = this._handleMouseLeave.bind(this);
    this._onMouseEnter = this._handleMouseEnter.bind(this);

    this._frameEl.addEventListener('mousemove', this._onMouseMove);
    this._frameEl.addEventListener('mouseleave', this._onMouseLeave);
    this._frameEl.addEventListener('mouseenter', this._onMouseEnter);
  }

  _prefersReducedMotion() {
    return typeof window.matchMedia === 'function'
      && window.matchMedia(REDUCED_MOTION_QUERY).matches;
  }

  _handleMouseEnter() {
    this._isActive = true;
  }

  _handleMouseMove(event) {
    if (this._prefersReducedMotion()) {
      this._setNeutralTarget();
      this._queueFrame();
      return;
    }

    const rect = this._frameEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      this._setNeutralTarget();
      this._queueFrame();
      return;
    }

    const normalizedX = clamp((((event.clientX - rect.left) / rect.width) * 2) - 1, -1, 1);
    const normalizedY = clamp((((event.clientY - rect.top) / rect.height) * 2) - 1, -1, 1);

    this._isActive = true;

    this._target.rotateY = -normalizedX * MAX_ROTATE_Y_DEG;
    this._target.rotateX = normalizedY * MAX_ROTATE_X_DEG;
    this._target.translateX = -normalizedX * MAX_TRANSLATE_X_PX;
    this._target.translateY = -normalizedY * MAX_TRANSLATE_Y_PX;
    this._target.depth = MAX_DEPTH_PX;
    this._target.scale = ACTIVE_SCALE;

    this._queueFrame();
  }

  _handleMouseLeave() {
    this._isActive = false;
    this._setNeutralTarget();
    this._queueFrame();
  }

  _setNeutralTarget() {
    this._isActive = false;
    setNeutral(this._target);
  }

  _queueFrame() {
    if (this._rafId !== null) {
      return;
    }

    this._rafId = window.requestAnimationFrame(() => {
      this._rafId = null;
      this._tick();
    });
  }

  _tick() {
    const rate = this._isActive ? ACTIVE_LERP : IDLE_LERP;

    this._current.rotateX = lerp(this._current.rotateX, this._target.rotateX, rate);
    this._current.rotateY = lerp(this._current.rotateY, this._target.rotateY, rate);
    this._current.translateX = lerp(this._current.translateX, this._target.translateX, rate);
    this._current.translateY = lerp(this._current.translateY, this._target.translateY, rate);
    this._current.depth = lerp(this._current.depth, this._target.depth, rate);
    this._current.scale = lerp(this._current.scale, this._target.scale, rate);

    this._applyTransform();

    const atRest = isNearlyEqual(this._current.rotateX, this._target.rotateX)
      && isNearlyEqual(this._current.rotateY, this._target.rotateY)
      && isNearlyEqual(this._current.translateX, this._target.translateX)
      && isNearlyEqual(this._current.translateY, this._target.translateY)
      && isNearlyEqual(this._current.depth, this._target.depth)
      && isNearlyEqual(this._current.scale, this._target.scale, 0.0005);

    if (!atRest) {
      this._queueFrame();
    }
  }

  _applyTransform() {
    const isNeutral = isNearlyEqual(this._current.rotateX, 0)
      && isNearlyEqual(this._current.rotateY, 0)
      && isNearlyEqual(this._current.translateX, 0)
      && isNearlyEqual(this._current.translateY, 0)
      && isNearlyEqual(this._current.depth, 0)
      && isNearlyEqual(this._current.scale, 1, 0.0005);

    if (isNeutral) {
      this._frameEl.style.transform = '';
      return;
    }

    this._frameEl.style.transform = [
      `perspective(${PERSPECTIVE_PX}px)`,
      `translate3d(${this._current.translateX.toFixed(2)}px, ${this._current.translateY.toFixed(2)}px, ${this._current.depth.toFixed(2)}px)`,
      `rotateX(${this._current.rotateX.toFixed(3)}deg)`,
      `rotateY(${this._current.rotateY.toFixed(3)}deg)`,
      `scale(${this._current.scale.toFixed(4)})`,
    ].join(' ');
  }

  dispose() {
    if (this._rafId !== null) {
      window.cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this._frameEl.removeEventListener('mousemove', this._onMouseMove);
    this._frameEl.removeEventListener('mouseleave', this._onMouseLeave);
    this._frameEl.removeEventListener('mouseenter', this._onMouseEnter);

    setNeutral(this._current);
    this._frameEl.style.transform = '';
  }
}

export function mountStageProjectionTilt(frameEl) {
  if (!frameEl || typeof document === 'undefined') {
    return null;
  }

  return new StageProjectionTiltController(frameEl);
}
