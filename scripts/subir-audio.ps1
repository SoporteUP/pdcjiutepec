# Comprime un audio a MP3 liviano (voz) y lo sube al bucket de R2 "pdc-audios".
#
# Uso:
#   .\scripts\subir-audio.ps1 -Archivo "C:\ruta\servicio.mp3" -Nombre "servicio-2026-10-04.mp3"
#
# Requisitos: ffmpeg (en el PATH, o en R:\ProyectosDan\herramientas\ffmpeg.exe)
# y haber hecho `npx wrangler login` una vez.
# Después de subirlo, agrega la entrada en src/data/sermones.ts con el mismo nombre.

param(
  [Parameter(Mandatory = $true)][string]$Archivo,
  [Parameter(Mandatory = $true)][string]$Nombre
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

Write-Host "Comprimiendo a MP3 64 kbps mono..."
& $ffmpeg -y -loglevel error -i $Archivo -vn -ac 1 -ar 32000 -b:a 64k $salida
if ($LASTEXITCODE -ne 0) { throw "ffmpeg falló" }

$mb = [math]::Round((Get-Item $salida).Length / 1MB, 1)
Write-Host "Tamaño final: $mb MB. Subiendo a R2..."

npx wrangler r2 object put "pdc-audios/$Nombre" --file $salida --content-type audio/mpeg --remote
if ($LASTEXITCODE -ne 0) { throw "La subida a R2 falló" }

Remove-Item $salida
Write-Host "Listo. Ahora agrega la entrada en src/data/sermones.ts con archivo: `"$Nombre`""
