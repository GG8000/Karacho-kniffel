// Shader für <Globe />: WebGL2 (GLSL ES 3.00), ein Vollbild-Dreieck, die Kugel
// entsteht rein rechnerisch (orthografisch: p = (x, y, sqrt(1-x²-y²))).
//
// Präzision: In GLSL ES 3.00 ist `highp` im Fragment-Shader garantiert, daher
// einfach überall highp. Mit mediump würde der Noise (Ganzzahl-Hash) und der
// Glanzpunkt pow(n·h, 120) sichtbar bändern.

export const VERT = `#version 300 es
// Dreieck ohne Vertex-Buffer: aus gl_VertexID (0,1,2) -> (0,0) (2,0) (0,2).
out vec2 vNdc;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vNdc = p * 2.0 - 1.0;
  gl_Position = vec4(vNdc, 0.0, 1.0);
}`

export const buildFrag = (discRatio) => `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vNdc;
out vec4 outColor;

uniform sampler2D uTex;
uniform float uRot;       // Länge in der Bildmitte (Bogenmaß)
uniform float uCloudRot;  // dito, für die Wolken (driften separat)
uniform vec2  uTilt;      // (cos, sin) der Achsenneigung
uniform float uTexMix;    // 0 = Textur noch nicht da, 1 = fertig (Einblenden)
uniform float uAA;        // Pixelbreite in Scheibenradien (Kantenglättung)
uniform float uGlow;      // Halo außerhalb der Scheibe an/aus

const float DISC = ${discRatio.toFixed(4)};
const float PI = 3.14159265;
// Licht von links oben, leicht von vorn: schmale Nachtsichel rechts unten.
const vec3 L = normalize(vec3(-0.70, 0.38, 0.60));
const vec3 ATMO = vec3(0.28, 0.56, 1.0);
const vec3 SUN = vec3(1.08, 1.02, 0.94);

// ---- Noise ---------------------------------------------------------------
// Ganzzahl-Hash statt sin(): bleibt auf jeder GPU identisch und stabil.
float h31(uvec3 q) {
  q *= uvec3(1597334673u, 3812015801u, 2798796415u);
  uint n = (q.x ^ q.y ^ q.z) * 1597334673u;
  return float(n >> 8) * (1.0 / 16777216.0);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  uvec3 u = uvec3(ivec3(i));
  return mix(
    mix(mix(h31(u),                    h31(u + uvec3(1u,0u,0u)), f.x),
        mix(h31(u + uvec3(0u,1u,0u)),  h31(u + uvec3(1u,1u,0u)), f.x), f.y),
    mix(mix(h31(u + uvec3(0u,0u,1u)),  h31(u + uvec3(1u,0u,1u)), f.x),
        mix(h31(u + uvec3(0u,1u,1u)),  h31(u + uvec3(1u,1u,1u)), f.x), f.y), f.z);
}
// Wolkenmuster: fbm, normiert (Mittelwert ~0.5 unabhängig von der Oktavenzahl)
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s / 0.875;
}
float fbm5(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s / 0.96875;
}

// Ansicht-Raum -> Objekt-Raum (Achsenneigung rückgängig machen)
vec3 untilt(vec3 v) { return vec3(uTilt.x * v.x - uTilt.y * v.y, uTilt.y * v.x + uTilt.x * v.y, v.z); }
// Ansicht-Raum -> Wolken-Raum (zusätzlich um die eigene Drehung verschoben)
vec3 toCloud(vec3 v) {
  vec3 o = untilt(v);
  float c = cos(uCloudRot), s = sin(uCloudRot);
  return vec3(o.x * c + o.z * s, o.y, o.z * c - o.x * s);
}

void main() {
  vec2 q = vNdc / DISC;                       // Scheibe hat Radius 1
  float r2 = dot(q, q);
  float r = sqrt(r2);
  float z = sqrt(max(1.0 - r2, 0.0)) + 1e-4;
  vec3 n = normalize(vec3(q, z));             // Oberflächennormale (Ansicht-Raum)
  vec3 o = untilt(n);

  // Texturkoordinaten. Ableitungen VOR jedem if berechnen (müssen im
  // einheitlichen Kontrollfluss stehen) und die Naht bei ±180° umgehen: dort
  // springt u von 1 auf 0, die Ableitung wäre riesig und ergäbe eine
  // sichtbare Linie. Wir nehmen die Ableitung der Variante ohne Sprung.
  float turns = (atan(o.x, o.z) + uRot) / (2.0 * PI) + 0.5;
  float v = 0.5 - asin(clamp(o.y, -1.0, 1.0)) / PI;
  vec2 uvA = vec2(fract(turns), v);
  vec2 uvB = vec2(fract(turns + 0.5), v);
  vec2 dxA = dFdx(uvA), dyA = dFdy(uvA), dxB = dFdx(uvB), dyB = dFdy(uvB);
  bool useA = abs(dxA.x) + abs(dyA.x) <= abs(dxB.x) + abs(dyB.x);
  vec2 gx = useA ? dxA : dxB;
  vec2 gy = useA ? dyA : dyB;

  float cov = 1.0 - smoothstep(1.0 - uAA, 1.0 + uAA, r);   // Scheibe, kantengeglättet
  vec3 disc = vec3(0.0);

  if (cov > 0.0) {
    vec4 t = textureGrad(uTex, uvA, gx, gy);
    // Wasser = Blau überwiegt (siehe globeTexture.js); Eis/Land/Wüste nicht.
    float water = smoothstep(0.02, 0.09, t.b - max(t.r, t.g));
    vec3 alb = mix(vec3(0.05, 0.20, 0.48), t.rgb, uTexMix);
    water = mix(1.0, water, uTexMix);
    float lights = t.a * uTexMix;
    vec3 a = alb * alb;                       // sRGB -> grob linear

    float ndl = dot(n, L);
    // Weicher Terminator: Dämmerung statt harter Kante.
    float lit = smoothstep(-0.16, 0.16, ndl) * (0.20 + 0.80 * pow(clamp(ndl, 0.0, 1.0), 0.75));
    vec3 nightAmb = vec3(0.010, 0.017, 0.040);

    // ---- Wolken (eigene Drehung, Muster nahtlos im Raum) ----
    vec3 d = toCloud(n);
    vec3 Lc = toCloud(L);
    vec3 tang = Lc - d * dot(Lc, d);          // Richtung zur Sonne entlang der Oberfläche
    // y gestaucht = Muster in Ost-West-Richtung gezogen (Passatwinde, Fronten)
    vec3 sp = d * vec3(3.6, 5.2, 3.6);
    float warp = vnoise(sp * 0.45 + 7.0);
    vec3 wv = vec3(0.9, 0.5, -0.7) * (warp - 0.5) * 2.4;
    sp += wv;
    float f = fbm5(sp) + (vnoise(sp * 7.0) - 0.5) * 0.14;   // feine Ausfransung der Ränder
    // Mehr Wolken am Äquator und in den Stürmen der mittleren Breiten,
    // weniger in den Wüstengürteln (~25°) und an den Polen.
    float lat = asin(clamp(o.y, -1.0, 1.0));
    float cover = 0.065 * cos(lat * 7.2);
    float lo = 0.57 - cover;
    float dens = smoothstep(lo, lo + 0.13, f);
    // Zweite, grobe Probe zur Sonne hin: Sonnenseite heller, Schatten auf den Boden
    float fs = fbm3((d + tang * 0.03) * vec3(3.6, 5.2, 3.6) + wv);
    float f3 = fbm3(sp);
    float slope = clamp((f3 - fs) * 5.0, -1.0, 1.0);
    float shade = smoothstep(lo, lo + 0.13, fs);

    // ---- Boden ----
    vec3 ground = a * (SUN * lit + nightAmb);
    ground *= 1.0 - 0.35 * shade * (1.0 - dens);   // Wolkenschatten
    // Sonnenglanz auf dem Meer (nur über Wasser, durch Wolken verdeckt)
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float nh = max(dot(n, H), 0.0);
    float spec = pow(nh, 520.0) * 0.9 + pow(nh, 70.0) * 0.07;
    ground += SUN * spec * water * (1.0 - dens) * smoothstep(0.0, 0.12, ndl);
    // Lichter der Städte: nur Nachtseite, unter Wolken gedämpft
    float night = 1.0 - smoothstep(-0.10, 0.12, ndl);
    ground += vec3(1.0, 0.70, 0.34) * lights * lights * night * (1.0 - 0.85 * dens) * 2.2;

    // ---- Wolken darüber ----
    vec3 cloudCol = vec3(0.86) * (SUN * lit + nightAmb) * (1.0 + 0.35 * slope);
    vec3 col = mix(ground, cloudCol, dens * 0.88);

    // ---- Atmosphäre ----
    float edge = 1.0 - n.z;                    // 0 Mitte, 1 Rand
    float rim = pow(edge, 3.2);
    float lightSide = smoothstep(-0.50, 0.45, ndl);
    col += ATMO * ATMO * rim * (0.10 + 1.15 * lightSide);
    // Streulicht über der ganzen Scheibe, am Rand dicker (Luftperspektive)
    col = mix(col, ATMO * ATMO * (0.25 + 0.75 * lit), 0.10 * pow(edge, 1.6) * (0.3 + lightSide));
    // Dämmerungsband am Terminator: warmer Saum
    float tw = exp(-ndl * ndl / 0.010);
    col += vec3(0.80, 0.30, 0.12) * tw * (0.008 + 0.30 * rim);

    // Tonemapping (weiches Abschneiden) + ~sRGB
    col = 1.0 - exp(-col * 1.30);
    col = sqrt(col);
    // Leichtes Dithering gegen Banding in den Verläufen
    col += (h31(uvec3(uvec2(gl_FragCoord.xy), 3u)) - 0.5) / 255.0;
    disc = col;
  }

  // ---- Halo außerhalb der Scheibe (premultiplied) ----
  float dOut = max(r - 1.0, 0.0);
  float reach = 1.0 / DISC - 1.0;              // bis zum Canvasrand
  float g = exp(-dOut * 15.0) * (1.0 - smoothstep(reach * 0.45, reach * 0.98, dOut));
  vec2 dir = q / max(r, 1e-3);
  float side = 0.30 + 0.70 * smoothstep(-0.7, 0.8, dot(dir, normalize(L.xy)));
  float ga = g * side * 0.85 * uGlow;
  vec4 halo = vec4(vec3(0.30, 0.58, 1.0) * ga, ga);

  outColor = vec4(disc * cov, cov) + (1.0 - cov) * halo;
}`
