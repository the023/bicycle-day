"""Decode-free spectrogram + independent structure analysis for one wav (mono 44.1k).
usage: python3 tools/spectro.py track.wav out_prefix
writes  <out>.spec.bin  (float32 frames @60 fps x NB bins, dB, with the browser analyser's blackman window / fft 2048 / smoothing .3)
        <out>.feat.json (per-second features + novelty-based section boundaries, our independent guess)"""
import sys, json, wave, numpy as np
from scipy.signal import find_peaks
src, out = sys.argv[1], sys.argv[2]
w = wave.open(src); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
N, NB, FPS = 2048, 330, 60
win = np.blackman(N); hop = sr // FPS
nf = (len(x) - N) // hop
spec = np.zeros((nf, NB), np.float32); prev = np.zeros(N // 2, np.float32)
for i in range(nf):
    mag = np.abs(np.fft.rfft(x[i * hop:i * hop + N] * win))[:N // 2] / N
    prev = .3 * prev + .7 * mag     # AnalyserNode smoothingTimeConstant = .3
    spec[i] = 20 * np.log10(np.maximum(prev[:NB], 1e-10))
spec.tofile(out + '.spec.bin')
# ---- independent features, 1 s hop, 24 log-spaced bands 40 Hz..12 kHz (power in dB)
k = sr / N; edges = np.geomspace(40, 12000, 25); sec = int(len(x) / sr)
F = np.zeros((sec, 24))
for t in range(sec):
    seg = x[t * sr:t * sr + sr]; P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2; fr = np.fft.rfftfreq(len(seg), 1 / sr)
    for b in range(24): F[t, b] = 10 * np.log10(P[(fr >= edges[b]) & (fr < edges[b + 1])].sum() + 1e-12)
level = 10 * np.log10(np.array([np.mean(x[t * sr:(t + 1) * sr] ** 2) for t in range(sec)]) + 1e-12)
bass = F[:, :6].mean(1); mid = F[:, 6:16].mean(1); high = F[:, 16:].mean(1)
# onset density: positive spectral flux per second
flux = np.array([np.maximum(np.diff(F[max(t - 1, 0):t + 1], axis=0), 0).sum() if t > 0 else 0 for t in range(sec)])
# novelty: checkerboard kernel on the self-similarity of z-scored features, 8 s half-width
Z = (F - F.mean(0)) / (F.std(0) + 1e-6); Zs = np.array([np.convolve(Z[:, b], np.ones(3) / 3, 'same') for b in range(24)]).T
D = Zs @ Zs.T / 24; L = 8
nov = np.zeros(sec)
for t in range(L, sec - L):
    a = D[t - L:t, t - L:t].mean() + D[t:t + L, t:t + L].mean() - D[t - L:t, t:t + L].mean() - D[t:t + L, t - L:t].mean()
    nov[t] = a
pk, _ = find_peaks(nov, height=np.percentile(nov[L:-L], 70), distance=10)
json.dump({'sec': sec, 'level': level.tolist(), 'bass': bass.tolist(), 'mid': mid.tolist(), 'high': high.tolist(), 'flux': flux.tolist(), 'nov': nov.tolist(), 'bounds': pk.tolist()}, open(out + '.feat.json', 'w'))
print(src, 'sec', sec, 'frames', nf, 'bounds', pk.tolist())
