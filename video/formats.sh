#!/usr/bin/env bash
# Saca los formatos vertical 9:16 y cuadrado 1:1 (y el teaser) a partir del video 16:9.
# Uso: video/formats.sh <video-16x9.mp4> <carpeta-con-marcos> <carpeta-salida> [inicio-teaser fin-teaser]
set -euo pipefail
IN="$1"; M="$2"; OUT="$3"; TS="${4:-}"; TE="${5:-}"
fmt () { # $1 entrada  $2 alto total  $3 marco  $4 salida  [extra args de ffmpeg]
  local in="$1" H="$2" frame="$3" out="$4"; shift 4
  local y=$(( (H - 608) / 2 ))
  ffmpeg -v error -y "$@" -i "$in" -loop 1 -i "$frame" -filter_complex \
    "[0:v]split[a][b];[a]scale=-2:${H},crop=1080:${H},boxblur=24:2,eq=brightness=-0.22:saturation=1.2[bg];[b]scale=1080:608:flags=neighbor[fg];[bg][fg]overlay=0:${y}[v];[v][1:v]overlay=0:0:shortest=1,format=yuv420p" \
    -c:v libx264 -preset medium -crf 19 -c:a aac -b:a 256k -movflags +faststart "$out"
}
base=$(basename "$IN" -16x9.mp4)
fmt "$IN" 1920 "$M/marco-9x16.png" "$OUT/$base-9x16.mp4"
fmt "$IN" 1080 "$M/marco-1x1.png" "$OUT/$base-1x1.mp4"
if [ -n "$TS" ]; then
  D=$(python3 -c "print($TE-$TS)")
  # teaser: recorte con entrada y salida suaves de audio y video
  ffmpeg -v error -y -ss "$TS" -t "$D" -i "$IN" -af "afade=t=in:d=0.6,afade=t=out:st=$(python3 -c "print($D-1.5)"):d=1.5" \
    -vf "fade=t=in:d=0.4,fade=t=out:st=$(python3 -c "print($D-1)"):d=1" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart "$OUT/$base-teaser-16x9.mp4"
  fmt "$OUT/$base-teaser-16x9.mp4" 1920 "$M/marco-9x16.png" "$OUT/$base-teaser-9x16.mp4"
fi
ls -la "$OUT"
