# Convierte un audio (WAV o MP3) a MP3 liviano para voz, normaliza el volumen
# y lo sube al bucket de R2 "pdc-audios".
#
# Uso:
#   .\scripts\subir-audio.ps1 -Archivo "C:\ruta\servicio.wav" -Nombre "servicio-2026-10-04.mp3"
#   .\scripts\subir-audio.ps1 -Archivo ... -Nombre ... -SinNormalizar   (solo comprime)
#
# Normalización: pasa a mono, filtra graves muy bajos, comprime suavemente la
# diferencia entre partes bajas y fuertes y deja el volumen promedio cerca de
# -15 LUFS con un tope de picos para que no sature.
#
# Requisitos: ffmpeg (en el PATH, o en R:\ProyectosDan\herramientas\ffmpeg.exe)
# y haber hecho `npx wrangler login` una vez.
# Usa siempre el archivo ORIGINAL (WAV de Reaper), no uno ya comprimido o amplificado.
# Después de subirlo, agrega la entrada en src/data/sermones.ts con el mismo nombre.

param(
  [Parameter(Mandatory = $true)][string]$Archivo,
  [Parameter(Mandatory = $true)][string]$Nombre,
  [switch]$SinNormalizar
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Archivo)) { throw "No existe el archivo: $Archivo" }
if ($Nombre -notmatch '^[a-z0-9._-]+\.mp3$') { throw "El nombre debe ir en minúsculas, sin espacios, y terminar en .mp3 (ej. servicio-2026-10-04.mp3)" }

$ffmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ffmpeg) { $ffmpeg = 'R:\ProyectosDan\herramientas\ffmpeg.exe' }
if (-not (Test-Path -LiteralPath $ffmpeg)) { throw "No se encontró ffmpeg." }

# Carpeta temporal dentro del proyecto (ignorada por git), no en C: que puede estar llena.
$tmp = Join-Path $PSScriptRoot '..\.wrangler\audio-tmp'
New-Item -ItemType Directory -Force $tmp | Out-Null
$salida = Join-Path $tmp $Nombre

if ($SinNormalizar) {
  $filtro = 'pan=mono|c0=0.5*c0+0.5*c1'
  Write-Host "Comprimiendo a MP3 64 kbps mono (sin normalizar)..."
} else {
  $filtro = 'pan=mono|c0=0.5*c0+0.5*c1,highpass=f=70,acompressor=threshold=-26dB:ratio=3:attack=20:release=300:makeup=3,loudnorm=I=-13:TP=-2:LRA=9'
  Write-Host "Comprimiendo a MP3 64 kbps mono y normalizando volumen..."
}

& $ffmpeg -y -loglevel error -i $Archivo -vn -af $filtro -ar 32000 -b:a 64k $salida
if ($LASTEXITCODE -ne 0) { throw "ffmpeg falló" }

$mb = [math]::Round((Get-Item $salida).Length / 1MB, 1)
Write-Host "Tamaño final: $mb MB. Subiendo a R2..."

npx wrangler r2 object put "pdc-audios/$Nombre" --file $salida --content-type audio/mpeg --remote
if ($LASTEXITCODE -ne 0) { throw "La subida a R2 falló" }

Remove-Item $salida
Write-Host "Listo. Ahora agrega la entrada en src/data/sermones.ts con archivo: `"$Nombre`""
Write-Host "Si reemplazaste un audio que ya existía, sube también su campo version (+1) para saltar la caché."
