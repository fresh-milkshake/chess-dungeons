import { vertexSource, fragmentSource } from './source.js';

/** A single WebGL2 context for the whole gallery, including reference sprites. */
export function createSpriteRenderer(canvas, slots, { onStatus, visibleOnly = false, maxTextureSize = 0, readyMessage = 'WebGL2 · 15 вариантов · один GPU-контекст' }) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) throw new Error('WebGL2 недоступен. Показаны исходные изображения.');
  let program, locations, frame = 0, previous = 0, elapsed = 0, disposed = false, lost = false;
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let speed = 1, intensity = 1, dirty = true, generation = 0;
  const textures = new Map(), shaders = new Set();
  let viewportLimit;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true;

  function compile(type, source) {
    const shader = gl.createShader(type);
    shaders.add(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function initialize() {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    for (const shader of shaders) gl.deleteShader(shader);
    shaders.clear();
    locations = Object.fromEntries(['sprite', 'time', 'effectAge', 'intensity', 'category', 'variant'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.useProgram(program); gl.uniform1i(locations.sprite, 0);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    canvas.dataset.program = 'linked';
    viewportLimit = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  }
  try { initialize(); } catch (error) {
    for (const shader of shaders) gl.deleteShader(shader);
    if (program) gl.deleteProgram(program);
    throw error;
  }

  function textureFor(url) {
    if (textures.has(url)) return textures.get(url);
    const pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (disposed || lost) { reject(new Error('Рендерер остановлен')); return; }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        let source = image;
        if (maxTextureSize && Math.max(image.width, image.height) > maxTextureSize) {
          const reduced = document.createElement('canvas');
          const ratio = maxTextureSize / Math.max(image.width, image.height);
          reduced.width = Math.round(image.width * ratio); reduced.height = Math.round(image.height * ratio);
          const context = reduced.getContext('2d');
          if (context) { context.imageSmoothingQuality = 'high'; context.drawImage(image, 0, 0, reduced.width, reduced.height); source = reduced; }
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.generateMipmap(gl.TEXTURE_2D);
        resolve(texture);
      };
      image.onerror = () => reject(new Error(`Не удалось загрузить ${url}`));
      image.src = url;
    });
    textures.set(url, pending);
    return pending;
  }

  async function load() {
    const current = ++generation;
    onStatus('Загрузка текстур…', false);
    try {
      const loaded = await Promise.all(slots.map(async slot => ({ slot, texture: await textureFor(slot.image.src) })));
      if (disposed || lost || current !== generation) return;
      for (const { slot, texture } of loaded) slot.texture = texture;
      // Keep the current set plus one previous set. Generated PNGs are large;
      // changing every piece should not retain thirty full-size GPU textures.
      const currentUrls = new Set(slots.map(slot => slot.image.src));
      for (const [url, pending] of textures) {
        if (textures.size <= 6) break;
        if (!currentUrls.has(url)) { textures.delete(url); pending.then(texture => gl.deleteTexture(texture), () => {}); }
      }
      dirty = true;
      onStatus(readyMessage, true);
      canvas.dataset.textures = String(new Set(loaded.map(item => item.texture)).size);
    } catch (error) { if (!disposed && current === generation) onStatus(error.message, false); }
  }

  function draw() {
    const bounds = canvas.parentElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const limit = viewportLimit;
    const dpr = Math.min(devicePixelRatio || 1, 2, limit[0] / bounds.width, limit[1] / bounds.height);
    const width = Math.max(1, Math.round(bounds.width * dpr)), height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST); gl.useProgram(program);
    gl.uniform1f(locations.time, elapsed); gl.uniform1f(locations.intensity, intensity);
    let count = 0;
    for (const slot of slots) {
      if (!slot.texture) continue;
      const rect = slot.image.getBoundingClientRect();
      if (visibleOnly && (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth)) continue;
      const x = Math.round((rect.left - bounds.left) * dpr), y = Math.round((bounds.bottom - rect.bottom) * dpr);
      const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
      gl.viewport(x, y, w, h); gl.scissor(x, y, w, h);
      gl.bindTexture(gl.TEXTURE_2D, slot.texture);
      gl.uniform1f(locations.intensity, intensity * (slot.intensity ?? 1));
      gl.uniform1i(locations.category, slot.category); gl.uniform1i(locations.variant, slot.index);
      slot.appearedAt??=elapsed;
      const age=reducedMotion.matches?1000:elapsed-slot.appearedAt;
      slot.image.dataset.appearanceAge=age.toFixed(3);
      gl.uniform1f(locations.effectAge,age);
      gl.drawArrays(gl.TRIANGLES, 0, 3); count++;
    }
    canvas.dataset.drawn = String(count);
    canvas.dataset.frame = String(++frame);
    canvas.dataset.phase = elapsed.toFixed(3);
    const error = gl.getError();
    if (error !== gl.NO_ERROR) { onStatus(`Ошибка WebGL (${error}). Показаны исходные изображения.`, false); paused = true; }
  }

  let request;
  function tick(now) {
    request = requestAnimationFrame(tick);
    const delta = Math.min((now - previous) / 1000, .5);
    if (now - previous < 1000 / 30) return;
    previous = now;
    if (document.hidden || !visible || lost || !canvas.parentElement.getBoundingClientRect().height) return;
    if (!paused) elapsed += delta * speed;
    if (!paused || dirty) { draw(); dirty = false; }
  }
  const observer = new ResizeObserver(() => { dirty = true; });
  observer.observe(canvas.parentElement);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; dirty = true; });
  intersection.observe(canvas.parentElement);
  const invalidate = () => { dirty = true; };
  window.addEventListener('resize', invalidate);
  if (visibleOnly) window.addEventListener('scroll', invalidate, { passive: true });
  const lose = event => { event.preventDefault(); lost = true; ++generation; onStatus('GPU-контекст потерян. Показаны исходные изображения.', false); };
  const restore = () => {
    lost = false; textures.clear(); slots.forEach(slot => { slot.texture = null; });
    try { initialize(); load(); } catch (error) { onStatus(error.message, false); }
  };
  canvas.addEventListener('webglcontextlost', lose); canvas.addEventListener('webglcontextrestored', restore);
  const motionChange = event => { if (event.matches) { paused = true; dirty = true; onStatus('Анимация остановлена: системная настройка уменьшения движения', true); } };
  reducedMotion.addEventListener('change', motionChange);
  request = requestAnimationFrame(tick);
  return {
    load,
    replay(id) { for(const slot of slots)if(slot.group==='emperor'&&(!id||slot.index===Number(id.slice(1))))slot.appearedAt=elapsed;dirty=true; },
    set(options) { if ('paused' in options) paused = options.paused; if ('speed' in options) speed = options.speed; if ('intensity' in options) intensity = options.intensity; dirty = true; },
    dispose() {
      disposed = true; ++generation; cancelAnimationFrame(request); observer.disconnect(); intersection.disconnect();
      window.removeEventListener('resize', invalidate); reducedMotion.removeEventListener('change', motionChange);
      if (visibleOnly) window.removeEventListener('scroll', invalidate);
      canvas.removeEventListener('webglcontextlost', lose); canvas.removeEventListener('webglcontextrestored', restore);
      for (const pending of textures.values()) pending.then(texture => gl.deleteTexture(texture), () => {});
      gl.deleteProgram(program);
    },
  };
}
