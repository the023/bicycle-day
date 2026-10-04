"""usage: python3 tools/plot.py out_prefix title  -> out_prefix.png (features, our independent boundaries, the app's scene changes)"""
import sys, json, numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
pre, title = sys.argv[1], sys.argv[2]; f = json.load(open(pre + '.feat.json')); r = json.load(open(pre + '.replay.json'))
t = np.arange(f['sec']); fig, ax = plt.subplots(4, 1, figsize=(16, 9), sharex=True)
def z(a): a = np.array(a); return (a - a.min()) / (a.max() - a.min() + 1e-9)
ax[0].plot(t, f['level'], 'k'); ax[0].set_ylabel('level dB'); ax[0].set_title(title)
ax[1].plot(t, z(f['bass']), 'r', label='bass'); ax[1].plot(t, z(f['mid']), 'g', label='mid'); ax[1].plot(t, z(f['high']), 'b', label='high'); ax[1].legend(loc='upper right', ncol=3); ax[1].set_ylabel('bands (norm)')
ax[2].plot(t, f['nov'], 'm'); ax[2].set_ylabel('novelty')
rows = r['rows']; ax[3].plot([x['t'] for x in rows], [x['I'] for x in rows], 'orange', label='app intensity I'); ax[3].plot([x['t'] for x in rows], [x['lv'] for x in rows], 'gray', label='app lv'); ax[3].legend(loc='upper right', ncol=2); ax[3].set_ylabel('app')
col = {'drop': 'red', 'build': 'orange', 'groove': 'green', 'breakdown': 'blue', 'calm': 'cyan', 'listening…': 'white'}
for x in rows: ax[3].axvspan(x['t'], x['t'] + 1, ymin=0, ymax=.06, color=col[x['state']])
for a in ax:
    for b in f['bounds']: a.axvline(b, color='k', ls='--', lw=1)
    for e in r['events']: a.axvline(e['t'], color='red', lw=2, alpha=.6)
ax[3].set_xlabel('seconds  (black dashed = independent guess, red = app scene change; bottom strip = app state)')
plt.tight_layout(); plt.savefig(pre + '.png', dpi=70)
