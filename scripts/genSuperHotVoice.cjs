// Gera super.wav e hot.wav: voz masculina grave e robótica (síntese de formantes + ring-mod + bitcrush)
const fs = require('fs');
const SR = 44100;

function resonator(fc, bw) {
  const r = Math.exp(-Math.PI * bw / SR);
  const a1 = -2 * r * Math.cos(2 * Math.PI * fc / SR);
  const a2 = r * r;
  return { a1, a2, y1: 0, y2: 0, g: 1 - r };
}

// segments: {dur, f0, f:[f1,f2,f3], voiced, noise (0..1 hiss), amp}
function synth(segments) {
  const out = [];
  let phase = 0;
  const res = [resonator(500, 90), resonator(1500, 120), resonator(2500, 160)];
  const noiseRes = resonator(5500, 1800);
  let t = 0;
  for (const seg of segments) {
    const n = Math.floor(seg.dur * SR);
    for (let i = 0; i < n; i++, t++) {
      const k = i / n;
      const env = Math.min(1, i / (0.012 * SR)) * Math.min(1, (n - i) / (0.02 * SR)) * seg.amp;
      const f0 = seg.f0 * (1 - 0.1 * k);
      phase += f0 / SR;
      if (phase >= 1) phase -= 1;
      // pulso glotal (dente de serra suavizado)
      const glottal = seg.voiced ? (phase < 0.6 ? phase / 0.6 : (1 - phase) / 0.4) * 2 - 1 : 0;
      const noise = Math.random() * 2 - 1;
      let v = 0;
      for (let f = 0; f < 3; f++) {
        const R = res[f];
        if (seg.f) {
          const fc = seg.f[f];
          const rr = resonator(fc, 90 + f * 40);
          R.a1 = rr.a1; R.a2 = rr.a2; R.g = rr.g;
        }
        const x = glottal * 1.0 + noise * seg.breath;
        const y = R.g * x - R.a1 * R.y1 - R.a2 * R.y2;
        R.y2 = R.y1; R.y1 = y;
        v += y * (f === 0 ? 1.0 : f === 1 ? 0.7 : 0.35);
      }
      if (seg.noise) {
        const x = noise;
        const y = noiseRes.g * x - noiseRes.a1 * noiseRes.y1 - noiseRes.a2 * noiseRes.y2;
        noiseRes.y2 = noiseRes.y1; noiseRes.y1 = y;
        v += y * seg.noise * 6;
      }
      out.push(v * env);
    }
  }
  return out;
}

function robotize(buf) {
  const out = new Float32Array(buf.length);
  const delay = Math.floor(0.0055 * SR);
  let held = 0;
  for (let i = 0; i < buf.length; i++) {
    // ring-mod 55Hz (mistura) deixa metálico
    const ring = Math.sin(2 * Math.PI * 55 * i / SR);
    let v = buf[i] * (0.65 + 0.35 * ring);
    // comb metálico
    if (i >= delay) v += out[i - delay] * 0.45;
    // bitcrush: sample-hold 3 + 7 bits
    if (i % 3 === 0) held = Math.round(v * 64) / 64;
    out[i] = held;
  }
  // normaliza + soft clip
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh((out[i] / peak) * 1.8) * 0.9;
  return out;
}

function writeWav(path, data) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  fs.writeFileSync(path, b);
}

const F0 = 82; // grave
// SUPER: s(chiado) + u + p(estouro) + er
const superSeg = [
  { dur: 0.12, f0: F0, voiced: false, noise: 0.5, breath: 0, amp: 0.55 },
  { dur: 0.2, f0: F0 * 1.05, voiced: true, f: [330, 900, 2300], breath: 0.02, amp: 1.0 },
  { dur: 0.05, f0: F0, voiced: false, noise: 0.0, breath: 0, amp: 0.0 },
  { dur: 0.02, f0: F0, voiced: false, noise: 0.9, breath: 0, amp: 0.8 },
  { dur: 0.3, f0: F0 * 0.9, voiced: true, f: [490, 1300, 1650], breath: 0.02, amp: 0.95 },
];
const hotSeg = [
  { dur: 0.1, f0: F0, voiced: false, noise: 0.25, breath: 0.4, amp: 0.4 },
  { dur: 0.3, f0: F0 * 1.02, voiced: true, f: [600, 950, 2500], breath: 0.02, amp: 1.0 },
  { dur: 0.04, f0: F0, voiced: false, noise: 0.0, breath: 0, amp: 0.0 },
  { dur: 0.04, f0: F0, voiced: false, noise: 0.8, breath: 0, amp: 0.7 },
];

writeWav('public/audio/super.wav', robotize(synth(superSeg)));
writeWav('public/audio/hot.wav', robotize(synth(hotSeg)));
console.log('ok');
