varying vec2 vSurfaceUv;
varying vec2 vSurfacePosition;

void main() {
  vSurfaceUv = uv;
  vSurfacePosition = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
