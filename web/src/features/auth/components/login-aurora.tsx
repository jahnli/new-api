import { useEffect, useRef, useSyncExternalStore } from "react";

// Adapted from e:/my/casdoor/web/src/components/auth/LoginAurora.tsx
// (itself adapted from React Bits Aurora).
const VERTEX = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uOpacity;
uniform vec2 uPointer;
out vec4 outColor;
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float smootherstep(float low, float high, float x) {
  float t = clamp((x - low) / (high - low), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
vec3 ramp(float u) {
  vec3 navy = vec3(23.0, 54.0, 107.0) / 255.0;
  vec3 blue = vec3(18.0, 73.0, 229.0) / 255.0;
  vec3 pale = vec3(190.0, 219.0, 245.0) / 255.0;
  return u < 0.5 ? mix(pale, blue, smoothstep(0.0, 0.5, u)) : mix(blue, navy, smoothstep(0.5, 1.0, u));
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  float y = 1.0 - frag.y / uResolution.y;
  float u = frag.x / uResolution.x;
  float X = (frag.x - uResolution.x * 0.5) / uResolution.y;
  float reach = uPointer.y * exp(-pow((X - uPointer.x) / 0.38, 2.0));
  vec3 glow = vec3(0.0);
  float cover = 0.0;
  for (int k = 0; k < 3; k++) {
    float layer = float(k);
    float seed = layer * 13.7;
    float pace = uTime * (1.0 - layer * 0.22);
    float warp = snoise(vec2(X * 0.45 * 1.2 + pace * 0.11 + seed, pace * 0.16 + seed));
    float wave = snoise(vec2(X * 0.75 * 1.2 + warp * 0.45 - pace * 0.13 + seed, pace * 0.2 - seed)) * 0.72
      + snoise(vec2(X * 1.6 * 1.2 + warp * 0.55 + pace * 0.17 - seed, pace * 0.26 + seed * 0.5)) * 0.28;
    float hem = 0.24 + layer * 0.08 + wave * 0.18 * 0.95;
    hem += reach * 0.18;
    float soft = 0.16 * (1.0 + layer * 0.85);
    float rise = hem - y;
    float body = pow(smootherstep(-soft - 0.62 * 0.14, 0.26 + soft * 0.6, rise), 1.5 + 0.62 * 0.6);
    float lobes = 0.86 + 0.14 * snoise(vec2(X * 0.9 * 1.2 - pace * 0.1 + seed, y * 0.35 + pace * 0.14));
    float alpha = body * lobes * (k == 0 ? 1.0 : 0.62);
    alpha = clamp(alpha * (1.0 + reach * 0.45 * smootherstep(0.9, 0.0, abs(y - hem))), 0.0, 1.0);
    alpha *= mix(0.4, 0.9, smoothstep(0.0, 1.0, u));
    vec3 tint = ramp(u + 0.08 * sin(pace * 0.28 + layer * 2.3) + layer * 0.16 + max(rise, 0.0) * 0.12);
    tint = mix(tint, vec3(0.78, 0.88, 1.0), clamp(max(rise, 0.0) * 0.55, 0.0, 0.42));
    glow = 1.0 - (1.0 - glow) * (1.0 - tint * alpha);
    cover = 1.0 - (1.0 - cover) * (1.0 - alpha);
  }
  outColor = vec4(glow * uOpacity, cover * uOpacity);
}`;

const STATIC_QUERY = "(max-width: 767px), (prefers-reduced-motion: reduce)";

function subscribeStatic(onChange: () => void) {
  const media = window.matchMedia(STATIC_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function LoginAurora(props: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticBackground = useSyncExternalStore(
    subscribeStatic,
    () => window.matchMedia(STATIC_QUERY).matches,
    () => true,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || staticBackground) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
    });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteProgram(program);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "uResolution");
    const time = gl.getUniformLocation(program, "uTime");
    const pointerUniform = gl.getUniformLocation(program, "uPointer");
    gl.uniform1f(
      gl.getUniformLocation(program, "uOpacity"),
      props.isDark ? 0.78 : 0.62,
    );

    let raf = 0;
    let elapsed = 20;
    let previous = 0;
    const pointer = { target: 0, x: 0, reach: 0, inside: false };
    const render = () => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, elapsed);
      gl.uniform2f(pointerUniform, pointer.x, pointer.reach);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const frame = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
      elapsed += dt;
      previous = now;
      if (pointer.inside) {
        pointer.x += (pointer.target - pointer.x) * (1 - Math.exp(-dt / 0.6));
      }
      pointer.reach +=
        ((pointer.inside ? 1 : 0) - pointer.reach) *
        (1 - Math.exp(-dt / (pointer.inside ? 0.9 : 1.4)));
      render();
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      previous = 0;
      if (document.hidden) pointer.inside = false;
      if (!document.hidden && !gl.isContextLost()) {
        raf = requestAnimationFrame(frame);
      }
    };
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      render();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const wasInside = pointer.inside;
      pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      pointer.target = (x - rect.width / 2) / Math.max(1, rect.height);
      if (pointer.inside && !wasInside) pointer.x = pointer.target;
    };
    const onPointerLeave = () => {
      pointer.inside = false;
    };
    const onContextLost = () => cancelAnimationFrame(raf);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onPointerLeave);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("webglcontextlost", onContextLost);
    resize();
    onVisibility();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onPointerLeave);
      document.documentElement.removeEventListener(
        "pointerleave",
        onPointerLeave,
      );
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [props.isDark, staticBackground]);

  return (
    <div
      aria-hidden="true"
      className="login-aurora pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {!staticBackground && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full max-h-[1000px] w-full"
        />
      )}
    </div>
  );
}
