/**
 * WebHot - Dynamic Web Audio API Engine
 * Implements PRD specifications:
 * - Dynamic low-pass BiquadFilter driven by dtFactor (muffled below 180Hz when still)
 * - DelayNode with time-stretch echo tail
 * - Real-time pitch-shifting and procedural sound synthesis (gunshot, bullet flyby, glass shatter, heartbeat)
 * - Iconic "SUPER. HOT." synthesized rhythm
 */

import {
  synthGunpowderNoise,
  synthGlassCrystallineCluster,
  synthMaleSuperVoice,
  synthMaleHotVoice,
  synthCyberHotswitch,
} from './audioSynthUtils';

export class SuperhotAudio {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  // Master audio nodes for time dilation
  private masterFilter: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // Lazy initialized on first user click
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);


      // Low-pass Filter (Time-stretching & adrenaline concentration)
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setValueAtTime(12000, this.ctx.currentTime);
      this.masterFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      // Delay Node for spatial slow-motion echo
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.setValueAtTime(0.24, this.ctx.currentTime);

      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.setValueAtTime(0.25, this.ctx.currentTime);

      // Delay loop
      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);

      // Chain: MasterFilter -> MasterGain & DelayNode -> Destination
      this.masterFilter.connect(this.masterGain);
      this.masterFilter.connect(this.delayNode);
      this.delayNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

    } catch (e) {
      console.warn('AudioContext not allowed yet:', e);
    }
  }

  public setMasterVolume(v: number) {
    this.init();
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.85, this.ctx.currentTime, 0.05);
  }

  public stopAll() {
    this.stopMantra();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }

  public resumeAmbient() {
    // Drone removido — sem ruído ambiente
  }

  /**
   * Update audio filtering based on the real-time dtFactor
   * @param dtFactor: 0.005 (completely frozen) to 1.0 (full speed)
   */
  public updateTimeDilation(dtFactor: number) {
    if (!this.ctx || !this.masterFilter || !this.delayFeedback) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    // When dtFactor is small (standing still), cutoff falls to ~160Hz (muffled adrenaline)
    // When moving (dtFactor = 1.0), cutoff opens up to ~14000Hz (crisp realistic world)
    const targetFreq = Math.max(160, Math.pow(dtFactor, 0.7) * 14000);
    this.masterFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);

    // Increase delay echo in slow motion
    const targetFeedback = THREE_LERP(0.55, 0.15, dtFactor);
    this.delayFeedback.gain.setTargetAtTime(targetFeedback, now, 0.1);

    // Drone pitch deepens as time halts — removido (sem ruído contínuo)

    // Heartbeat removido
  }

  /**
   * Player Gunshot: Punchy mechanical crack, pitch shifts down heavily with dtFactor
   */
  public playGunshot(dtFactor: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterFilter) return;

    const now = this.ctx.currentTime;
    const speedRatio = Math.max(0.15, dtFactor);

    // 1. Noise transient (gunpowder explosion)
    synthGunpowderNoise(this.ctx, this.masterFilter, speedRatio, now);

    // 2. Punchy low-end sub hit
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(160 * speedRatio, now);
    subOsc.frequency.exponentialRampToValueAtTime(35 * speedRatio, now + 0.15 / speedRatio);

    subGain.gain.setValueAtTime(0.4, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2 / speedRatio);

    subOsc.connect(subGain);
    subGain.connect(this.masterFilter);

    subOsc.start(now);
    subOsc.stop(now + 0.2 / speedRatio);
  }

  /**
   * Enemy Gunshot: Darker, sharper warning crack
   */
  public playEnemyGunshot(dtFactor: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterFilter) return;

    const now = this.ctx.currentTime;
    const speedRatio = Math.max(0.18, dtFactor);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440 * speedRatio, now);
    osc.frequency.exponentialRampToValueAtTime(60 * speedRatio, now + 0.18 / speedRatio);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18 / speedRatio);

    osc.connect(gain);
    gain.connect(this.masterFilter);

    osc.start(now);
    osc.stop(now + 0.18 / speedRatio);
  }

  /**
   * Glass Shatter: Signature Superhot crystalline burst + sub bass impact
   */
  public playGlassShatter(dtFactor: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterFilter) return;

    const now = this.ctx.currentTime;
    const speedRatio = Math.max(0.2, dtFactor);

    // Chime crystalline cluster (3 sine harmonics)
    synthGlassCrystallineCluster(this.ctx, this.masterFilter, speedRatio, now);

    // Deep shatter thud
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(90 * speedRatio, now);
    thud.frequency.exponentialRampToValueAtTime(20, now + 0.3 / speedRatio);

    thudGain.gain.setValueAtTime(0.4, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3 / speedRatio);

    thud.connect(thudGain);
    thudGain.connect(this.masterFilter);

    thud.start(now);
    thud.stop(now + 0.3 / speedRatio);
  }

  /**
   * Throw Weapon / Whoosh
   */
  public playThrow(dtFactor: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterFilter) return;

    const now = this.ctx.currentTime;
    const speedRatio = Math.max(0.2, dtFactor);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 * speedRatio, now);
    osc.frequency.exponentialRampToValueAtTime(320 * speedRatio, now + 0.08 / speedRatio);
    osc.frequency.exponentialRampToValueAtTime(80 * speedRatio, now + 0.2 / speedRatio);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2 / speedRatio);

    osc.connect(gain);
    gain.connect(this.masterFilter);

    osc.start(now);
    osc.stop(now + 0.2 / speedRatio);
  }

  /**
   * Bullet fly-by whiz when close to player's head
   */
  public playBulletWhiz() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterFilter) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterFilter);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  private mantraAudio: HTMLAudioElement | null = null;
  private mantraCache: Partial<Record<'SUPER' | 'HOT', HTMLAudioElement>> = {};

  /**
   * Iconic "SUPER. HOT." — WAV oficial, um de cada vez, sincronizado com o texto
   */
  public playSuperWord(word: 'SUPER' | 'HOT') {
    if (!this.enabled) return;

    this.stopMantra();

    try {
      let el = this.mantraCache[word];
      if (!el) {
        el = new Audio(word === 'SUPER' ? '/audio/super.wav' : '/audio/hot.wav');
        el.preload = 'auto';
        this.mantraCache[word] = el;
      }
      el.currentTime = 0;
      el.volume = 1.0;
      this.mantraAudio = el;
      el.play().catch(() => {
        this.init();
        if (this.ctx) {
          if (word === 'SUPER') synthMaleSuperVoice(this.ctx, this.ctx.currentTime);
          else synthMaleHotVoice(this.ctx, this.ctx.currentTime);
        }
      });
    } catch {
      this.init();
      if (this.ctx) {
        if (word === 'SUPER') synthMaleSuperVoice(this.ctx, this.ctx.currentTime);
        else synthMaleHotVoice(this.ctx, this.ctx.currentTime);
      }
    }
  }

  public stopMantra() {
    if (this.mantraAudio) {
      try {
        this.mantraAudio.pause();
        this.mantraAudio.currentTime = 0;
      } catch {
        /* ignore */
      }
      this.mantraAudio = null;
    }
  }

  public playSuperHotChant() {
    this.playSuperWord('SUPER');
    setTimeout(() => {
      this.playSuperWord('HOT');
    }, 1200);
  }

  /**
   * Iconic HOTSWITCH cyber-teleport warp sound
   */
  public playHotswitch() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    synthCyberHotswitch(this.ctx, this.ctx.currentTime);
  }

  private playVocalChirp(startFreq: number, endFreq: number, delaySec: number, duration = 0.2) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delaySec;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(3.0, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Player death sound
   */
  public playPlayerHit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.6);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  /**
   * Punch swoosh sound through air
   */
  public playPunchSwing(dtFactor: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterFilter) return;

    const now = this.ctx.currentTime;
    const speedRatio = Math.max(0.2, dtFactor);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80 * speedRatio, now);
    osc.frequency.exponentialRampToValueAtTime(240 * speedRatio, now + 0.08 / speedRatio);
    osc.frequency.exponentialRampToValueAtTime(40 * speedRatio, now + 0.18 / speedRatio);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18 / speedRatio);

    osc.connect(gain);
    gain.connect(this.masterFilter);

    osc.start(now);
    osc.stop(now + 0.18 / speedRatio);
  }

  /**
   * Punch impact: Heavy blunt thud on crystalline red enemy
   */
  public playPunchImpact(dtFactor: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterFilter) return;

    const now = this.ctx.currentTime;
    const speedRatio = Math.max(0.2, dtFactor);

    // Sub thump
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(180 * speedRatio, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.15 / speedRatio);

    subGain.gain.setValueAtTime(0.45, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15 / speedRatio);

    sub.connect(subGain);
    subGain.connect(this.masterFilter);

    sub.start(now);
    sub.stop(now + 0.15 / speedRatio);

    // Crack
    const crack = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(450 * speedRatio, now);
    crack.frequency.exponentialRampToValueAtTime(90, now + 0.08 / speedRatio);

    crackGain.gain.setValueAtTime(0.3, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08 / speedRatio);

    crack.connect(crackGain);
    crackGain.connect(this.masterFilter);

    crack.start(now);
    crack.stop(now + 0.08 / speedRatio);
  }

  /**
   * Mid-air weapon catch: Distinct metallic snap
   */
  public playWeaponCatch() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Shotgun blast (deep cannon boom)
   */
  public playShotgunBlast(dtFactor: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterFilter) return;

    const now = this.ctx.currentTime;
    const speedRatio = Math.max(0.15, dtFactor);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220 * speedRatio, now);
    osc.frequency.exponentialRampToValueAtTime(30 * speedRatio, now + 0.35 / speedRatio);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35 / speedRatio);

    osc.connect(gain);
    gain.connect(this.masterFilter);

    osc.start(now);
    osc.stop(now + 0.35 / speedRatio);
  }

  /**
   * Terminal typing click
   */
  public playTerminalKey() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(900 + Math.random() * 400, now);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.02);
  }
}

function THREE_LERP(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export const superhotSound = new SuperhotAudio();
