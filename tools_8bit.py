"""Convierte una canción a sonido "8 bits": mono, muestreo bajo con retención (aliasing tipo consola) y pocos bits."""
import subprocess, sys, numpy as np
from scipy.signal import butter, sosfilt

src, dst = sys.argv[1], sys.argv[2]
SR, DOWN, BITS = 44100, 4, 6          # 44.1 kHz -> 11.025 kHz, 6 bits de resolución
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
x = sosfilt(butter(4, 5200, 'low', fs=SR, output='sos'), x)        # quita el chirrido antes de bajar el muestreo
x = sosfilt(butter(2, 45, 'high', fs=SR, output='sos'), x)
x = np.tanh(1.6 * x / (np.max(np.abs(x)) + 1e-9)) / np.tanh(1.6)   # un poco de compresión, como chip de consola
held = np.repeat(x[::DOWN], DOWN)[:len(x)]                          # sample & hold a 11 kHz
levels = 2 ** (BITS - 1)
crushed = np.round(held * (levels - 1)) / (levels - 1)               # cuantización a 6 bits, sin dither
crushed = sosfilt(butter(2, 9000, 'low', fs=SR, output='sos'), crushed) * 0.9
pcm = (np.clip(crushed, -1, 1) * 32767).astype(np.int16).tobytes()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-ar', '22050', '-ac', '1', '-b:a', '64k', dst], input=pcm, check=True)
print('ok', dst, round(len(x) / SR, 1), 's')
