/// <reference lib="webworker" />
// Convierte un WAV a MP3 de voz (64 kbps, mono) directamente en el navegador.
// Lee el archivo por pedazos para no cargarlo completo en memoria (un WAV de
// 2 horas pesa ~1.4 GB) y, si se pide, normaliza el volumen en dos pasadas:
//   1) analiza: filtro de graves + compresor suave, y mide el volumen (LUFS)
//   2) procesa: repite el mismo tratamiento, aplica la ganancia y codifica.

import { Mp3Encoder } from '@breezystack/lamejs';

export interface EntradaProcesar {
  file: File;
  normalizar: boolean;
}

export type MensajeWorker =
  | { tipo: 'progreso'; fase: 'analizando' | 'comprimiendo'; pct: number }
  | { tipo: 'listo'; mp3: Uint8Array[]; segundos: number; lufsOriginal: number | null; gananciaDb: number }
  | { tipo: 'error'; mensaje: string };

const OBJETIVO_LUFS = -14.5;
const GANANCIA_MAX_DB = 20;
const TECHO_PICO = 0.668; // -3.5 dBFS: deja margen al rebote del codificador MP3
const BITRATE = 64;
const TASAS_MP3 = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];
const BYTES_POR_LECTURA = 4 * 1024 * 1024;

interface FormatoWav {
  canales: number;
  tasa: number;
  bits: number;
  flotante: boolean;
  bytesPorFrame: number;
  inicio: number;
  frames: number;
}

self.onmessage = async (e: MessageEvent<EntradaProcesar>) => {
  try {
    await procesar(e.data);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error desconocido al procesar el audio.';
    (self as DedicatedWorkerGlobalScope).postMessage({ tipo: 'error', mensaje } satisfies MensajeWorker);
  }
};

function enviar(m: MensajeWorker, transfer: Transferable[] = []) {
  (self as DedicatedWorkerGlobalScope).postMessage(m, transfer);
}

/* ---------------------------- lectura del WAV ---------------------------- */

async function leerWav(file: File): Promise<FormatoWav> {
  const leer = async (desde: number, largo: number) =>
    new DataView(await file.slice(desde, desde + largo).arrayBuffer());
  const texto = (v: DataView, o: number) =>
    String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

  const cab = await leer(0, 12);
  if (cab.byteLength < 12 || !['RIFF', 'RF64'].includes(texto(cab, 0)) || texto(cab, 8) !== 'WAVE') {
    throw new Error('El archivo no es un WAV válido.');
  }

  let pos = 12;
  let fmt: Omit<FormatoWav, 'inicio' | 'frames'> | null = null;
  while (pos + 8 <= file.size) {
    const h = await leer(pos, 8);
    const id = texto(h, 0);
    const tam = h.getUint32(4, true);

    if (id === 'fmt ') {
      const f = await leer(pos + 8, Math.min(tam, 40));
      let formato = f.getUint16(0, true);
      const canales = f.getUint16(2, true);
      const tasa = f.getUint32(4, true);
      const bits = f.getUint16(14, true);
      if (formato === 0xfffe && f.byteLength >= 26) formato = f.getUint16(24, true);
      if (formato !== 1 && formato !== 3) throw new Error('Formato de WAV no soportado (solo PCM o float).');
      const flotante = formato === 3;
      const validos = flotante ? [32, 64] : [8, 16, 24, 32];
      if (!validos.includes(bits)) throw new Error(`WAV de ${bits} bits no soportado.`);
      if (canales < 1) throw new Error('El WAV no tiene canales de audio.');
      fmt = { canales, tasa, bits, flotante, bytesPorFrame: canales * (bits / 8) };
    } else if (id === 'data') {
      if (!fmt) throw new Error('El WAV está incompleto (no se encontró el formato).');
      const inicio = pos + 8;
      const disponible = file.size - inicio;
      const bytes = tam === 0 || tam === 0xffffffff || tam > disponible ? disponible : tam;
      const frames = Math.floor(bytes / fmt.bytesPorFrame);
      if (frames <= 0) throw new Error('El WAV no contiene audio.');
      return { ...fmt, inicio, frames };
    }
    pos += 8 + tam + (tam % 2);
  }
  throw new Error('No se encontró el audio dentro del WAV.');
}

/** Lee el WAV por pedazos y entrega cada uno como mono Float32 (promedio de canales). */
async function* leerMono(file: File, fmt: FormatoWav, factorReduccion: number) {
  const framesPorLectura = Math.max(1024, Math.floor(BYTES_POR_LECTURA / fmt.bytesPorFrame));
  const bytesMuestra = fmt.bits / 8;
  let resto = new Float32Array(0); // muestras sobrantes para completar un grupo de reducción

  for (let f = 0; f < fmt.frames; f += framesPorLectura) {
    const n = Math.min(framesPorLectura, fmt.frames - f);
    const buf = await file
      .slice(fmt.inicio + f * fmt.bytesPorFrame, fmt.inicio + (f + n) * fmt.bytesPorFrame)
      .arrayBuffer();
    const v = new DataView(buf);
    let mono = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      let suma = 0;
      for (let c = 0; c < fmt.canales; c++) {
        const o = (i * fmt.canales + c) * bytesMuestra;
        let s: number;
        if (fmt.flotante) s = fmt.bits === 32 ? v.getFloat32(o, true) : v.getFloat64(o, true);
        else if (fmt.bits === 16) s = v.getInt16(o, true) / 32768;
        else if (fmt.bits === 24) s = ((v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getInt8(o + 2) << 16)) | 0) / 8388608;
        else if (fmt.bits === 32) s = v.getInt32(o, true) / 2147483648;
        else s = (v.getUint8(o) - 128) / 128;
        suma += s;
      }
      mono[i] = suma / fmt.canales;
    }

    if (factorReduccion > 1) {
      const todo = new Float32Array(resto.length + mono.length);
      todo.set(resto);
      todo.set(mono, resto.length);
      const salidaN = Math.floor(todo.length / factorReduccion);
      const salida = new Float32Array(salidaN);
      for (let i = 0; i < salidaN; i++) {
        let s = 0;
        for (let k = 0; k < factorReduccion; k++) s += todo[i * factorReduccion + k];
        salida[i] = s / factorReduccion;
      }
      resto = todo.slice(salidaN * factorReduccion);
      mono = salida;
    }

    yield { mono, avance: (f + n) / fmt.frames };
  }
}

/* ------------------------------- filtros --------------------------------- */

class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(
    private b0: number,
    private b1: number,
    private b2: number,
    private a1: number,
    private a2: number
  ) {}
  paso(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function pasaAltos(fc: number, q: number, fs: number) {
  const w = (2 * Math.PI * fc) / fs;
  const alfa = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const a0 = 1 + alfa;
  return new Biquad((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - alfa) / a0);
}

/** Ponderación K de ITU-R BS.1770 (para medir el volumen percibido). */
function ponderacionK(fs: number): [Biquad, Biquad] {
  const f0 = 1681.974450955533;
  const G = 3.999843853973347;
  const Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / fs);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const alto = new Biquad(
    (Vh + (Vb * K) / Q + K * K) / a0,
    (2 * (K * K - Vh)) / a0,
    (Vh - (Vb * K) / Q + K * K) / a0,
    (2 * (K * K - 1)) / a0,
    (1 - K / Q + K * K) / a0
  );

  const f1 = 38.13547087602444;
  const Q1 = 0.5003270373238773;
  K = Math.tan((Math.PI * f1) / fs);
  a0 = 1 + K / Q1 + K * K;
  const rlb = new Biquad(1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q1 + K * K) / a0);
  return [alto, rlb];
}

/**
 * Filtro de graves (70 Hz) + nivelador lento + compresor suave. Mismo tratamiento en las dos pasadas.
 *  - El nivelador acerca el volumen de cada tramo (ventana de ~1.5 s) a un nivel común, subiendo
 *    las partes bajas y bajando las muy fuertes. En silencio mantiene la ganancia (no sube el ruido).
 *  - El compresor controla los picos rápidos.
 */
class Cadena {
  private hp: Biquad;
  private env = 0;
  private gananciaLineal = 1;
  private ms = 0;
  private nivelDb = 0;
  private nivelLineal = 1;
  private contador = 0;
  private aAtaque: number;
  private aSuelta: number;
  private aMs: number;
  private aNivel: number;
  private static UMBRAL_DB = -26;
  private static RATIO = 3;
  private static PASO = 32;
  private static PASO_NIVEL = 256;
  private static OBJETIVO_RMS_DB = -26;
  private static COMPUERTA_DB = -50;
  private static MIN_DB = -6;
  private static MAX_DB = 15;

  constructor(fs: number) {
    this.hp = pasaAltos(70, Math.SQRT1_2, fs);
    this.aAtaque = 1 - Math.exp(-1 / (0.02 * fs));
    this.aSuelta = 1 - Math.exp(-1 / (0.3 * fs));
    this.aMs = 1 - Math.exp(-1 / (1.5 * fs));
    this.aNivel = 1 - Math.exp(-Cadena.PASO_NIVEL / (2 * fs));
  }

  procesar(entrada: Float32Array, salida: Float32Array) {
    for (let i = 0; i < entrada.length; i++) {
      const x0 = this.hp.paso(entrada[i]);

      // Nivelador: la ganancia se recalcula cada PASO_NIVEL muestras y cambia con calma.
      this.ms += (x0 * x0 - this.ms) * this.aMs;
      if (this.contador % Cadena.PASO_NIVEL === 0) {
        const nivel = 10 * Math.log10(this.ms + 1e-12);
        if (nivel > Cadena.COMPUERTA_DB) {
          const deseado = Math.max(Cadena.MIN_DB, Math.min(Cadena.MAX_DB, Cadena.OBJETIVO_RMS_DB - nivel));
          this.nivelDb += (deseado - this.nivelDb) * this.aNivel;
          this.nivelLineal = Math.pow(10, this.nivelDb / 20);
        }
      }
      const x = x0 * this.nivelLineal;

      // Compresor: la envolvente ya está suavizada, la ganancia se recalcula cada PASO muestras.
      const a = x < 0 ? -x : x;
      this.env += (a - this.env) * (a > this.env ? this.aAtaque : this.aSuelta);
      if (this.contador % Cadena.PASO === 0) {
        const nivelDb = 20 * Math.log10(this.env + 1e-9);
        const exceso = nivelDb - Cadena.UMBRAL_DB;
        this.gananciaLineal = exceso > 0 ? Math.pow(10, (-exceso * (1 - 1 / Cadena.RATIO)) / 20) : 1;
      }
      this.contador++;
      salida[i] = x * this.gananciaLineal;
    }
  }
}

/* --------------------------- medición de volumen -------------------------- */

class Medidor {
  private alto: Biquad;
  private rlb: Biquad;
  private sumas: number[] = [];
  private acum = 0;
  private cuenta = 0;
  private bloque: number;

  constructor(fs: number) {
    [this.alto, this.rlb] = ponderacionK(fs);
    this.bloque = Math.round(fs * 0.1); // sub-bloques de 100 ms
  }

  agregar(x: Float32Array) {
    for (let i = 0; i < x.length; i++) {
      const y = this.rlb.paso(this.alto.paso(x[i]));
      this.acum += y * y;
      if (++this.cuenta === this.bloque) {
        this.sumas.push(this.acum / this.bloque);
        this.acum = 0;
        this.cuenta = 0;
      }
    }
  }

  /** Volumen integrado en LUFS con compuerta (BS.1770-4), o null si no hay audio medible. */
  integrado(): number | null {
    const bloques: number[] = [];
    for (let i = 0; i + 4 <= this.sumas.length; i++) {
      bloques.push((this.sumas[i] + this.sumas[i + 1] + this.sumas[i + 2] + this.sumas[i + 3]) / 4);
    }
    const lufs = (ms: number) => -0.691 + 10 * Math.log10(ms);

    const sobreAbs = bloques.filter((b) => b > 0 && lufs(b) > -70);
    if (!sobreAbs.length) return null;
    const media = sobreAbs.reduce((s, b) => s + b, 0) / sobreAbs.length;
    const umbralRel = lufs(media) - 10;
    const sobreRel = sobreAbs.filter((b) => lufs(b) > umbralRel);
    if (!sobreRel.length) return null;
    return lufs(sobreRel.reduce((s, b) => s + b, 0) / sobreRel.length);
  }
}

/**
 * Limitador de ganancia con anticipación (5 ms): baja el volumen suavemente justo antes de
 * cada pico para que nunca pase del techo, sin recortar la onda. Introduce un retraso de
 * LARGO - 1 muestras: la salida va ligeramente atrasada y `fin()` entrega el resto.
 */
class Limitador {
  private largo: number;
  private retraso: Float32Array;
  private colaIdx: Int32Array;
  private colaVal: Float32Array;
  private cabeza = 0;
  private cola = 0;
  private cuenta = 0;
  private anillo: Float32Array;
  private anilloPos = 0;
  private suma: number;
  private ganancia = 1;
  private aSuelta: number;
  private n = 0;

  constructor(fs: number, private techo: number) {
    this.largo = Math.max(2, Math.round(0.005 * fs));
    this.retraso = new Float32Array(this.largo);
    this.colaIdx = new Int32Array(this.largo + 1);
    this.colaVal = new Float32Array(this.largo + 1);
    this.anillo = new Float32Array(this.largo).fill(1);
    this.suma = this.largo;
    this.aSuelta = 1 - Math.exp(-1 / (0.1 * fs));
  }

  private paso(x: number): number {
    const L = this.largo;
    const S = L + 1;
    const a = x < 0 ? -x : x;
    const req = a > this.techo ? this.techo / a : 1;

    // mínimo móvil de la ganancia requerida (cola monótona)
    while (this.cuenta > 0 && this.colaVal[(this.cola - 1 + S) % S] >= req) {
      this.cola = (this.cola - 1 + S) % S;
      this.cuenta--;
    }
    this.colaIdx[this.cola] = this.n;
    this.colaVal[this.cola] = req;
    this.cola = (this.cola + 1) % S;
    this.cuenta++;

    this.retraso[this.n % L] = x;

    let salida = NaN;
    if (this.n >= L - 1) {
      const desde = this.n - L + 1;
      while (this.colaIdx[this.cabeza] < desde) {
        this.cabeza = (this.cabeza + 1) % S;
        this.cuenta--;
      }
      const m = this.colaVal[this.cabeza];
      this.suma += m - this.anillo[this.anilloPos];
      this.anillo[this.anilloPos] = m;
      this.anilloPos = (this.anilloPos + 1) % L;

      const suave = Math.min(1, this.suma / L);
      this.ganancia = Math.min(suave, this.ganancia + (1 - this.ganancia) * this.aSuelta);
      salida = this.retraso[(this.n + 1) % L] * this.ganancia;
    }
    this.n++;
    return salida;
  }

  procesar(x: Float32Array): Float32Array {
    const salida = new Float32Array(x.length);
    let k = 0;
    for (let i = 0; i < x.length; i++) {
      const y = this.paso(x[i]);
      if (y === y) salida[k++] = y; // descarta NaN (aún no hay salida)
    }
    return salida.subarray(0, k);
  }

  fin(): Float32Array {
    return this.procesar(new Float32Array(this.largo - 1));
  }
}

/* ------------------------------- principal -------------------------------- */

async function procesar({ file, normalizar }: EntradaProcesar) {
  const fmt = await leerWav(file);

  let factor = 1;
  let tasa = fmt.tasa;
  if (!TASAS_MP3.includes(tasa)) {
    if (tasa > 48000 && tasa % 2 === 0 && TASAS_MP3.includes(tasa / 2)) factor = 2;
    else if (tasa > 48000 && tasa % 4 === 0 && TASAS_MP3.includes(tasa / 4)) factor = 4;
    else throw new Error(`Frecuencia de muestreo de ${tasa} Hz no soportada.`);
    tasa = tasa / factor;
  }
  const segundos = fmt.frames / fmt.tasa;

  let lufsOriginal: number | null = null;
  let gananciaDb = 0;

  if (normalizar) {
    const medidor = new Medidor(tasa);
    const cadena = new Cadena(tasa);
    for await (const { mono, avance } of leerMono(file, fmt, factor)) {
      const tratado = new Float32Array(mono.length);
      cadena.procesar(mono, tratado);
      medidor.agregar(tratado);
      enviar({ tipo: 'progreso', fase: 'analizando', pct: avance });
    }
    lufsOriginal = medidor.integrado();
    if (lufsOriginal === null) throw new Error('El audio parece estar en silencio.');
    gananciaDb = Math.min(OBJETIVO_LUFS - lufsOriginal, GANANCIA_MAX_DB);
  }

  const ganancia = Math.pow(10, gananciaDb / 20);
  const cadena = normalizar ? new Cadena(tasa) : null;
  const limitador = normalizar ? new Limitador(tasa, TECHO_PICO) : null;
  const codificador = new Mp3Encoder(1, tasa, BITRATE);
  const salida: Uint8Array[] = [];
  const guardar = (b: Int8Array | Uint8Array) => {
    if (b.length) salida.push(new Uint8Array(b));
  };

  const TAM = 1152 * 16;
  let pendiente = new Int16Array(0);
  const codificar = (x: Float32Array) => {
    const pcm = new Int16Array(pendiente.length + x.length);
    pcm.set(pendiente);
    for (let i = 0; i < x.length; i++) {
      const v = x[i] > 1 ? 1 : x[i] < -1 ? -1 : x[i];
      pcm[pendiente.length + i] = Math.round(v * 32767);
    }
    let o = 0;
    for (; o + TAM <= pcm.length; o += TAM) guardar(codificador.encodeBuffer(pcm.subarray(o, o + TAM)));
    pendiente = pcm.slice(o);
  };

  for await (const { mono, avance } of leerMono(file, fmt, factor)) {
    let x = mono;
    if (cadena && limitador) {
      x = new Float32Array(mono.length);
      cadena.procesar(mono, x);
      for (let i = 0; i < x.length; i++) x[i] *= ganancia;
      x = limitador.procesar(x);
    }
    codificar(x);
    enviar({ tipo: 'progreso', fase: 'comprimiendo', pct: avance });
  }
  if (limitador) codificar(limitador.fin());
  if (pendiente.length) guardar(codificador.encodeBuffer(pendiente));
  guardar(codificador.flush());

  enviar(
    { tipo: 'listo', mp3: salida, segundos, lufsOriginal, gananciaDb },
    salida.map((b) => b.buffer)
  );
}
