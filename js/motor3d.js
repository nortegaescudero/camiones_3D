/*
 * Motor 3D mínimo (WebGL) para esta web didáctica.
 * No necesita librerías externas ni conexión a internet.
 * Dibuja cajas, cilindros y líneas alineados con los ejes; cámara orbital con ratón y táctil.
 * Unidades: metros. Eje X = largo del vehículo, Y = altura, Z = anchura.
 */
(function () {
  'use strict';

  function hex(c) { return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]; }

  // ---------- matrices (column-major, como WebGL) ----------
  function perspectiva(fovy, aspecto, cerca, lejos) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (cerca - lejos);
    return [f / aspecto, 0, 0, 0, 0, f, 0, 0, 0, 0, (lejos + cerca) * nf, -1, 0, 0, 2 * lejos * cerca * nf, 0];
  }
  function mirarA(ojo, obj, arriba) {
    let zx = ojo[0] - obj[0], zy = ojo[1] - obj[1], zz = ojo[2] - obj[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = arriba[1] * zz - arriba[2] * zy, xy = arriba[2] * zx - arriba[0] * zz, xz = arriba[0] * zy - arriba[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * ojo[0] + xy * ojo[1] + xz * ojo[2]), -(yx * ojo[0] + yy * ojo[1] + yz * ojo[2]), -(zx * ojo[0] + zy * ojo[1] + zz * ojo[2]), 1];
  }
  function mult(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }

  // ---------- geometrías unitarias ----------
  function geoCaja() {
    const p = [], n = [], i = [];
    const caras = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
      [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]
    ];
    caras.forEach(([nn, u, v]) => {
      const b = p.length / 3;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => {
        p.push(0.5 * (nn[0] + a * u[0] + c * v[0]), 0.5 * (nn[1] + a * u[1] + c * v[1]), 0.5 * (nn[2] + a * u[2] + c * v[2]));
        n.push(nn[0], nn[1], nn[2]);
      });
      i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    return { p, n, i, modo: 'tri' };
  }
  function geoBordesCaja() {
    const p = [], n = [];
    for (let k = 0; k < 8; k++) { p.push(k & 1 ? .5 : -.5, k & 2 ? .5 : -.5, k & 4 ? .5 : -.5); n.push(0, 1, 0); }
    const i = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
    return { p, n, i, modo: 'lin' };
  }
  // cilindro de radio 1 y longitud 1 a lo largo del eje indicado ('z' o 'y')
  function geoCilindro(eje, seg) {
    const p = [], n = [], i = [];
    const pon = (a, b, c, na, nb, nc) => {
      if (eje === 'z') { p.push(a, b, c); n.push(na, nb, nc); } else { p.push(a, c, b); n.push(na, nc, nb); }
    };
    for (let s = 0; s <= seg; s++) {
      const t = s / seg * Math.PI * 2, x = Math.cos(t), y = Math.sin(t);
      pon(x, y, -0.5, x, y, 0); pon(x, y, 0.5, x, y, 0);
    }
    for (let s = 0; s < seg; s++) { const b = s * 2; i.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    [-0.5, 0.5].forEach(zc => {
      const c = p.length / 3; pon(0, 0, zc, 0, 0, Math.sign(zc));
      for (let s = 0; s <= seg; s++) { const t = s / seg * Math.PI * 2; pon(Math.cos(t), Math.sin(t), zc, 0, 0, Math.sign(zc)); }
      for (let s = 0; s < seg; s++) i.push(c, c + 1 + s, c + 2 + s);
    });
    return { p, n, i, modo: 'tri' };
  }
  function geoRejilla(x0, x1, z0, z1, paso) {
    const p = [], n = [], i = [];
    let k = 0;
    for (let x = x0; x <= x1 + 1e-6; x += paso) { p.push(x, 0, z0, x, 0, z1); n.push(0, 1, 0, 0, 1, 0); i.push(k, k + 1); k += 2; }
    for (let z = z0; z <= z1 + 1e-6; z += paso) { p.push(x0, 0, z, x1, 0, z); n.push(0, 1, 0, 0, 1, 0); i.push(k, k + 1); k += 2; }
    return { p, n, i, modo: 'lin' };
  }

  const VS = `
attribute vec3 aPos; attribute vec3 aNor;
uniform mat4 uVP; uniform vec3 uPos; uniform vec3 uEsc;
varying vec3 vN; varying vec3 vW;
void main(){
  vec3 w = aPos * uEsc + uPos; vW = w;
  vN = aNor / uEsc;
  gl_Position = uVP * vec4(w, 1.0);
}`;
  const FS = `
precision mediump float;
uniform vec3 uColor; uniform float uAlpha; uniform float uLuz; uniform vec3 uCam; uniform vec3 uFondo;
varying vec3 vN; varying vec3 vW;
void main(){
  vec3 c = uColor;
  if (uLuz > 0.5) {
    vec3 n = normalize(vN);
    vec3 L = normalize(vec3(0.45, 0.85, 0.35));
    float d = max(dot(n, L), 0.0);
    float h = 0.5 + 0.5 * n.y;
    c = uColor * (0.42 + 0.2 * h + 0.45 * d);
  }
  float f = clamp((length(vW - uCam) - 80.0) / 120.0, 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFondo, f), uAlpha);
}`;

  function Motor(canvas, opciones) {
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true }) ||
      canvas.getContext('experimental-webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('Sin WebGL');
    this.gl = gl; this.canvas = canvas;
    this.fondo = hex((opciones && opciones.fondo) || 0xe9eef3);
    this.grupos = [];
    this.fov = 40 * Math.PI / 180;
    this.cam = { theta: 0.7, phi: 1.1, dist: 30, target: [-8, 1.5, 0] };
    this.tween = null;
    this.alInteractuar = null;

    const sh = (tipo, src) => {
      const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    this.pr = pr;
    this.loc = {
      aPos: gl.getAttribLocation(pr, 'aPos'), aNor: gl.getAttribLocation(pr, 'aNor'),
      uVP: gl.getUniformLocation(pr, 'uVP'), uPos: gl.getUniformLocation(pr, 'uPos'), uEsc: gl.getUniformLocation(pr, 'uEsc'),
      uColor: gl.getUniformLocation(pr, 'uColor'), uAlpha: gl.getUniformLocation(pr, 'uAlpha'), uLuz: gl.getUniformLocation(pr, 'uLuz'),
      uCam: gl.getUniformLocation(pr, 'uCam'), uFondo: gl.getUniformLocation(pr, 'uFondo')
    };
    this.geo = {
      caja: this._subir(geoCaja()), bordes: this._subir(geoBordesCaja()),
      cilZ: this._subir(geoCilindro('z', 28)), cilY: this._subir(geoCilindro('y', 28))
    };
    this._controles();
  }

  Motor.prototype._subir = function (g) {
    const gl = this.gl;
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.p), gl.STATIC_DRAW);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.n), gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.i), gl.STATIC_DRAW);
    return { vb, nb, ib, n: g.i.length, modo: g.modo };
  };
  Motor.prototype.rejilla = function (x0, x1, z0, z1, paso) { return this._subir(geoRejilla(x0, x1, z0, z1, paso)); };

  // ---------- grupos y objetos ----------
  Motor.prototype.grupo = function (x, y, z) {
    const g = { offset: [x || 0, y || 0, z || 0], objs: [], visible: true };
    this.grupos.push(g); return g;
  };
  Motor.prototype.quitar = function (g) { const k = this.grupos.indexOf(g); if (k >= 0) this.grupos.splice(k, 1); };
  Motor.prototype.vaciar = function () { this.grupos = []; };

  // caja entre dos esquinas (x, y, z)
  Motor.prototype.caja = function (g, xa, xb, ya, yb, za, zb, color, o) {
    o = o || {};
    const obj = {
      geo: this.geo.caja, pos: [(xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2],
      esc: [Math.max(Math.abs(xa - xb), 1e-3), Math.max(Math.abs(yb - ya), 1e-3), Math.max(Math.abs(zb - za), 1e-3)],
      color: hex(color), alpha: o.alpha == null ? 1 : o.alpha, luz: 1, visible: true
    };
    g.objs.push(obj);
    if (o.bordes) {
      obj.bordes = { geo: this.geo.bordes, pos: obj.pos, esc: obj.esc, color: hex(o.bordes === true ? 0x3a4450 : o.bordes), alpha: 1, luz: 0, visible: true };
      g.objs.push(obj.bordes);
    }
    return obj;
  };
  // caja centrada en z (anchura total "ancho")
  Motor.prototype.cajaA = function (g, xa, xb, ya, yb, ancho, color, o) {
    const z = (o && o.z) || 0;
    return this.caja(g, xa, xb, ya, yb, z - ancho / 2, z + ancho / 2, color, o);
  };
  Motor.prototype.cilZ = function (g, x, y, z, r, largo, color) {
    const obj = { geo: this.geo.cilZ, pos: [x, y, z], esc: [r, r, largo], color: hex(color), alpha: 1, luz: 1, visible: true };
    g.objs.push(obj); return obj;
  };
  Motor.prototype.cilY = function (g, x, y, z, r, alto, color) {
    const obj = { geo: this.geo.cilY, pos: [x, y, z], esc: [r, alto, r], color: hex(color), alpha: 1, luz: 1, visible: true };
    g.objs.push(obj); return obj;
  };
  Motor.prototype.lineas = function (g, geo, color, alpha) {
    const obj = { geo, pos: [0, 0, 0], esc: [1, 1, 1], color: hex(color), alpha: alpha == null ? 1 : alpha, luz: 0, visible: true };
    g.objs.push(obj); return obj;
  };
  Motor.prototype.color = function (obj, c, alpha) {
    obj.color = hex(c); if (alpha != null) obj.alpha = alpha;
  };

  // ---------- cámara ----------
  Motor.prototype.posCamara = function (c) {
    c = c || this.cam;
    const s = Math.sin(c.phi);
    return [c.target[0] + c.dist * s * Math.sin(c.theta), c.target[1] + c.dist * Math.cos(c.phi), c.target[2] + c.dist * s * Math.cos(c.theta)];
  };
  Motor.prototype.aspecto = function () { return (this.canvas.clientWidth || 1) / (this.canvas.clientHeight || 1); };
  // distancia necesaria para que quepa un ancho horizontal "ancho" (m) en pantalla
  Motor.prototype.distParaAncho = function (ancho, altoTambien) {
    const hfov = 2 * Math.atan(Math.tan(this.fov / 2) * this.aspecto());
    let d = ancho / 2 / Math.tan(hfov / 2);
    if (altoTambien) d = Math.max(d, altoTambien / 2 / Math.tan(this.fov / 2));
    return d;
  };
  Motor.prototype.irA = function (destino, ms) {
    const d = { theta: destino.theta, phi: destino.phi, dist: destino.dist, target: destino.target.slice() };
    // tomar el camino angular más corto
    let dt = d.theta - this.cam.theta;
    while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
    d.theta = this.cam.theta + dt;
    if (!ms) { this.cam = d; this.tween = null; return; }
    this.tween = { a: JSON.parse(JSON.stringify(this.cam)), b: d, t0: performance.now(), ms };
  };

  Motor.prototype._controles = function () {
    const cv = this.canvas, cam = () => this.cam;
    const punteros = new Map();
    let distPellizco = 0;
    const avisar = () => { this.tween = null; if (this.alInteractuar) this.alInteractuar(); };
    const desplazar = (dx, dy) => {
      const c = cam(), k = c.dist * 0.0016;
      const rx = Math.cos(c.theta), rz = -Math.sin(c.theta);      // vector derecha
      const fx = -Math.sin(c.theta), fz = -Math.cos(c.theta);     // vector adelante (suelo)
      c.target[0] -= (rx * dx - fx * dy) * k;
      c.target[2] -= (rz * dx - fz * dy) * k;
    };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY, boton: e.button, mayus: e.shiftKey });
      if (punteros.size === 2) { const [a, b] = [...punteros.values()]; distPellizco = Math.hypot(a.x - b.x, a.y - b.y); }
      avisar();
    });
    cv.addEventListener('pointermove', e => {
      const p = punteros.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (punteros.size === 1) {
        if (p.boton === 2 || p.boton === 1 || e.shiftKey) desplazar(dx, dy);
        else {
          const c = cam();
          c.theta -= dx * 0.008;
          c.phi = Math.min(1.53, Math.max(0.03, c.phi - dy * 0.008));
        }
      } else if (punteros.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...punteros.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (distPellizco > 0) { const c = cam(); c.dist = Math.min(140, Math.max(2.5, c.dist * distPellizco / d)); }
        distPellizco = d;
        desplazar(dx / 2, dy / 2);
        return;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const fin = e => { punteros.delete(e.pointerId); distPellizco = 0; };
    cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
    cv.addEventListener('wheel', e => {
      e.preventDefault(); avisar();
      const c = cam(); c.dist = Math.min(140, Math.max(2.5, c.dist * Math.exp(e.deltaY * 0.0012)));
    }, { passive: false });
  };

  // ---------- dibujo ----------
  Motor.prototype.dibujar = function () {
    const gl = this.gl, cv = this.canvas, L = this.loc;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);

    if (this.tween) {
      const tw = this.tween; let k = Math.min(1, (performance.now() - tw.t0) / tw.ms);
      const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const lerp = (a, b) => a + (b - a) * e;
      this.cam = {
        theta: lerp(tw.a.theta, tw.b.theta), phi: lerp(tw.a.phi, tw.b.phi), dist: lerp(tw.a.dist, tw.b.dist),
        target: [0, 1, 2].map(j => lerp(tw.a.target[j], tw.b.target[j]))
      };
      if (k >= 1) this.tween = null;
    }
    const ojo = this.posCamara();
    const arriba = this.cam.phi < 0.05 ? [-Math.sin(this.cam.theta), 0, -Math.cos(this.cam.theta)] : [0, 1, 0];
    const P = perspectiva(this.fov, w / h, 0.1, 400);
    const V = mirarA(ojo, this.cam.target, arriba);
    this.VP = mult(P, V); this.ojo = ojo;

    gl.clearColor(this.fondo[0], this.fondo[1], this.fondo[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
    gl.useProgram(this.pr);
    gl.uniformMatrix4fv(L.uVP, false, new Float32Array(this.VP));
    gl.uniform3fv(L.uCam, ojo); gl.uniform3fv(L.uFondo, this.fondo);
    gl.enableVertexAttribArray(L.aPos); gl.enableVertexAttribArray(L.aNor);

    const opacos = [], transp = [];
    for (const g of this.grupos) {
      if (!g.visible) continue;
      for (const o of g.objs) {
        if (!o.visible || o.alpha <= 0) continue;
        const wp = [o.pos[0] + g.offset[0], o.pos[1] + g.offset[1], o.pos[2] + g.offset[2]];
        (o.alpha < 1 ? transp : opacos).push([o, wp]);
      }
    }
    let geoActual = null;
    const pinta = ([o, wp]) => {
      if (o.geo !== geoActual) {
        geoActual = o.geo;
        gl.bindBuffer(gl.ARRAY_BUFFER, o.geo.vb); gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, o.geo.nb); gl.vertexAttribPointer(L.aNor, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.geo.ib);
      }
      gl.uniform3fv(L.uPos, wp); gl.uniform3fv(L.uEsc, o.esc);
      gl.uniform3fv(L.uColor, o.color); gl.uniform1f(L.uAlpha, o.alpha); gl.uniform1f(L.uLuz, o.luz);
      gl.drawElements(o.geo.modo === 'lin' ? gl.LINES : gl.TRIANGLES, o.geo.n, gl.UNSIGNED_SHORT, 0);
    };
    opacos.forEach(pinta);
    if (transp.length) {
      const d2 = p => (p[0] - ojo[0]) ** 2 + (p[1] - ojo[1]) ** 2 + (p[2] - ojo[2]) ** 2;
      transp.sort((a, b) => d2(b[1]) - d2(a[1]));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      transp.forEach(pinta);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
  };

  // proyecta un punto del mundo a píxeles CSS del canvas; null si queda detrás de la cámara
  Motor.prototype.proyectar = function (x, y, z) {
    const m = this.VP; if (!m) return null;
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.05) return null;
    return [(cx / cw + 1) / 2 * this.canvas.clientWidth, (1 - cy / cw) / 2 * this.canvas.clientHeight];
  };

  window.Motor3D = Motor;
})();
