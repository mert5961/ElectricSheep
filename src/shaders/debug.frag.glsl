uniform float u_time;
uniform vec3  u_color;
uniform float u_feather;
uniform mat3  u_contentTransform;
uniform mat3  u_subtractTransforms[MAX_SUBTRACT_QUADS];
uniform int   u_subtractCount;

varying vec2 vSurfaceUv;
varying vec2 vSurfacePosition;

vec2 projectQuadUv(mat3 transform, vec2 position) {
  vec3 projection = transform * vec3(position, 1.0);
  float projectionW = projection.z;
  if (abs(projectionW) < 0.0001) {
    projectionW = projectionW < 0.0 ? -0.0001 : 0.0001;
  }
  return projection.xy / projectionW;
}

void main() {
  vec2 contentUv = projectQuadUv(u_contentTransform, vSurfacePosition);

  vec2 centeredUv = contentUv - 0.5;
  float waveA = 0.5 + 0.5 * sin((centeredUv.x * 6.0) + (u_time * 1.4));
  float waveB = 0.5 + 0.5 * sin((centeredUv.y * 5.0) - (u_time * 1.1));
  float waveC = 0.5 + 0.5 * sin(((centeredUv.x + centeredUv.y) * 4.0) + (u_time * 0.9));
  vec3 contentColor = vec3(waveA, waveB, waveC);
  vec3 gradient = mix(u_color, contentColor, 0.5);

  // Edge feather: fade alpha near all 4 edges using smoothstep
  float feather = clamp(u_feather, 0.0, 0.25);
  float alphaL = smoothstep(0.0, feather, vSurfaceUv.x);
  float alphaR = smoothstep(0.0, feather, 1.0 - vSurfaceUv.x);
  float alphaB = smoothstep(0.0, feather, vSurfaceUv.y);
  float alphaT = smoothstep(0.0, feather, 1.0 - vSurfaceUv.y);
  float alpha = alphaL * alphaR * alphaB * alphaT;

  for (int i = 0; i < MAX_SUBTRACT_QUADS; i++) {
    if (i >= u_subtractCount) {
      break;
    }

    vec2 subtractUv = projectQuadUv(u_subtractTransforms[i], vSurfacePosition);
    bool insideSubtractQuad = (
      subtractUv.x >= 0.0 &&
      subtractUv.x <= 1.0 &&
      subtractUv.y >= 0.0 &&
      subtractUv.y <= 1.0
    );

    if (insideSubtractQuad) {
      alpha = 0.0;
      break;
    }
  }

  gl_FragColor = vec4(gradient, alpha);
}
