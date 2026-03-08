uniform float u_time;
uniform vec3  u_color;
uniform float u_feather;

varying vec2 vUv;

void main() {
  // UV-based gradient pattern with time animation
  vec3 gradient = mix(u_color, vec3(vUv, 0.5 + 0.5 * sin(u_time)), 0.5);

  // Edge feather: fade alpha near all 4 edges using smoothstep
  float feather = clamp(u_feather, 0.0, 0.25);
  float alphaL = smoothstep(0.0, feather, vUv.x);
  float alphaR = smoothstep(0.0, feather, 1.0 - vUv.x);
  float alphaB = smoothstep(0.0, feather, vUv.y);
  float alphaT = smoothstep(0.0, feather, 1.0 - vUv.y);
  float alpha = alphaL * alphaR * alphaB * alphaT;

  gl_FragColor = vec4(gradient, alpha);
}
