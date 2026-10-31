// WebM fix (T169): MediaRecorder's WebM has no Duration, no Cues and unknown-size Segment / Clusters, so players show a broken timeline and cannot seek.
// webmFix(arrayBuffer|Uint8Array) -> Uint8Array: rewrites it as EBML header, Segment (known size) { SeekHead, Info + Duration, Tracks, Cues (one per Cluster), Clusters (known size) }; any parse problem returns the input unchanged, never throws.
// (File order: sorts after 12-transport.js, fine: a function declaration, only called at runtime.)
function webmFix(buf) {
  const src = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  function vint(b, p, keepMark) {   // EBML varint at p -> { n value (id: marker kept), len, unk (all value bits 1 = unknown size) }
    const f = b[p]; if (!f) throw 0;
    let len = 1, m = 0x80; while (!(f & m)) { len++; m >>= 1; }
    if (p + len > b.length) throw 0;
    let n = keepMark ? f : f & (m - 1), unk = (f & (m - 1)) === m - 1;
    for (let i = 1; i < len; i++) { n = n * 256 + b[p + i]; unk = unk && b[p + i] === 255; }
    return { n, len, unk };
  }
  function el(b, p, end) {   // element at p -> { id, p, ds data start, de data end (-1 = unknown size) }
    const i = vint(b, p, true), s = vint(b, p + i.len), ds = p + i.len + s.len, de = s.unk ? -1 : ds + s.n;
    if (de > end) throw 0;
    return { id: i.n, p, ds, de };
  }
  function kids(b, ds, de) { const a = []; for (let p = ds; p < de;) { const e = el(b, p, de); if (e.de < 0) throw 0; a.push(e); p = e.de; } return a; }
  function uint(b, e) { let n = 0; for (let i = e.ds; i < e.de; i++) n = n * 256 + b[i]; return n; }
  const L1 = new Set([0x114D9B74, 0x1549A966, 0x1654AE6B, 0x1F43B675, 0x1C53BB6B, 0x1254C367, 0x1043A770, 0x1941A469]);   // SeekHead Info Tracks Cluster Cues Tags Chapters Attachments
  const uB = (n, len) => { const a = new Uint8Array(len); for (let i = len - 1; i >= 0; i--) { a[i] = n % 256; n = Math.floor(n / 256); } return a; };   // big-endian uint, fixed length
  const idB = id => { let l = 1; while (id >= 256 ** l) l++; return uB(id, l); };
  const cat = a => { const r = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of a) { r.set(x, o); o += x.length; } return r; };
  const mk = (id, pay, fixed) => {   // element; size vint fixed to `fixed` bytes (8 for the Segment) or minimal
    let l = fixed || 1; while (!fixed && pay.length >= 2 ** (7 * l) - 1) l++;
    const s = uB(pay.length, l); s[0] |= 0x80 >> (l - 1); return cat([idB(id), s, pay]);
  };
  const u8 = (id, n) => mk(id, uB(n, 8));   // fixed 8-byte uint element (sizes never depend on the value)
  function fix(b) {
    const h = el(b, 0, b.length); if (h.id !== 0x1A45DFA3 || h.de < 0) return null;
    const sg = el(b, h.de, b.length); if (sg.id !== 0x18538067) return null;
    const sEnd = sg.de < 0 ? b.length : sg.de;
    let info = null, tracks = null; const cl = [];
    for (let p = sg.ds; p < sEnd;) {   // level-1 walk; an unknown-size Cluster ends at the next level-1 element
      const e = el(b, p, sEnd);
      if (e.de < 0) { let q = e.ds; while (q < sEnd) { const c = el(b, q, sEnd); if (L1.has(c.id)) break; if (c.de < 0) throw 0; q = c.de; } e.de = q; }
      if (e.id === 0x1549A966) info = e; else if (e.id === 0x1654AE6B) tracks = e; else if (e.id === 0x1F43B675) cl.push(e);
      p = e.de;
    }
    if (!info || !tracks || !cl.length) return null;
    let vtrack = 0, isVid = false, end = 0;   // end = last block end in ticks (TimecodeScale units, as Duration)
    const iKids = kids(b, info.ds, info.de).filter(e => e.id !== 0x4489);   // old Duration dropped
    for (const t of kids(b, tracks.ds, tracks.de)) if (t.id === 0xAE) {   // TrackEntry: first video track (else first track) is the one cued
      let num = 0, type = 0; for (const e of kids(b, t.ds, t.de)) { if (e.id === 0xD7) num = uint(b, e); else if (e.id === 0x83) type = uint(b, e); }
      if (!vtrack || (type === 1 && !isVid)) { vtrack = num; isVid = type === 1; }
    }
    for (const c of cl) {
      let tc = 0, blocks = [];
      for (const e of kids(b, c.ds, c.de)) {
        if (e.id === 0xE7) tc = uint(b, e);
        else if (e.id === 0xA3) blocks.push([e, 0]);
        else if (e.id === 0xA0) { let bd = 0, bl = null; for (const x of kids(b, e.ds, e.de)) { if (x.id === 0xA1) bl = x; else if (x.id === 0x9B) bd = uint(b, x); } if (bl) blocks.push([bl, bd]); }
      }
      c.tc = tc;
      for (const [e, bd] of blocks) { const v = vint(b, e.ds), r = (b[e.ds + v.len] << 8 | b[e.ds + v.len + 1]) << 16 >> 16; end = Math.max(end, tc + r + bd); }
    }
    const dur = new Uint8Array(11); dur.set([0x44, 0x89, 0x88]); new DataView(dur.buffer).setFloat64(3, end);   // Duration, float64, in TimecodeScale ticks
    const infoB = mk(0x1549A966, cat([...iKids.map(e => b.subarray(e.p, e.de)), dur]));
    const trB = b.subarray(tracks.p, tracks.de);
    const cues = () => mk(0x1C53BB6B, cat(cl.map(c => mk(0xBB, cat([u8(0xB3, c.tc), mk(0xB7, cat([u8(0xF7, vtrack), u8(0xF1, c.pos)]))])))));   // CueClusterPosition is relative to the Segment data start
    const seek = (id, pos) => mk(0x4DBB, cat([mk(0x53AB, idB(id)), u8(0x53AC, pos)]));
    const shLen = mk(0x114D9B74, cat([seek(0x1549A966, 0), seek(0x1654AE6B, 0), seek(0x1C53BB6B, 0)])).length;   // fixed-width fields: sizes known before the positions
    const cuesLen = (cl.forEach(c => c.pos = 0), cues()).length;
    const pInfo = shLen, pTr = pInfo + infoB.length, pCues = pTr + trB.length, pCl = pCues + cuesLen;
    let o = pCl; for (const c of cl) { c.pos = o; o += 4 + 8 + (c.de - c.ds); }   // cluster = id (4) + size (8) + payload
    const sh = mk(0x114D9B74, cat([seek(0x1549A966, pInfo), seek(0x1654AE6B, pTr), seek(0x1C53BB6B, pCues)]));
    const parts = [sh, infoB, trB, cues()];
    for (const c of cl) parts.push(mk(0x1F43B675, b.subarray(c.ds, c.de), 8));
    return cat([b.subarray(h.p, h.de), mk(0x18538067, cat(parts), 8)]);
  }
  try { return fix(src) || src; } catch (e) { return src; }
}
