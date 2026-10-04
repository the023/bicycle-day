"""Simulate 'speakers -> room -> microphone': small-speaker band limit, room reverb, background noise.
usage: python3 tools/degrade.py in.wav out.wav"""
import sys, wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
w = wave.open(sys.argv[1]); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
x = sosfilt(butter(2, 140, 'hp', fs=sr, output='sos'), x)          # laptop speakers: almost no deep bass
x = sosfilt(butter(2, 9000, 'lp', fs=sr, output='sos'), x)
rng = np.random.default_rng(1); n = int(.45 * sr)
ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (.12 * sr)); ir[0] = 1; ir /= np.abs(ir).sum() * .35
x = (.6 * x + .5 * fftconvolve(x, ir)[:len(x)]).astype(np.float32)     # room
x = x / np.abs(x).max() * .8 + rng.standard_normal(len(x)).astype(np.float32) * .004   # room noise ~ -48 dB
o = wave.open(sys.argv[2], 'wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
