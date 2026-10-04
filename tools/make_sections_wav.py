"""Synthetic 80 s test track with clear sections (pad / beat / pad / beat) for the live-mode smoke test.
usage: python3 tools/make_sections_wav.py /tmp/sections.wav"""
import sys, wave, numpy as np
sr = 44100
def pad(d):
    t = np.arange(int(d * sr)) / sr
    return .12 * (np.sin(2*np.pi*110*t) + .6*np.sin(2*np.pi*165*t) + .4*np.sin(2*np.pi*220*t)) * (.8 + .2*np.sin(2*np.pi*.2*t))
def beat(d):
    n = int(d * sr); t = np.arange(n) / sr; x = np.zeros(n)
    for b in np.arange(0, d, .5):
        i = int(b * sr); L = int(.25 * sr); tt = np.arange(L) / sr
        if i + L <= n: x[i:i+L] += .8 * np.sin(2*np.pi*(55 + 90*np.exp(-tt*25))*tt) * np.exp(-tt*9)
    for b in np.arange(.25, d, .25):
        i = int(b * sr); L = int(.04 * sr)
        if i + L <= n: x[i:i+L] += .15 * np.random.randn(L) * np.exp(-np.arange(L) / (.01*sr))
    return x + pad(d) * 1.5 + .3 * np.sin(2*np.pi*80*t) * (np.sin(2*np.pi*2*t) > 0)
x = np.concatenate([pad(20), beat(22), pad(16), beat(22)]); x = x / np.abs(x).max() * .9
w = wave.open(sys.argv[1], 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
