uniform float u_time;
uniform vec3  u_color;
uniform float u_feather;
uniform mat3  u_contentTransform;
uniform mat3  u_subtractTransforms[MAX_SUBTRACT_QUADS];
uniform float u_subtractFeathers[MAX_SUBTRACT_QUADS];
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

float subtractKeepFactor(vec2 subtractUv, float feather) {
  float edgeDistance = min(
    min(subtractUv.x, 1.0 - subtractUv.x),
    min(subtractUv.y, 1.0 - subtractUv.y)
  );

  if (feather <= 0.0001) {
    return edgeDistance >= 0.0 ? 0.0 : 1.0;
  }

  float subtractMask = smoothstep(0.0, feather, edgeDistance);
  return 1.0 - subtractMask;
}

float surfaceEdgeAlpha(float distanceToEdge, float feather) {
  if (feather <= 0.0001) {
    return distanceToEdge > 0.0 ? 1.0 : 0.0;
  }

  return smoothstep(0.0, feather, distanceToEdge);
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
  float alphaL = surfaceEdgeAlpha(vSurfaceUv.x, feather);
  float alphaR = surfaceEdgeAlpha(1.0 - vSurfaceUv.x, feather);
  float alphaB = surfaceEdgeAlpha(vSurfaceUv.y, feather);
  float alphaT = surfaceEdgeAlpha(1.0 - vSurfaceUv.y, feather);
  float alpha = alphaL * alphaR * alphaB * alphaT;

  for (int i = 0; i < MAX_SUBTRACT_QUADS; i++) {
    if (i >= u_subtractCount) {
      break;
    }

    vec2 subtractUv = projectQuadUv(u_subtractTransforms[i], vSurfacePosition);
    alpha *= subtractKeepFactor(subtractUv, u_subtractFeathers[i]);
  }

  gl_FragColor = vec4(gradient, alpha);
}
