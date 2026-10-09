export interface Sermon {
  /** Identificador único (se usa para recordar por dónde iba el oyente). */
  id: string;
  titulo: string;
  /** Fecha del servicio en formato AAAA-MM-DD. */
  fecha: string;
  descripcion?: string;
  predicador?: string;
  /** Nombre del archivo tal como está en el bucket de R2 (pdc-audios). */
  archivo: string;
  /**
   * Súbelo en 1 cada vez que reemplaces el archivo en R2 con el mismo nombre.
   * Evita que la caché de Cloudflare (hasta 24 h) siga sirviendo el audio viejo.
   */
  version?: number;
}

// Para agregar un audio nuevo: sube el mp3 al bucket (scripts/subir-audio.ps1)
// y agrega aquí una entrada. El orden da igual, la página los ordena por fecha.
export const sermones: Sermon[] = [
  {
    id: "2026-10-04",
    titulo: "Servicio del domingo",
    fecha: "2026-10-04",
    descripcion: "Reunión general del domingo 4 de octubre de 2026.",
    archivo: "servicio-2026-10-04.mp3",
    version: 2, // v2: reemplazado por la versión normalizada desde el WAV de Reaper
  },
];
