"use client";

import React, { useEffect, useRef, useState } from "react";

export type CloudShaderProps = {
  className?: string;
  // BRIEFMINT PATCH: style passthrough for the wrapper.
  style?: React.CSSProperties;
  children?: React.ReactNode;
  /** Animation speed multiplier. 1 = default drift. */
  speed?: number;
  /** Number of clouds (1-6). */
  count?: number;
  /** Cloud tint color (hex or rgb string). */
  cloudColor?: string;
  /** Sky color at the top (hex or rgb string). */
  skyTopColor?: string;
  /** Sky color at the bottom (hex or rgb string). */
  skyBottomColor?: string;
  // BRIEFMINT PATCH: performance caps. Backing size = client size x min(devicePixelRatio, maxDpr) x resolutionScale.
  /** Upper bound for devicePixelRatio. */
  maxDpr?: number;
  /** Extra backing-store scale; CSS stretches the canvas. */
  resolutionScale?: number;
  /** Maximum draws per second. */
  maxFps?: number;
};

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Original cloud shader for Aceternity UI.
// Each cloud is an asymmetric envelope (dome top, flat base) filled with
// domain-warped billow noise. A second density sample above the pixel
// approximates self-shadowing. Clouds drift horizontally and wrap around.
const FRAG = `
precision highp float;

varying vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_count;
uniform vec3 u_cloud;
uniform vec3 u_skyTop;
uniform vec3 u_skyBottom;

const mat2 R = mat2(0.80, 0.60, -0.60, 0.80);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.31, 289.17))) * 26737.367);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p = R * p * 2.03 + 19.19;
    amp *= 0.5;
  }
  return sum;
}

// billow noise: sharp puffy ridges, like cauliflower cloud tops
float billow(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * (1.0 - abs(2.0 * vnoise(p) - 1.0));
    p = R * p * 2.11 + 13.37;
    amp *= 0.5;
  }
  return sum;
}

// raw density for one cloud at point p
float cloudDensity(vec2 p, vec2 c, vec2 r, float seed, float t) {
  vec2 q = p - c;

  // envelope: dome above the center, flat base below
  float ry = q.y > 0.0 ? r.y : r.y * 0.42;
  float env = 1.0 - length(vec2(q.x / r.x, q.y / ry));
  if (env < -0.35) return 0.0;

  // domain-warped billow detail, moves with the cloud, evolves slowly
  vec2 dp = q * (2.4 / r.x) + seed;
  dp += 0.6 * vec2(
    fbm(dp * 1.4 + t * 0.04),
    fbm(dp * 1.4 + 7.7 - t * 0.03)
  );
  float detail = billow(dp * 1.6);

  return env + (detail - 0.62) * 0.62;
}

// shades one cloud and blends it over the current color
vec3 shadeCloud(vec3 color, vec3 sky, vec2 p, vec2 c, vec2 r, float seed, float t, float dist) {
  float d = cloudDensity(p, c, r, seed, t);
  if (d < 0.02) return color;

  // sample density toward the sun (straight up) for self-shadowing
  float dUp = cloudDensity(p + vec2(0.0, r.y * 0.55), c, r, seed, t);
  float occl = clamp((dUp - d) * 1.1 + d * 0.55, 0.0, 1.0);

  vec3 lit = u_cloud * 1.04;
  vec3 shadow = mix(u_cloud * 0.60, sky, 0.38);
  vec3 cloudCol = mix(lit, shadow, occl * 0.85);

  float alpha = smoothstep(0.02, 0.38, d);

  // silver lining on thin edges
  float rim = smoothstep(0.02, 0.14, d) * (1.0 - smoothstep(0.14, 0.40, d));
  cloudCol += rim * 0.10;

  // atmospheric perspective: far clouds fade into the sky
  cloudCol = mix(cloudCol, sky, dist * 0.35);
  alpha *= mix(1.0, 0.8, dist);

  return mix(color, cloudCol, alpha);
}

// one drifting cloud: horizontal wrap + gentle vertical bob
vec3 cloudPass(vec3 color, vec3 sky, vec2 p, float aspect, float t,
               float spd, float phase, float y, vec2 r, float seed, float dist) {
  float cx = mix(-r.x - 0.25, aspect + r.x + 0.25, fract(t * spd + phase));
  float cy = y + sin(t * 0.05 + phase * 6.2831) * 0.012;
  return shadeCloud(color, sky, p, vec2(cx, cy), r, seed, t, dist);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  float t = u_time;

  vec3 sky = mix(u_skyBottom, u_skyTop, v_uv.y);
  vec3 color = sky;

  // faint haze band near the horizon
  color = mix(color, u_skyBottom * 1.06, smoothstep(0.35, 0.0, v_uv.y) * 0.5);

  // soft sun glow, upper area
  vec2 sunPos = vec2(aspect * 0.78, 0.92);
  float sunDist = length(p - sunPos);
  color += vec3(1.0, 0.95, 0.82) * exp(-sunDist * sunDist * 5.0) * 0.28;

  // thin cirrus streaks, stretched horizontally, high in the sky
  float cirrusBand = smoothstep(0.55, 0.8, v_uv.y) * (1.0 - smoothstep(0.9, 1.0, v_uv.y));
  if (cirrusBand > 0.01) {
    float streak = fbm(vec2(p.x * 1.6 - t * 0.006, p.y * 12.0));
    float wisp = smoothstep(0.52, 0.78, streak) * cirrusBand;
    color = mix(color, u_cloud * 0.98, wisp * 0.35);
  }

  // far layer: small, high, slow
  if (u_count > 5.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.006, 0.10, 0.84, vec2(0.20, 0.10), 43.7, 1.0);
  }
  if (u_count > 4.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.008, 0.62, 0.73, vec2(0.24, 0.12), 71.3, 0.85);
  }

  // middle layer
  if (u_count > 3.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.011, 0.33, 0.60, vec2(0.34, 0.16), 17.3, 0.55);
  }
  if (u_count > 2.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.013, 0.80, 0.47, vec2(0.30, 0.15), 29.9, 0.45);
  }

  // near layer: big, low, fast
  if (u_count > 1.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.016, 0.05, 0.35, vec2(0.46, 0.20), 91.1, 0.15);
  }
  color = cloudPass(color, sky, p, aspect, t, 0.020, 0.48, 0.20, vec2(0.56, 0.24), 57.2, 0.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

function parseHex(color: string): [number, number, number] {
  const value = color.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16) / 255,
        parseInt(hex[1] + hex[1], 16) / 255,
        parseInt(hex[2] + hex[2], 16) / 255,
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }
  const rgb = value.match(/[\d.]+/g);
  if (rgb && rgb.length >= 3) {
    return [Number(rgb[0]) / 255, Number(rgb[1]) / 255, Number(rgb[2]) / 255];
  }
  return [0.95, 0.95, 0.95];
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// BRIEFMINT PATCH: pending delayed loseContext() per canvas, so React StrictMode's
// mount/cleanup/mount does not reuse a context that was already force-lost.
const pendingLoseContext = new WeakMap<
  HTMLCanvasElement,
  ReturnType<typeof setTimeout>
>();

export const CloudShader = ({
  className,
  style,
  children,
  speed = 1,
  count = 6,
  cloudColor = "#fbf8f2",
  skyTopColor = "#3876ba",
  skyBottomColor = "#8cbfe8",
  // BRIEFMINT PATCH: new props.
  maxDpr = 1,
  resolutionScale = 0.75,
  maxFps = 30,
}: CloudShaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // BRIEFMINT PATCH: failed state hides the canvas and shows a CSS gradient instead.
  const [failed, setFailed] = useState(false);
  const redrawRef = useRef<(() => void) | null>(null);
  const paramsRef = useRef({
    speed,
    count,
    cloudColor,
    skyTopColor,
    skyBottomColor,
  });

  // BRIEFMINT PATCH: sync latest props after render (react-hooks/refs forbids writing refs during render).
  useEffect(() => {
    paramsRef.current = {
      speed,
      count,
      cloudColor,
      skyTopColor,
      skyBottomColor,
    };
  });

  // BRIEFMINT PATCH: repaint when a static frame is showing (reduced motion / paused).
  useEffect(() => {
    redrawRef.current?.();
  }, [speed, count, cloudColor, skyTopColor, skyBottomColor]);

  // BRIEFMINT PATCH: the whole effect below is rewritten for pause/cap/failure/cleanup.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pending = pendingLoseContext.get(canvas);
    if (pending !== undefined) {
      clearTimeout(pending);
      pendingLoseContext.delete(canvas);
    }

    let gl: WebGLRenderingContext | null = null;
    let vert: WebGLShader | null = null;
    let frag: WebGLShader | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let observer: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    let frame = 0;
    let looping = false;
    let lost = false;
    let disposed = false;
    let visible = true;
    let lastTick: number | null = null;
    let lastDraw = -Infinity;
    let elapsedMs = 0;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = mql.matches;

    const loc: Record<
      "res" | "time" | "count" | "cloud" | "skyTop" | "skyBottom",
      WebGLUniformLocation | null
    > = {
      res: null,
      time: null,
      count: null,
      cloud: null,
      skyTop: null,
      skyBottom: null,
    };

    const stopLoop = () => {
      looping = false;
      cancelAnimationFrame(frame);
      lastTick = null;
    };

    const releaseGl = (immediate: boolean) => {
      if (gl) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        if (vert) gl.deleteShader(vert);
        if (frag) gl.deleteShader(frag);
      }
      buffer = null;
      program = null;
      vert = null;
      frag = null;
      redrawRef.current = null;
      const ctx = gl;
      gl = null;
      if (!ctx) return;
      const lose = () => {
        try {
          ctx.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {
          /* context already gone */
        }
        pendingLoseContext.delete(canvas);
      };
      if (immediate) lose();
      else pendingLoseContext.set(canvas, setTimeout(lose, 0));
    };

    const teardownObservers = () => {
      observer?.disconnect();
      io?.disconnect();
      observer = null;
      io = null;
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      mql.removeEventListener?.("change", onMotionChange);
    };

    const fail = () => {
      if (disposed) return;
      stopLoop();
      teardownObservers();
      releaseGl(true);
      disposed = true;
      setFailed(true);
    };

    const render = (timeMs: number) => {
      if (!gl || lost) return;
      const p = paramsRef.current;
      const cloud = parseHex(p.cloudColor);
      const skyTop = parseHex(p.skyTopColor);
      const skyBottom = parseHex(p.skyBottomColor);

      gl.uniform1f(loc.time, (timeMs / 1000) * p.speed);
      gl.uniform1f(loc.count, Math.min(6, Math.max(1, p.count)));
      gl.uniform3f(loc.cloud, cloud[0], cloud[1], cloud[2]);
      gl.uniform3f(loc.skyTop, skyTop[0], skyTop[1], skyTop[2]);
      gl.uniform3f(loc.skyBottom, skyBottom[0], skyBottom[1], skyBottom[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const drawStatic = () => {
      if (!looping) render(reduceMotion ? 0 : elapsedMs);
    };

    const draw = (now: number) => {
      if (!looping) return;
      frame = requestAnimationFrame(draw);
      // Accumulate elapsed time so a resume after a pause does not jump.
      if (lastTick !== null) elapsedMs += now - lastTick;
      lastTick = now;
      const minInterval = 1000 / Math.max(1, maxFps);
      if (now - lastDraw < minInterval - 1) return;
      lastDraw = now;
      render(elapsedMs);
    };

    const sync = () => {
      if (disposed || lost) return;
      const shouldLoop = !reduceMotion && visible && !document.hidden;
      if (shouldLoop && !looping) {
        looping = true;
        lastTick = null;
        frame = requestAnimationFrame(draw);
      } else if (!shouldLoop && looping) {
        stopLoop();
      }
      if (reduceMotion) render(0);
    };

    function onVisibility() {
      sync();
    }
    function onMotionChange(event: MediaQueryListEvent) {
      reduceMotion = event.matches;
      sync();
    }
    function onContextLost(event: Event) {
      event.preventDefault();
      lost = true;
      fail();
    }

    const resize = () => {
      if (!gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.1, maxDpr));
      const scale = dpr * Math.max(0.1, resolutionScale);
      const w = Math.max(1, Math.floor(canvas.clientWidth * scale));
      const h = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(loc.res, w, h);
      // Resizing clears the buffer; repaint immediately when no loop will.
      drawStatic();
    };

    canvas.addEventListener("webglcontextlost", onContextLost);

    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      fail();
      return;
    }

    vert = compile(gl, gl.VERTEX_SHADER, VERT);
    frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    program = vert && frag ? gl.createProgram() : null;
    if (!vert || !frag || !program) {
      fail();
      return;
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.bindAttribLocation(program, 0, "a_pos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      fail();
      return;
    }
    gl.useProgram(program);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    loc.res = gl.getUniformLocation(program, "u_res");
    loc.time = gl.getUniformLocation(program, "u_time");
    loc.count = gl.getUniformLocation(program, "u_count");
    loc.cloud = gl.getUniformLocation(program, "u_cloud");
    loc.skyTop = gl.getUniformLocation(program, "u_skyTop");
    loc.skyBottom = gl.getUniformLocation(program, "u_skyBottom");

    redrawRef.current = drawStatic;

    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        visible = entry.isIntersecting;
        sync();
      });
      io.observe(canvas);
    }
    document.addEventListener("visibilitychange", onVisibility);
    mql.addEventListener?.("change", onMotionChange);

    sync();

    return () => {
      if (disposed) return;
      disposed = true;
      stopLoop();
      teardownObservers();
      releaseGl(false);
    };
  }, [maxDpr, resolutionScale, maxFps]);

  return (
    // BRIEFMINT PATCH: no Tailwind or cn() in this repo; equivalent inline styles.
    <div
      className={className}
      style={{
        position: "relative",
        height: "100%",
        minHeight: "20rem",
        width: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      {failed ? (
        <div
          aria-hidden="true"
          data-briefmint-backdrop-fallback="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `linear-gradient(to bottom, ${skyTopColor}, ${skyBottomColor})`,
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          data-briefmint-backdrop="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      )}
      {children ? (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

export default CloudShader;
