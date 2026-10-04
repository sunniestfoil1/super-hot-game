/**
 * Audio Synthesis procedural helpers for SuperhotAudio engine
 */

export function synthGunpowderNoise(
  ctx: AudioContext,
  masterFilter: BiquadFilterNode,
  speedRatio: number,
  now: number
) {
  const bufferSize = Math.floor(ctx.sampleRate * 0.25);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.playbackRate.setValueAtTime(speedRatio, now);

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(1400 * speedRatio, now);
  noiseFilter.Q.setValueAtTime(2.0, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.35, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 / speedRatio);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterFilter);

  noise.start(now);
  noise.stop(now + 0.25 / speedRatio);
}

export function synthGlassCrystallineCluster(
  ctx: AudioContext,
  masterFilter: BiquadFilterNode,
  speedRatio: number,
  now: number
) {
  const freqs = [1800, 2400, 3200, 4800];
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * speedRatio, now + idx * 0.015);
    osc.frequency.exponentialRampToValueAtTime(
      freq * 0.4 * speedRatio,
      now + (0.35 + idx * 0.05) / speedRatio
    );

    gain.gain.setValueAtTime(0.15, now + idx * 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (0.4 + idx * 0.05) / speedRatio);

    osc.connect(gain);
    gain.connect(masterFilter);

    osc.start(now + idx * 0.015);
    osc.stop(now + (0.45 + idx * 0.05) / speedRatio);
  });
}

export function synthMaleSuperVoice(ctx: AudioContext, now: number) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'square';
  osc1.frequency.setValueAtTime(120, now);
  osc1.frequency.linearRampToValueAtTime(95, now + 0.35);

  osc2.frequency.setValueAtTime(124, now);
  osc2.frequency.linearRampToValueAtTime(98, now + 0.35);

  const formant = ctx.createBiquadFilter();
  formant.type = 'bandpass';
  formant.frequency.setValueAtTime(550, now);
  formant.Q.setValueAtTime(4.5, now);

  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

  osc1.connect(formant);
  osc2.connect(formant);
  formant.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.42);
  osc2.stop(now + 0.42);
}

export function synthMaleHotVoice(ctx: AudioContext, now: number) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(160, now);
  osc1.frequency.exponentialRampToValueAtTime(45, now + 0.35);

  osc2.frequency.setValueAtTime(165, now);
  osc2.frequency.exponentialRampToValueAtTime(48, now + 0.35);

  const formant = ctx.createBiquadFilter();
  formant.type = 'lowpass';
  formant.frequency.setValueAtTime(800, now);
  formant.Q.setValueAtTime(2.0, now);

  gain.gain.setValueAtTime(0.65, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

  osc1.connect(formant);
  osc2.connect(formant);
  formant.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.38);
  osc2.stop(now + 0.38);
}

export function synthCyberHotswitch(ctx: AudioContext, now: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(1400, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(2400, now + 0.18);
  filter.Q.setValueAtTime(6.0, now);

  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.45);
}
