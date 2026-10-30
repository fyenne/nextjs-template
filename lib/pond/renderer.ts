import type { PondScene } from "./scene";
import type { HtmlInCanvasCanvas, HtmlInCanvasGL } from "./html-in-canvas";

const MAX_RIPPLES = 40;

export type RippleKind = "drop" | "splash";

// speed (px/s), decay, lifetime (s), wave number
const KINDS: Record<RippleKind, [number, number, number, number]> = {
  drop: [95, 1.5, 2.6, 0.34],
  splash: [190, 0.6, 6, 0.17],
};

// Each pulse: [delay (s), amplitude, decay time constant (s)]
const LIGHTNING_PULSES: [number, number, number][] = [
  [0, 1, 0.09],
  [0.14, 0.7, 0.07],
  [0.33, 1, 0.28],
];

const VERT = `#version 300 es
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uCard;
uniform vec2 uPx;
uniform vec2 uCss;
uniform vec4 uCardRect;
uniform float uHasCard;
uniform float uFlipCard;
uniform float uTime;
uniform float uFlash;
uniform vec4 uRip[${MAX_RIPPLES}];
uniform vec4 uRipB[${MAX_RIPPLES}];

out vec4 outColor;

float height(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRip[i];
    vec4 b = uRipB[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > b.z) continue;
    float d = length(p - r.xy);
    float u = (d - age * b.x) * b.w;
    float env = u < 0.0 ? exp(u / 14.45) : exp(-u * u / 3.18);
    h += r.w * sin(u) * env * exp(-age * b.y) / (1.0 + d * 0.008);
  }
  return h;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x / uPx.x, 1.0 - gl_FragCoord.y / uPx.y) * uCss;
  float e = 1.5;
  vec2 g = vec2(
    height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0)),
    height(p + vec2(0.0, e)) - height(p - vec2(0.0, e))
  ) / (2.0 * e);

  vec2 q = p + g * 70.0;
  vec3 col = texture(uScene, q / uCss).rgb;

  vec3 n = normalize(vec3(-g * 7.0, 1.0));
  vec3 halfV = normalize(normalize(vec3(-0.4, -0.6, 0.7)) + vec3(0.0, 0.0, 1.0));
  float base = pow(halfV.z, 90.0);
  float spec = max(pow(max(dot(n, halfV), 0.0), 90.0) - base, 0.0);
  col += vec3(0.75, 0.95, 0.9) * spec * (0.9 + uFlash * 2.5);
  col *= 1.0 - clamp(length(g) * 1.2, 0.0, 0.25);

  if (uHasCard > 0.5) {
    vec2 center = uCardRect.xy + uCardRect.zw * 0.5;
    float d = sdRoundBox(q - center - vec2(0.0, 16.0), uCardRect.zw * 0.5, 20.0);
    col *= 1.0 - 0.45 * exp(-max(d, 0.0) / 30.0);

    vec2 uv = (q - uCardRect.xy) / uCardRect.zw;
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      vec4 c = texture(uCard, vec2(uv.x, mix(uv.y, 1.0 - uv.y, uFlipCard)));
      col = mix(col, c.rgb, c.a);
      col += vec3(0.8, 0.95, 0.9) * spec * 0.25 * c.a;
    }
  }
  col = col * (1.0 + uFlash * 0.8) + vec3(0.72, 0.8, 1.0) * uFlash * 0.6;
  outColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

function makeTexture(gl: WebGL2RenderingContext) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  return tex;
}

export class PondRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private sceneTex: WebGLTexture;
  private cardTex: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private ripples = new Float32Array(MAX_RIPPLES * 4);
  private rippleParams = new Float32Array(MAX_RIPPLES * 4);
  private strikeAt = -1;
  private nextRipple = 0;
  private cardRect: [number, number, number, number] | null = null;
  private cardReady = false;
  cssW = 1;
  cssH = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private scene: PondScene,
    private cardFlip: boolean,
  ) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
    }
    this.program = program;
    gl.useProgram(program);

    for (const name of ["uScene", "uCard", "uPx", "uCss", "uCardRect", "uHasCard", "uFlipCard", "uTime", "uFlash", "uRip", "uRipB"]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    this.sceneTex = makeTexture(gl);
    this.cardTex = makeTexture(gl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  addRipple(x: number, y: number, strength: number, time: number, kind: RippleKind = "splash") {
    const i = this.nextRipple++ % MAX_RIPPLES;
    this.ripples.set([x, y, time, strength], i * 4);
    this.rippleParams.set(KINDS[kind], i * 4);
  }

  /** Starts a lightning strike; the flash envelope is evaluated in `flashLevel`. */
  strike(time: number) {
    this.strikeAt = time;
  }

  flashLevel(time: number) {
    if (this.strikeAt < 0) return 0;
    let level = 0;
    for (const [delay, amp, tau] of LIGHTNING_PULSES) {
      const t = time - this.strikeAt - delay;
      if (t >= 0) level += amp * Math.exp(-t / tau);
    }
    return Math.min(1, level);
  }

  /** Card position/size in CSS px, or null to hide the card layer. */
  setCardRect(rect: [number, number, number, number] | null) {
    this.cardRect = rect;
  }

  /** Re-rasterises the live DOM element into the card texture via html-in-canvas. */
  updateCardTexture(element: Element) {
    const gl = this.gl as HtmlInCanvasGL;
    const canvas = this.canvas as HtmlInCanvasCanvas;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.cardTex);

    // The API changed shape between Chromium builds, so try each known variant.
    if (typeof canvas.getElementImageDefaultSize === "function" && gl.texElementSubImage2D) {
      const { width, height } = canvas.getElementImageDefaultSize(element);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, Math.max(1, width), Math.max(1, height), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, element);
    } else {
      try {
        gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, element);
      } catch {
        (gl as unknown as { texElementImage2D(t: number, f: number, e: Element): void }).texElementImage2D(
          gl.TEXTURE_2D,
          gl.RGBA8,
          element,
        );
      }
    }
    this.cardReady = true;
  }

  render(time: number) {
    const { gl } = this;
    const sceneChanged = this.scene.draw();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    if (sceneChanged) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.scene.canvas);
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.cardTex);

    const u = this.uniforms;
    gl.uniform1i(u.uScene, 0);
    gl.uniform1i(u.uCard, 1);
    gl.uniform2f(u.uPx, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uCss, this.cssW, this.cssH);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uFlash, this.flashLevel(time));
    gl.uniform1f(u.uFlipCard, this.cardFlip ? 1 : 0);
    gl.uniform4fv(u.uRip, this.ripples);
    gl.uniform4fv(u.uRipB, this.rippleParams);
    const rect = this.cardRect;
    gl.uniform1f(u.uHasCard, rect && this.cardReady ? 1 : 0);
    if (rect) gl.uniform4f(u.uCardRect, rect[0], rect[1], rect[2], rect[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
