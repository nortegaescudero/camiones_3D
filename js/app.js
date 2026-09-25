/*
 * Camiones de mercancías en 3D — lógica de la web.
 * Datos legales: Anexo IX del Reglamento General de Vehículos (Orden PJC/780/2025).
 * Datos de mercado (orientativos): medidas interiores del semirremolque y taras.
 */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const dec = (n, d) => n.toFixed(d == null ? 2 : d).replace('.', ',');
  const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const ahora = () => performance.now();

  // ------------------------------------------------------------------
  //  DATOS
  // ------------------------------------------------------------------
  const MMA = 44;                       // t, articulado de 5 ejes (Anexo IX, tabla 2)
  const ANCHO_EXT = 2.55;               // m (Anexo IX, tabla 3)
  const INT = { largo: 13.60, ancho: 2.48 };   // dato de mercado
  const SEMI = {
    estandar: { suelo: 1.25, techo: 3.95, rueda: 0.53, nombre: 'Estándar', altoPale: 1.30 },
    mega: { suelo: 0.95, techo: 3.95, rueda: 0.40, nombre: '«Mega»', altoPale: 1.45 }
  };
  const PALES = {
    euro: { nombre: 'Europeo', medida: '1.200 × 800 mm', l: 1.2, a: 0.8, color: 0xd9a441 },
    usa: { nombre: 'Americano', medida: '1.200 × 1.000 mm', l: 1.2, a: 1.0, color: 0x4f9d69 }
  };

  const C = {
    cabina: 0x2f6fb5, cabinaOsc: 0x1f4a7a, cristal: 0x223140, faro: 0xfff4cc,
    chasis: 0x2b3038, neumatico: 0x1c1c1e, llanta: 0xb9c0c9, deposito: 0x8d97a3,
    caja: 0xf1f3f6, lona: 0xdfe6ee, suelo: 0x6b5b4a, plataforma: 0x55606d,
    madera: 0xb58050, maderaOsc: 0x8a5f37, rampa: 0x7b8591, voladizo: 0xe07b24,
    cota: 0x1d3557, rojo: 0xd64545, verde: 0x2f8a4f, azulSuave: 0x2563a8
  };

  // ------------------------------------------------------------------
  //  MOTOR
  // ------------------------------------------------------------------
  const canvas = $('#escena');
  let M;
  try { M = new window.Motor3D(canvas, { fondo: 0xe9eef3 }); }
  catch (e) { $('#aviso-webgl').hidden = false; console.error(e); return; }

  const rejillaGeo = M.rejilla(-40, 16, -24, 14, 1);

  // etiquetas HTML proyectadas sobre la escena
  const capa = $('#etiquetas');
  let etiquetas = [];
  function etiqueta(g, x, y, z, html, clase) {
    const el = document.createElement('div');
    el.className = 'etq ' + (clase || '');
    el.innerHTML = html;
    capa.appendChild(el);
    const e = { el, g, p: [x, y, z], visible: true };
    etiquetas.push(e); return e;
  }
  function actualizarEtiquetas() {
    for (const e of etiquetas) {
      const o = e.g ? e.g.offset : [0, 0, 0];
      const s = e.visible && (!e.g || e.g.visible) ? M.proyectar(e.p[0] + o[0], e.p[1] + o[1], e.p[2] + o[2]) : null;
      if (!s) { e.el.style.display = 'none'; continue; }
      e.el.style.display = '';
      e.el.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%, -50%)`;
    }
  }

  function limpiar() {
    M.vaciar();
    etiquetas.forEach(e => e.el.remove()); etiquetas = [];
    animaciones = [];
    // suelo, carretera y cuadrícula de 1 m
    const s = M.grupo();
    M.caja(s, -120, 80, -0.06, 0, -80, 60, 0xdfe4ea);
    M.caja(s, -120, 80, -0.02, 0.001, -26, 8, 0xd2d8e0);
    M.lineas(s, rejillaGeo, 0xbfc7d1);
  }

  // ------------------------------------------------------------------
  //  PIEZAS DE VEHÍCULO
  // ------------------------------------------------------------------
  function sombra(g, xa, xb, ancho) { M.cajaA(g, xa + 0.2, xb - 0.2, 0.002, 0.006, ancho + 0.3, 0x000000, { alpha: 0.10 }); }

  function rueda(g, x, r, z, ancho) {
    M.cilZ(g, x, r, z, r, ancho, C.neumatico);
    M.cilZ(g, x, r, z, r * 0.58, ancho + 0.02, C.llanta);
    M.cilZ(g, x, r, z, r * 0.2, ancho + 0.05, C.chasis);
  }
  function eje(g, x, r, gemelas) {
    const ancho = gemelas ? 0.6 : 0.4;
    const zc = ANCHO_EXT / 2 - ancho / 2 - 0.03;
    rueda(g, x, r, zc, ancho); rueda(g, x, r, -zc, ancho);
    M.cilZ(g, x, r, 0, 0.07, zc * 2, C.chasis);
    // guardabarros
    M.cajaA(g, x + r + 0.12, x - r - 0.12, r * 2 + 0.06, r * 2 + 0.1, ANCHO_EXT - 0.02, C.chasis, { alpha: 1 });
  }
  function cabina(g, alto) {
    alto = alto || 3.85;
    const a = 2.5;
    M.cajaA(g, 0, -2.3, 1.05, alto, a, C.cabina, { bordes: C.cabinaOsc });
    M.cajaA(g, 0.025, -0.02, alto - 1.35, alto - 0.3, a - 0.3, C.cristal);                       // parabrisas
    [-1, 1].forEach(s => M.caja(g, -0.2, -1.05, alto - 1.25, alto - 0.35, s * a / 2, s * (a / 2 + 0.02), C.cristal));
    M.cajaA(g, 0.07, -0.3, 0.5, 1.05, a, C.cabinaOsc);                                            // parachoques
    [-1, 1].forEach(s => M.cajaA(g, 0.1, 0.05, 0.72, 0.9, 0.38, C.faro, { z: s * 0.9 }));        // faros
    M.cajaA(g, 0.035, -0.01, 1.2, Math.max(1.5, alto - 1.55), 1.4, C.cabinaOsc);                 // rejilla
    [-1, 1].forEach(s => M.cajaA(g, 0.05, -0.12, alto - 1.1, alto - 0.75, 0.08, C.chasis, { z: s * 1.34 })); // retrovisores
  }
  function bordesCaja(g, xa, xb, ya, yb) { M.cajaA(g, xa, xb, ya, yb, ANCHO_EXT, 0x000000, { alpha: 0, bordes: 0x4a5563 }); }

  // ---------- tractocamión + semirremolque de 3 ejes (16,50 m) ----------
  // Delante en x = 0; el vehículo se extiende hacia x negativas.
  function construirArticulado(g, o) {
    o = o || {};
    const s = SEMI[o.semi || 'estandar'];
    const transparente = !!o.transparente;
    sombra(g, 0, -16.5, ANCHO_EXT);
    // tractora
    cabina(g);
    M.cajaA(g, -0.2, -6.1, 0.55, Math.min(1.05, s.suelo - 0.2), 0.95, C.chasis);
    [-1, 1].forEach(z => M.cajaA(g, -2.45, -3.7, 0.5, Math.min(1.15, s.suelo - 0.2), 0.45, C.deposito, { z: z * 0.95 }));
    M.cilY(g, -4.5, s.suelo - 0.23, 0, 0.45, 0.06, C.chasis);   // quinta rueda
    const rt = o.semi === 'mega' ? 0.42 : 0.53;   // la tractora «mega» lleva ruedas más bajas
    eje(g, -1.4, rt, false);
    eje(g, -4.85, rt, true);
    // semirremolque: exterior de -2.8 a -16.5 (13,70 m) ; interior 13,60 m
    const xf = -2.8, xr = -16.5, suelo = s.suelo;
    M.cajaA(g, xf, xr, suelo - 0.16, suelo, ANCHO_EXT, C.plataforma);
    M.cajaA(g, xf - 0.3, xr + 0.35, suelo - 0.45, suelo - 0.16, 1.0, C.chasis);
    [-1, 1].forEach(z => M.cajaA(g, -5.9, -6.05, 0.05, suelo - 0.45, 0.1, C.chasis, { z: z * 0.8 }));   // patas de apoyo
    const r = s.rueda;
    // trídem: ejes separados 1,31 m (más de 1,30 m → 27 t; con 1,30 m o menos solo serían 21 t)
    [-13.0, -14.31, -15.62].forEach(x => eje(g, x, r, false));
    M.cajaA(g, -16.28, -16.45, 0.42, 0.58, 2.35, C.chasis);    // antiempotramiento
    // carrocería (lona)
    const pared = transparente ? { alpha: 0.13 } : {};
    M.cajaA(g, xf, xf - 0.05, suelo, 4.0, ANCHO_EXT, C.caja, transparente ? { alpha: 0.35 } : {});
    [-1, 1].forEach(z => M.caja(g, xf, xr, suelo, 4.0, z * ANCHO_EXT / 2, z * (ANCHO_EXT / 2 - 0.035), C.lona, pared));
    M.cajaA(g, xf, xr, 3.95, 4.0, ANCHO_EXT, C.lona, transparente ? { alpha: 0.07 } : {});
    if (!transparente) M.cajaA(g, xr + 0.05, xr, suelo, 3.95, ANCHO_EXT, C.caja);
    bordesCaja(g, xf, xr, suelo, 4.0);
    // bandas de la lona (solo opaca)
    if (!transparente) [-1, 1].forEach(z => M.caja(g, xf - 0.1, xr + 0.1, suelo + 0.05, suelo + 0.25, z * (ANCHO_EXT / 2 + 0.005), z * (ANCHO_EXT / 2 - 0.01), C.azulSuave));
    return { xf: xf - 0.05, xr: xr + 0.05, suelo, techo: s.techo };
  }

  // ---------- muelle de carga detrás del semirremolque ----------
  function muelle(g, int) {
    const x0 = -16.5, x1 = -21.4, y = int.suelo;
    M.caja(g, x0, x1, 0, y, -2.0, 2.0, 0xc7cdd5, { bordes: 0x8d97a3 });
    M.caja(g, x0, x0 - 0.2, y - 0.03, y + 0.004, -2.0, 2.0, 0xf2c230);                 // borde de seguridad
    M.cajaA(g, x0 + 0.25, x0 - 0.45, y, y + 0.025, 2.1, 0x9aa3ad, { bordes: 0x6b7480 }); // rampa niveladora
    [-1, 1].forEach(z => M.caja(g, x0 + 0.02, x0 - 0.12, y - 0.55, y - 0.15, z * 1.05, z * 1.35, 0x2b3038)); // topes
    etiqueta(g, -19.4, y + 0.15, -1.5, `Muelle de carga · ${dec(y)} m`, 'suave');
  }

  // ---------- camión rígido de 3 ejes (12,00 m) ----------
  function construirRigido(g) {
    sombra(g, 0, -12, ANCHO_EXT);
    cabina(g);
    M.cajaA(g, -0.2, -11.8, 0.8, 1.05, 0.95, C.chasis);
    M.cajaA(g, -2.5, -12, 1.1, 1.25, ANCHO_EXT, C.plataforma);
    M.cajaA(g, -2.5, -12, 1.25, 4.0, ANCHO_EXT, C.caja);
    bordesCaja(g, -2.5, -12, 1.25, 4.0);
    M.caja(g, -2.6, -11.9, 1.3, 1.5, ANCHO_EXT / 2, ANCHO_EXT / 2 + 0.01, C.azulSuave);
    M.caja(g, -2.6, -11.9, 1.3, 1.5, -ANCHO_EXT / 2 - 0.01, -ANCHO_EXT / 2, C.azulSuave);
    [-1, 1].forEach(z => M.cajaA(g, -2.6, -3.7, 0.55, 1.1, 0.45, C.deposito, { z: z * 0.95 }));
    eje(g, -1.5, 0.53, false); eje(g, -7.25, 0.53, true); eje(g, -8.6, 0.53, true);
    M.cajaA(g, -11.78, -11.95, 0.42, 0.58, 2.35, C.chasis);
  }

  // ---------- tren de carretera: camión 3 ejes + remolque 2 ejes (18,75 m) ----------
  function construirTren(g) {
    sombra(g, 0, -18.75, ANCHO_EXT);
    cabina(g);
    M.cajaA(g, -0.2, -9.9, 0.8, 1.05, 0.95, C.chasis);
    M.cajaA(g, -2.5, -10.0, 1.1, 1.25, ANCHO_EXT, C.plataforma);
    M.cajaA(g, -2.5, -10.0, 1.25, 4.0, ANCHO_EXT, C.caja);
    bordesCaja(g, -2.5, -10.0, 1.25, 4.0);
    eje(g, -1.5, 0.53, false); eje(g, -6.2, 0.53, true); eje(g, -7.55, 0.53, true);
    M.cajaA(g, -9.8, -12.5, 0.62, 0.74, 0.22, C.chasis);    // lanza
    // remolque
    M.cajaA(g, -10.75, -18.6, 0.8, 1.1, 1.0, C.chasis);
    M.cajaA(g, -10.75, -18.75, 1.1, 1.25, ANCHO_EXT, C.plataforma);
    M.cajaA(g, -10.75, -18.75, 1.25, 4.0, ANCHO_EXT, C.caja);
    bordesCaja(g, -10.75, -18.75, 1.25, 4.0);
    eje(g, -12.5, 0.53, true); eje(g, -17.2, 0.53, true);
    M.cajaA(g, -18.5, -18.7, 0.42, 0.58, 2.35, C.chasis);
    [[-2.6, -9.9], [-10.85, -18.65]].forEach(([a, b]) => [-1, 1].forEach(z =>
      M.caja(g, a, b, 1.3, 1.5, z * ANCHO_EXT / 2, z * (ANCHO_EXT / 2 + 0.01), C.azulSuave)));
  }

  // ---------- tren portavehículos (20,55 m cargado con voladizo) ----------
  const COLORES_COCHE = [0xc0392b, 0x34495e, 0xe9edf1, 0x7f8c8d, 0x2e86c1, 0x16a085, 0xf1c40f, 0x8e44ad];
  function coche(g, x0, y, color) {
    const L = 3.9;
    M.cajaA(g, x0, x0 - L, y + 0.2, y + 0.75, 1.75, color, { bordes: 0x2b3038 });
    M.cajaA(g, x0 - 1.0, x0 - 3.05, y + 0.75, y + 1.3, 1.55, color);
    M.cajaA(g, x0 - 0.95, x0 - 3.1, y + 0.82, y + 1.22, 1.57, C.cristal);
    [x0 - 0.75, x0 - L + 0.8].forEach(x => [-1, 1].forEach(z => M.cilZ(g, x, y + 0.3, z * 0.78, 0.3, 0.22, C.neumatico)));
  }
  function construirPortavehiculos(g) {
    sombra(g, 0, -20.55, ANCHO_EXT);
    cabina(g, 3.05);
    const deckAlto = 3.12;
    // camión
    M.cajaA(g, -0.2, -10.3, 0.75, 0.95, 0.95, C.chasis);
    M.cajaA(g, -2.4, -10.3, 0.95, 1.05, 2.45, C.rampa);                 // piso inferior
    M.cajaA(g, 0.0, -10.3, deckAlto, deckAlto + 0.08, 2.45, C.rampa);   // piso superior
    [-2.45, -5.4, -8.3, -10.25].forEach(x => [-1, 1].forEach(z => M.cajaA(g, x, x - 0.1, 1.05, deckAlto, 0.1, C.chasis, { z: z * 1.2 })));
    eje(g, -1.4, 0.5, false); eje(g, -6.3, 0.5, true); eje(g, -7.6, 0.5, true);
    M.cajaA(g, -10.2, -12.9, 0.55, 0.66, 0.22, C.chasis);               // lanza
    // remolque
    M.cajaA(g, -11.1, -19.3, 0.7, 0.95, 1.0, C.chasis);
    M.cajaA(g, -11.1, -19.3, 0.95, 1.05, 2.45, C.rampa);
    M.cajaA(g, -11.1, -19.3, deckAlto, deckAlto + 0.08, 2.45, C.rampa);
    M.cajaA(g, -19.3, -19.8, deckAlto, deckAlto + 0.08, 2.1, C.voladizo, { bordes: 0x8a4410 });  // voladizo trasero
    [-11.15, -15.15, -19.2].forEach(x => [-1, 1].forEach(z => M.cajaA(g, x, x - 0.1, 1.05, deckAlto, 0.1, C.chasis, { z: z * 1.2 })));
    eje(g, -12.9, 0.5, true); eje(g, -18.0, 0.5, true);
    // coches (8)
    const yb = 1.05, ya = deckAlto + 0.08;
    let k = 0;
    const pon = (x, y) => coche(g, x, y, COLORES_COCHE[k++ % COLORES_COCHE.length]);
    pon(-2.5, yb); pon(-6.45, yb);
    pon(0.0, ya); pon(-4.1, ya);
    pon(-11.15, yb); pon(-15.2, yb);
    pon(-11.15, ya); pon(-16.65, ya);     // el último sobresale hasta -20,55
  }

  // ---------- cotas ----------
  function cotas(g, L, H, opts) {
    opts = opts || {};
    const W = ANCHO_EXT, zs = W / 2 + 1.1, t = 0.035;
    // longitud
    M.caja(g, 0, -L, 0.02, 0.08, zs - t, zs + t, C.cota);
    [0, -L].forEach(x => M.caja(g, x + t, x - t, 0.02, 0.9, zs - t, zs + t, C.cota));
    [0, -L].forEach(x => M.caja(g, x + 0.02, x - 0.02, 0.02, 0.05, W / 2, zs, C.cota, { alpha: 0.5 }));
    etiqueta(g, -L / 2, 0.35, zs, `Longitud <b>${dec(L)} m</b>`, 'cota');
    // altura
    const xh = -L - 1.0;
    M.caja(g, xh + t, xh - t, 0, H, W / 2 - t, W / 2 + t, C.cota);
    [0, H].forEach(y => M.caja(g, xh + 0.35, xh - 0.35, y - t, y + t, W / 2 - t, W / 2 + t, C.cota));
    etiqueta(g, xh, H / 2, W / 2, `Altura <b>${dec(H)} m</b>`, 'cota');
    // anchura
    if (!opts.sinAncho) {
      const xa = -L - 0.35, ya = H + 0.35;
      M.caja(g, xa + t, xa - t, ya - t, ya + t, -W / 2, W / 2, C.cota);
      [-W / 2, W / 2].forEach(z => M.caja(g, xa + t, xa - t, ya - 0.25, ya + 0.25, z - t, z + t, C.cota));
      etiqueta(g, xa, ya + 0.45, 0, `Anchura <b>2,55 m</b>`, 'cota');
    }
  }

  // ------------------------------------------------------------------
  //  VEHÍCULOS (pestaña 1)
  // ------------------------------------------------------------------
  const VEH = {
    rigido: {
      nombre: 'Camión rígido', sub: '3 ejes · un solo vehículo', L: 12.00, H: 4.00, build: construirRigido,
      ejes: '3 (también de 2 y de 4)', mma: '25 t', mmaNota: '26 t con ruedas gemelas y suspensión neumática. 2 ejes: 18 t · 4 ejes: 31-32 t',
      uso: 'Distribución regional, obras y reparto.'
    },
    articulado: {
      nombre: 'Vehículo articulado', sub: 'Tractocamión + semirremolque · el más habitual', L: 16.50, H: 4.00, build: g => construirArticulado(g),
      ejes: '5 (tractora 2 + semirremolque 3)', mma: '44 t', mmaNota: 'Desde el 23/10/2025 (antes 40 t)',
      uso: 'Larga distancia y carga paletizada.'
    },
    tren: {
      nombre: 'Tren de carretera', sub: 'Camión + remolque con lanza', L: 18.75, H: 4.00, build: construirTren,
      ejes: '5 (camión 3 + remolque 2)', mma: '44 t', mmaNota: 'Con camión de 2 ejes y remolque de 3: 42 t',
      uso: 'Carga voluminosa y cajas móviles.'
    },
    porta: {
      nombre: 'Portavehículos', sub: 'Tren de carretera especializado', L: 20.55, H: 4.50, build: construirPortavehiculos,
      ejes: '5 (camión 3 + remolque 2)', mma: '44 t', mmaNota: 'Según ejes: de 36 a 44 t',
      uso: 'Transporte de turismos y furgonetas.',
      nota: '<b>20,55 m</b> solo circulando <b>cargado</b> y con <b>voladizo trasero autorizado</b> (en naranja). En vacío, 18,75 m. El coche puede sobresalir por detrás si su último eje apoya en el remolque; nunca por delante de la cabina. Altura máxima <b>4,50 m</b>.'
    }
  };
  const ORDEN_VEH = ['rigido', 'articulado', 'tren', 'porta'];

  // ------------------------------------------------------------------
  //  PALÉS
  // ------------------------------------------------------------------
  // girado = false: lado de 1,20 m en el sentido de la marcha para el europeo,
  //                 lado de 1,00 m en el sentido de la marcha para el americano (disposiciones habituales)
  function distribucion(tipo, girado) {
    const p = PALES[tipo];
    let lx, az;
    if (tipo === 'euro') { lx = girado ? p.a : p.l; az = girado ? p.l : p.a; }
    else { lx = girado ? p.l : p.a; az = girado ? p.a : p.l; }
    const porFila = Math.floor(INT.ancho / az + 1e-9);
    const filas = Math.floor(INT.largo / lx + 1e-9);
    const usado = filas * lx;
    return { tipo, lx, az, porFila, filas, total: porFila * filas, usado, sobra: INT.largo - usado, anchoUsado: porFila * az, sobraAncho: INT.ancho - porFila * az };
  }
  function posiciones(d, xf) {
    const out = [];
    for (let f = 0; f < d.filas; f++) for (let c = 0; c < d.porFila; c++) {
      out.push({ x: xf - d.lx / 2 - f * d.lx, z: (c - (d.porFila - 1) / 2) * d.az, fila: f });
    }
    return out;
  }
  // palé con carga; origen en el centro de la base (suelo)
  // pequeña variación de tono para que la carga no parezca un bloque uniforme
  function variar(color, k) {
    const f = 0.93 + 0.1 * ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const c = [(color >> 16) & 255, (color >> 8) & 255, color & 255].map(v => Math.min(255, Math.round(v * f)));
    return (c[0] << 16) | (c[1] << 8) | c[2];
  }
  let nPale = 0;
  function crearPale(lx, az, altoTotal, colorCarga) {
    const g = M.grupo();
    colorCarga = variar(colorCarga, ++nPale);
    g.colorBase = colorCarga;
    const lb = lx - 0.02, ab = az - 0.02;
    M.cajaA(g, lb / 2, -lb / 2, 0, 0.022, ab, C.maderaOsc);
    [-1, 0, 1].forEach(k => M.cajaA(g, lb / 2, -lb / 2, 0.022, 0.122, 0.1, C.madera, { z: k * (ab / 2 - 0.05) }));
    M.cajaA(g, lb / 2, -lb / 2, 0.122, 0.144, ab, C.madera, { bordes: C.maderaOsc });
    const carga = M.cajaA(g, lb / 2 - 0.02, -lb / 2 + 0.02, 0.144, altoTotal, ab - 0.04, colorCarga, { bordes: 0x5b4a2a });
    g.carga = carga;
    return g;
  }
  // palé que no se puede cargar: semitransparente y en rojo
  function fantasma(pg, on) {
    pg.objs.forEach(o => { if (o !== pg.carga) o.alpha = on ? 0.22 : 1; });
    M.color(pg.carga, on ? C.rojo : pg.colorBase, on ? 0.3 : 1);
    if (pg.carga.bordes) pg.carga.bordes.alpha = on ? 0.35 : 1;
  }

  // animaciones de palés: {g, de:[x,y,z], a:[x,y,z], t0, ms, fin}
  let animaciones = [];
  function animar(g, de, a, t0, ms, alTerminar) {
    g.offset = de.slice(); g.visible = false;
    animaciones.push({ g, de, a, t0, ms, alTerminar, hecho: false });
  }
  function pasoAnimaciones() {
    const t = ahora();
    for (const an of animaciones) {
      if (an.hecho) continue;
      if (t < an.t0) continue;
      an.g.visible = true;
      let k = Math.min(1, (t - an.t0) / an.ms);
      const e = 1 - Math.pow(1 - k, 3);
      for (let j = 0; j < 3; j++) an.g.offset[j] = an.de[j] + (an.a[j] - an.de[j]) * e;
      if (k >= 1) { an.hecho = true; if (an.alTerminar) an.alTerminar(); }
    }
  }

  // ------------------------------------------------------------------
  //  CÁMARA: vistas
  // ------------------------------------------------------------------
  let foco = { cx: -8.25, cz: 0, L: 16.5, H: 4 };
  function vista(nombre, ms) {
    const f = foco, t = [f.cx, f.H * 0.45, f.cz];
    let v;
    if (nombre === 'lateral') v = { theta: 0, phi: 1.5, dist: M.distParaAncho(f.L + 5, f.H + 3), target: t };
    else if (nombre === 'superior') v = { theta: 0, phi: 0.02, dist: M.distParaAncho(f.L + 4, (f.W || 4) + 6), target: [f.cx, 0, f.cz] };
    else if (nombre === 'trasera') v = { theta: -Math.PI / 2 + 0.28, phi: 1.3, dist: f.L / 2 + 10, target: [f.cx - f.L * 0.1, f.H * 0.5, f.cz] };
    else v = { theta: f.theta3d != null ? f.theta3d : 0.62, phi: 1.12, dist: M.distParaAncho(f.L + 3, f.H + 6) * 1.02, target: t };
    M.irA(v, ms == null ? 900 : ms);
    $$('.vistas [data-vista]').forEach(b => b.classList.toggle('activa', b.dataset.vista === nombre));
  }
  M.alInteractuar = () => $$('.vistas [data-vista]').forEach(b => b.classList.remove('activa'));
  $$('.vistas [data-vista]').forEach(b => b.addEventListener('click', () => vista(b.dataset.vista)));

  // pantalla completa (útil con el proyector)
  const btnPantalla = $('#btn-pantalla');
  const raiz = document.documentElement;
  if (!raiz.requestFullscreen) btnPantalla.hidden = true;
  btnPantalla.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else raiz.requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    btnPantalla.classList.toggle('activa', on);
    btnPantalla.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa');
    btnPantalla.title = on ? 'Salir de pantalla completa' : 'Pantalla completa';
  });

  // ------------------------------------------------------------------
  //  ESTADO Y PESTAÑAS
  // ------------------------------------------------------------------
  const E = {
    tab: 'tipos', veh: 'articulado', comparar: false,
    cargaTipo: 'euro', cargaGirado: false,
    pesoTipo: 'euro', kg: 800, tara: 15,
    remSemi: 'estandar', remTipo: 'euro'
  };
  const panel = $('#panel');

  $$('.pestana').forEach(b => b.addEventListener('click', () => irPestana(b.dataset.tab)));
  function irPestana(t) {
    E.tab = t;
    $$('.pestana').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('activa', on); b.setAttribute('aria-selected', on); });
    ({ tipos: pestanaTipos, carga: pestanaCarga, peso: pestanaPeso, remonte: pestanaRemonte })[t]();
  }
  const seg = (grupo, opciones, actual) => `<div class="segmentado" data-grupo="${grupo}">` +
    opciones.map(([v, txt, sub]) => `<button data-v="${v}" class="${v === actual ? 'activa' : ''}">${txt}${sub ? `<small>${sub}</small>` : ''}</button>`).join('') + '</div>';
  function alElegir(grupo, fn) {
    const el = $(`[data-grupo="${grupo}"]`, panel); if (!el) return;
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', el).forEach(x => x.classList.toggle('activa', x === b));
      fn(b.dataset.v);
    });
  }

  // ==================================================================
  //  PESTAÑA 1 — TIPOS DE CAMIÓN
  // ==================================================================
  function pestanaTipos() {
    panel.innerHTML = `
      <h2>Tipos de camión</h2>
      <p class="intro">Los camiones de más de 7,5 t, modelados a escala real. Elige uno o compáralos juntos.</p>
      ${seg('veh', ORDEN_VEH.map(k => [k, VEH[k].nombre, dec(VEH[k].L) + ' m']), E.comparar ? '' : E.veh).replace('class="segmentado"', 'class="segmentado vertical"')}
      <div class="botones"><button class="btn ${E.comparar ? 'activo' : ''}" id="btn-comparar">Comparar los cuatro a escala</button></div>
      <div id="ficha"></div>
      <p class="fuente">Fuente: Anexo IX del Reglamento General de Vehículos (tablas 2 y 3), redacción de la Orden PJC/780/2025. Anchura general 2,55 m; vehículos frigoríficos, 2,60 m.</p>`;
    alElegir('veh', v => { E.veh = v; E.comparar = false; $('#btn-comparar').classList.remove('activo'); escenaTipos(); });
    $('#btn-comparar').addEventListener('click', () => {
      E.comparar = true; $('#btn-comparar').classList.add('activo');
      $$('[data-grupo="veh"] button', panel).forEach(x => x.classList.remove('activa'));
      escenaTipos();
    });
    escenaTipos();
  }
  function fichaVehiculo(k) {
    const v = VEH[k];
    return `<div class="ficha">
      <div class="cab"><b>${v.nombre}</b><span>${v.sub}</span></div>
      <dl>
        <dt>Ejes</dt><dd>${v.ejes}</dd>
        <dt>Longitud máx.</dt><dd>${dec(v.L)} m</dd>
        <dt>Anchura máx.</dt><dd>2,55 m</dd>
        <dt>Altura máx.</dt><dd>${dec(v.H)} m</dd>
        <dt>MMA máx.</dt><dd>${v.mma}</dd>
      </dl></div>
      <p style="margin-top:10px">${v.mmaNota}.</p>
      <p><b>Uso típico:</b> ${v.uso}</p>
      ${v.nota ? `<div class="estado info">${v.nota}</div>` : ''}`;
  }
  function escenaTipos() {
    limpiar();
    if (!E.comparar) {
      const v = VEH[E.veh];
      const g = M.grupo();
      v.build(g);
      cotas(g, v.L, v.H);
      etiqueta(g, -1.2, v.H + 0.9, 0, v.nombre, 'nombre');
      if (E.veh === 'porta') {
        etiqueta(g, -19.55, 3.6, 1.3, 'Voladizo trasero autorizado', 'aviso');
        etiqueta(g, -17.2, 0.6, 1.9, 'Remolque', 'suave');
      }
      if (E.veh === 'tren') etiqueta(g, -11.2, 0.5, 1.6, 'Lanza', 'suave');
      if (E.veh === 'articulado') {
        etiqueta(g, -4.5, 0.4, 1.8, 'Quinta rueda', 'suave');
        etiqueta(g, -14.31, 1.5, 1.6, 'Trídem · ejes cada 1,31 m', 'suave');
      }
      foco = { cx: -v.L / 2 - 0.5, cz: 0, L: v.L + 2, H: v.H, W: 5 };
      $('#ficha').innerHTML = fichaVehiculo(E.veh);
      vista('3d');
    } else {
      const sep = 5.2;
      ORDEN_VEH.forEach((k, i) => {
        const v = VEH[k], z = -i * sep;
        const g = M.grupo(0, 0, z);
        v.build(g);
        etiqueta(g, -1.4, v.H + 0.8, 0, v.nombre, 'nombre');
        M.caja(g, -v.L + 0.03, -v.L - 0.03, 0.01, 0.04, 1.6, 2.4, C.cota);
        etiqueta(g, -v.L - 1.4, 0.6, 1.9, `<b>${dec(v.L)} m</b>`, 'cota');
      });
      // regla de 0 a 22 m
      const r = M.grupo(0, 0, 3.6);
      M.caja(r, 0, -22, 0.01, 0.05, -0.08, 0.08, C.cota);
      for (let m = 0; m <= 22; m++) {
        const alto = m % 2 === 0 ? 0.5 : 0.25;
        M.caja(r, -m + 0.025, -m - 0.025, 0.01, alto, -0.03, 0.03, C.cota);
        const cada = canvas.clientWidth < 600 ? 4 : 2;   // en pantallas estrechas, menos rótulos
        if (m % cada === 0) etiqueta(r, -m, 0.9, 0, `${m} m`, 'suave');
      }
      foco = { cx: -10.5, cz: -(3 * sep) / 2 + 1, L: 24, H: 4.5, W: 3 * sep + 8 };
      $('#ficha').innerHTML = `<table class="tabla">
        <thead><tr><th>Vehículo</th><th class="num">Largo</th><th class="num">Alto</th><th class="num">MMA</th></tr></thead>
        <tbody>${ORDEN_VEH.map(k => `<tr><td>${VEH[k].nombre}</td><td class="num">${dec(VEH[k].L)} m</td><td class="num">${dec(VEH[k].H)} m</td><td class="num">${VEH[k].mma}</td></tr>`).join('')}</tbody>
      </table>
      <p style="margin-top:10px">Todos alineados por delante sobre una regla de 1 m. El rígido tiene la MMA de 3 ejes (25-26 t).</p>`;
      M.irA({ theta: 0.3, phi: 0.8, dist: M.distParaAncho(30, 27), target: [foco.cx, 1, foco.cz + 1.6] }, 900);
      $$('.vistas [data-vista]').forEach(b => b.classList.remove('activa'));
    }
  }

  // ==================================================================
  //  PESTAÑA 2 — CARGA DE PALÉS
  // ==================================================================
  let cargaEstado = null;
  function pestanaCarga() {
    panel.innerHTML = `
      <h2>Carga de palés</h2>
      <p class="intro">Articulado de 5 ejes con semirremolque de lona. Interior útil de 13,60 × 2,48 m (<i>dato de mercado</i>).</p>
      <h3>Tipo de palé y colocación</h3>
      ${seg('pale', [['euro', 'Europeo', '1.200 × 800'], ['usa', 'Americano', '1.200 × 1.000'], ['usa-g', 'Americano girado', 'peor opción']], E.cargaTipo + (E.cargaGirado ? '-g' : ''))}
      <div class="botones">
        <button class="btn primario" id="btn-cargar">▶ Cargar el camión</button>
        <button class="btn" id="btn-todos">Colocar todos</button>
        <button class="btn" id="btn-vaciar">Vaciar</button>
      </div>
      <div class="grande"><b id="contador">0</b><span id="contador-total">de 33 palés</span></div>
      <h3>Cálculo</h3>
      <div class="calculo" id="calculo"></div>
      <div id="resultado" aria-live="polite"></div>
      <div class="leyenda"><span><i style="background:#d9a441"></i>Palé europeo</span><span><i style="background:#4f9d69"></i>Palé americano</span><span><i style="background:#d64545"></i>Espacio que sobra</span></div>
      <p class="fuente">Medidas de palé: UNE-EN 13698-1 y 13698-2. La ley no fija las medidas interiores del semirremolque: dependen del fabricante.</p>`;
    alElegir('pale', v => {
      E.cargaTipo = v.startsWith('usa') ? 'usa' : 'euro'; E.cargaGirado = v === 'usa-g';
      escenaCarga();
    });
    $('#btn-cargar').addEventListener('click', () => cargarPales(true));
    $('#btn-todos').addEventListener('click', () => cargarPales(false));
    $('#btn-vaciar').addEventListener('click', () => escenaCarga());
    escenaCarga();
    vista('3d');
  }
  function textoCalculo(d) {
    const p = PALES[d.tipo];
    const sentido = dec(d.lx), ancho = dec(d.az);
    return `
      <div><span>Palé ${p.nombre.toLowerCase()}</span><b>${sentido} × ${ancho} m</b></div>
      <div><span>(largo × ancho en el camión)</span><span></span></div>
      <div><span>Por fila: 2,48 ÷ ${ancho}</span><b>${d.porFila} palés</b></div>
      <div><span>Filas: 13,60 ÷ ${sentido}</span><b>${d.filas} filas</b></div>
      <div class="total"><span>Total: ${d.filas} × ${d.porFila}</span><b>${d.total} palés</b></div>
      <div><span>Largo ocupado</span><b>${dec(d.usado)} m de 13,60 m</b></div>`;
  }
  function escenaCarga() {
    limpiar();
    const g = M.grupo();
    const int = construirArticulado(g, { transparente: true });
    muelle(g, int);
    etiqueta(g, -9.0, 4.8, 0, 'Articulado de 5 ejes · 16,50 m', 'nombre');
    etiqueta(g, int.xf - 0.1, int.suelo + 2.9, 0, 'Frente', 'suave');
    etiqueta(g, int.xr, int.suelo + 3.0, 0, 'Puerta trasera', 'suave');
    const d = distribucion(E.cargaTipo, E.cargaGirado);
    cargaEstado = { g, int, d, pales: [], llegados: 0, extras: [] };
    $('#contador').textContent = '0';
    $('#contador-total').textContent = `de ${d.total} palés`;
    $('#calculo').innerHTML = textoCalculo(d);
    $('#resultado').innerHTML = '';
    foco = { cx: -10.6, cz: 0, L: 21.5, H: 4.2, W: 5, theta3d: -0.78 };
  }
  function cargarPales(animado) {
    escenaCarga();
    const st = cargaEstado, d = st.d, int = st.int;
    const pos = posiciones(d, int.xf);
    const t0 = ahora() + 250;
    const color = PALES[d.tipo].color;
    pos.forEach((p, i) => {
      const pg = crearPale(d.lx, d.az, 1.35, color);
      st.pales.push(pg);
      const destino = [p.x, int.suelo, p.z];
      const llega = () => {
        st.llegados++;
        $('#contador').textContent = st.llegados;
        if (st.llegados === d.total) finCarga();
      };
      if (animado) {
        const inicio = [int.xr - 3.8, int.suelo, p.z];
        const dist = Math.abs(destino[0] - inicio[0]);
        animar(pg, inicio, destino, t0 + i * 150, 350 + dist * 55, llega);
      } else { pg.offset = destino; llega(); }
    });
    if (animado) vista('3d');
  }
  function finCarga() {
    const st = cargaEstado, d = st.d, int = st.int;
    const x0 = int.xf - d.usado, x1 = int.xr;
    M.caja(st.g, x0, x1, int.suelo, int.suelo + 0.03, -INT.ancho / 2, INT.ancho / 2, C.rojo, { alpha: 0.75 });
    M.caja(st.g, x0, x1, int.suelo, int.suelo + 1.2, -INT.ancho / 2, INT.ancho / 2, C.rojo, { alpha: 0.12 });
    etiqueta(st.g, (x0 + x1) / 2, int.suelo + 1.9, 0, `Sobran <b>${dec(d.sobra)} m</b>`, 'alerta');
    if (d.sobraAncho > 0.2) {
      M.caja(st.g, int.xf, x0, int.suelo, int.suelo + 0.03, INT.ancho / 2 - d.sobraAncho, INT.ancho / 2, C.rojo, { alpha: 0.55 });
      etiqueta(st.g, (int.xf + x0) / 2, int.suelo + 0.3, INT.ancho / 2, `${dec(d.sobraAncho)} m de ancho sin usar`, 'alerta');
    }
    const aprov = d.total * PALES[d.tipo].l * PALES[d.tipo].a / (INT.largo * INT.ancho) * 100;
    const txt = d.tipo === 'euro'
      ? `Caben <b>${d.total} palés europeos</b> (3 por fila × 11 filas). Se aprovecha el ${dec(aprov, 0)} % del suelo. Con el lado de 0,80 m hacia delante saldrían 34, pero ocuparían los 13,60 m exactos, sin margen: en la práctica se cargan <b>33</b>.`
      : (E.cargaGirado
        ? `Girados solo caben <b>${d.total}</b>: se pierden ${dec(d.sobra)} m de largo y ${dec(d.sobraAncho)} m de ancho. Por eso el americano se carga con el lado de 1,00 m hacia delante (26 palés).`
        : `Caben <b>${d.total} palés americanos</b> (2 por fila × 13 filas). Se aprovecha el ${dec(aprov, 0)} % del suelo. Tres por fila no caben: 3 × 1,20 = 3,60 m.`);
    $('#resultado').innerHTML = `<div class="estado ${E.cargaGirado ? 'mal' : 'ok'}">${txt}</div>`;
  }

  // ==================================================================
  //  PESTAÑA 3 — PESO
  // ==================================================================
  let pesoEstado = null;
  function pestanaPeso() {
    panel.innerHTML = `
      <h2>Peso: ¿se llena por peso o por volumen?</h2>
      <p class="intro">El conjunto no puede superar <b>44 t</b> (MMA del articulado de 5 ejes). Mueve los controles y mira qué palés se pueden cargar.</p>
      ${seg('pp', [['euro', 'Europeo', '33 palés'], ['usa', 'Americano', '26 palés']], E.pesoTipo)}
      <div class="control">
        <label for="kg">Peso de cada palé (con la mercancía) <output id="o-kg"></output></label>
        <input type="range" id="kg" min="100" max="1500" step="10" value="${E.kg}">
        <div class="extremos"><span>100 kg</span><span>1.500 kg</span></div>
      </div>
      <div class="control">
        <label for="tara">Tara del camión vacío (tractora + semi) <output id="o-tara"></output></label>
        <input type="range" id="tara" min="14" max="16" step="0.5" value="${E.tara}">
        <div class="extremos"><span>14 t</span><span>16 t · <i>dato de mercado</i></span></div>
      </div>
      <h3>Masa total del conjunto</h3>
      <div class="barra-peso"><div class="tara" id="b-tara"></div><div class="carga" id="b-carga"></div><div class="carga exceso" id="b-exceso"></div><div class="limite" id="b-lim"></div></div>
      <div class="leyenda-peso"><span>0 t</span><span>Límite 44 t</span><span>55 t</span></div>
      <div class="calculo" id="p-calc" style="margin-top:12px"></div>
      <div id="p-estado" aria-live="polite"></div>
      <div class="leyenda"><span><i style="background:#9aa7b6"></i>Tara</span><span><i id="sw-carga" style="background:#d9a441"></i>Carga legal</span><span><i style="background:#d64545"></i>No se puede cargar</span></div>
      <p class="fuente">Además de la MMA hay que respetar las masas por eje: tractora de 2 ejes 18 t (eje motor 12 t) y trídem del semirremolque 27 t, siempre que sus ejes estén separados más de 1,30 m (con 1,30 m o menos, solo 21 t). Como 18 + 27 = 45 t, con la carga bien repartida manda el límite de 44 t (Anexo IX, tablas 1 y 2).</p>`;
    alElegir('pp', v => { E.pesoTipo = v; escenaPeso(); });
    $('#kg').addEventListener('input', e => { E.kg = +e.target.value; actualizarPeso(); });
    $('#tara').addEventListener('input', e => { E.tara = +e.target.value; actualizarPeso(); });
    escenaPeso();
    vista('3d');
  }
  function escenaPeso() {
    limpiar();
    const g = M.grupo();
    const int = construirArticulado(g, { transparente: true });
    const d = distribucion(E.pesoTipo, false);
    const pales = posiciones(d, int.xf).map(p => { const pg = crearPale(d.lx, d.az, 1.35, PALES[d.tipo].color); pg.offset = [p.x, int.suelo, p.z]; return pg; });
    pesoEstado = { g, int, d, pales, etq: null };
    pesoEstado.etq = etiqueta(g, -9.5, 5.0, 0, '', 'nombre');
    foco = { cx: -8.6, cz: 0, L: 18.5, H: 4.2, W: 5, theta3d: -0.75 };
    actualizarPeso();
  }
  function actualizarPeso() {
    const st = pesoEstado; if (!st) return;
    const d = st.d, kg = E.kg, tara = E.tara;
    const util = (MMA - tara) * 1000;                          // kg
    const maxPorPeso = Math.floor(util / kg + 1e-9);
    const cargables = Math.min(d.total, maxPorPeso);
    const colorOk = PALES[d.tipo].color;
    st.pales.forEach((pg, i) => fantasma(pg, i >= cargables));
    const hexCss = '#' + colorOk.toString(16).padStart(6, '0');
    $('#b-carga').style.background = hexCss; $('#sw-carga').style.background = hexCss;
    const cargaTotal = d.total * kg;
    const totalT = tara + cargaTotal / 1000;
    const maxMedio = util / d.total;
    $('#o-kg').textContent = miles(kg) + ' kg';
    $('#o-tara').textContent = dec(tara, 1) + ' t';
    const escala = v => Math.min(100, v / 55 * 100) + '%';
    $('#b-tara').style.width = escala(tara);
    const bc = $('#b-carga'), be = $('#b-exceso');
    const hastaLegal = Math.min(totalT, MMA);
    bc.style.left = escala(tara); bc.style.width = `calc(${escala(hastaLegal)} - ${escala(tara)})`;
    be.style.left = escala(MMA); be.style.width = totalT > MMA ? `calc(${escala(totalT)} - ${escala(MMA)})` : '0';
    $('#b-lim').style.left = escala(MMA);
    $('#p-calc').innerHTML = `
      <div><span>Carga útil: 44 − ${dec(tara, 1)} t</span><b>${dec(util / 1000, 1)} t</b></div>
      <div><span>Máx. medio por palé (${d.total})</span><b>${miles(maxMedio)} kg</b></div>
      <div><span>Si se cargan los ${d.total} palés</span><b>${dec(cargaTotal / 1000, 1)} t de carga</b></div>
      <div class="total"><span>Masa total del conjunto</span><b style="color:${totalT > MMA ? 'var(--alerta)' : 'inherit'}">${dec(totalT, 1)} t</b></div>`;
    let html;
    if (maxPorPeso >= d.total) {
      html = `<div class="estado ok"><b>Se llena por VOLUMEN.</b> Caben los ${d.total} palés y el conjunto pesa ${dec(totalT, 1)} t: sobran ${dec(MMA - totalT, 1)} t hasta el límite.</div>`;
      st.etq.el.innerHTML = `Se llena por <b>volumen</b>: ${d.total} de ${d.total} palés`;
      st.etq.el.className = 'etq nombre';
    } else {
      html = `<div class="estado mal"><b>Se llena por PESO.</b> Solo se pueden cargar <b>${cargables} de ${d.total} palés</b> (${dec(cargables * kg / 1000, 1)} t). Con los ${d.total} se llegaría a ${dec(totalT, 1)} t, por encima de 44 t. Queda espacio libre pero no se puede usar.<br><br>En la realidad, esos palés se <b>reparten</b> a lo largo de la caja para no sobrecargar ningún eje.</div>`;
      st.etq.el.innerHTML = `Se llena por <b>peso</b>: ${cargables} de ${d.total} palés`;
      st.etq.el.className = 'etq alerta';
    }
    $('#p-estado').innerHTML = html;
  }

  // ==================================================================
  //  PESTAÑA 4 — REMONTE
  // ==================================================================
  function pestanaRemonte() {
    panel.innerHTML = `
      <h2>Remonte (doble altura)</h2>
      <p class="intro">Si la mercancía lo permite, se apilan dos palés. La capacidad se duplica, pero el peso por palé baja mucho.</p>
      <h3>Semirremolque</h3>
      ${seg('semi', [['estandar', 'Estándar', 'interior ≈ 2,70 m'], ['mega', '«Mega»', 'interior ≈ 3,00 m']], E.remSemi)}
      <h3>Palé</h3>
      ${seg('rp', [['euro', 'Europeo', '1.200 × 800'], ['usa', 'Americano', '1.200 × 1.000']], E.remTipo)}
      <div class="botones"><button class="btn primario" id="btn-remontar">▶ Cargar de nuevo</button></div>
      <div class="grande"><b id="r-total"></b><span>palés a doble altura</span></div>
      <div class="calculo" id="r-calc"></div>
      <ul class="notas">
        <li>La mercancía de abajo tiene que aguantar el peso de la de arriba.</li>
        <li>La carga debe ir sujeta (cinchas, barras) para que no se desplace.</li>
        <li>El «mega» baja el suelo (ruedas más pequeñas y quinta rueda baja) para ganar altura interior sin pasar de <b>4,00 m</b> por fuera.</li>
        <li>Se deja una holgura de unos 10 cm con el techo para poder meter y sacar los palés.</li>
      </ul>
      <p class="fuente">Altura máxima exterior 4,00 m: Anexo IX RGV, tabla 3. Alturas interiores, taras y altura por palé: <i>datos de mercado</i> orientativos.</p>`;
    alElegir('semi', v => { E.remSemi = v; escenaRemonte(); });
    alElegir('rp', v => { E.remTipo = v; escenaRemonte(); });
    $('#btn-remontar').addEventListener('click', () => escenaRemonte());
    escenaRemonte();
    vista('3d');
  }
  function escenaRemonte() {
    limpiar();
    const s = SEMI[E.remSemi];
    const g = M.grupo();
    const int = construirArticulado(g, { transparente: true, semi: E.remSemi });
    const d = distribucion(E.remTipo, false);
    const color = PALES[d.tipo].color;
    const alto = s.altoPale;
    muelle(g, int);
    const t0 = ahora() + 300;
    const hueco = 0.02;
    posiciones(d, int.xf).forEach((p, i) => {
      // la carretilla mete cada pareja ya apilada
      const abajo = crearPale(d.lx, d.az, alto, color);
      const arriba = crearPale(d.lx, d.az, alto, color);
      const x0 = int.xr - 3.8, ms = 350 + Math.abs(p.x - x0) * 50, ti = t0 + i * 110;
      animar(abajo, [x0, int.suelo, p.z], [p.x, int.suelo, p.z], ti, ms);
      animar(arriba, [x0, int.suelo + alto + hueco, p.z], [p.x, int.suelo + alto + hueco, p.z], ti, ms);
    });
    // techo interior (línea roja)
    const techo = int.techo;
    M.caja(g, int.xf, int.xr, techo - 0.02, techo + 0.02, ANCHO_EXT / 2 + 0.02, ANCHO_EXT / 2 + 0.08, C.rojo);
    // columna de alturas junto al camión: suelo + interior + techo = 4,00 m
    const xc = -13.6, zc = ANCHO_EXT / 2 + 0.75, zb = zc + 0.35, w = 0.07;
    M.caja(g, xc + w, xc - w, 0, int.suelo, zc - w, zc + w, C.voladizo);
    M.caja(g, xc + w, xc - w, int.suelo, techo, zc - w, zc + w, C.rojo);
    M.caja(g, xc + w, xc - w, techo, 4.0, zc - w, zc + w, 0x55606d);
    M.caja(g, xc + 0.035, xc - 0.035, 0, 4.0, zb - 0.035, zb + 0.035, C.cota);
    [0, 4.0].forEach(y => M.caja(g, xc + 0.25, xc - 0.25, y - 0.03, y + 0.03, zb - 0.035, zb + 0.035, C.cota));
    etiqueta(g, xc, int.suelo / 2, zc + 1.3, `Suelo <b>${dec(int.suelo)} m</b>`, 'aviso');
    etiqueta(g, xc, (int.suelo + techo) / 2, zc + 1.45, `Interior <b>${dec(techo - int.suelo)} m</b>`, 'alerta');
    etiqueta(g, xc, 4.35, zb, 'Exterior <b>4,00 m</b>', 'cota');
    etiqueta(g, int.xf - 1.0, int.suelo + alto, ANCHO_EXT / 2 + 0.1, `2 × ${dec(alto)} m`, 'aviso');
    etiqueta(g, -9.0, 4.8, 0, `Semirremolque ${s.nombre}`, 'nombre');

    const total = d.total * 2;
    const util = (MMA - 15) * 1000;
    $('#r-total').textContent = total;
    $('#r-calc').innerHTML = `
      <div><span>Palés por altura</span><b>${d.total}</b></div>
      <div><span>Alturas</span><b>2</b></div>
      <div class="total"><span>Total</span><b>${total} palés</b></div>
      <div><span>Alto máx. por palé</span><b>≈ ${dec(alto, 2)} m</b></div>
      <div><span>Ocupan en altura</span><b>${dec(2 * alto)} de ${dec(techo - int.suelo)} m</b></div>
      <div><span>Peso medio máx. (29 t útiles)</span><b>≈ ${miles(util / total)} kg</b></div>`;
    foco = { cx: -10.6, cz: 0, L: 21.5, H: 4.2, W: 5, theta3d: -0.78 };
  }

  // ------------------------------------------------------------------
  //  BUCLE
  // ------------------------------------------------------------------
  function bucle() {
    requestAnimationFrame(bucle);
    pasoAnimaciones();
    M.dibujar();
    actualizarEtiquetas();
  }
  irPestana('tipos');
  vista('3d', 0);            // primera vista sin transición
  requestAnimationFrame(bucle);
})();
