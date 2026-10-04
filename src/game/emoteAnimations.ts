import * as THREE from 'three';

export type EmoteType = 'none' | '67' | 'amostradinho' | 'dolorido' | 'pose_v' | 'arranca_olho';

export interface EmoteState {
  currentEmote: EmoteType;
  timer: number;
  duration: number;
  wheelOpen: boolean;
}

export interface EmoteArmsTransform {
  leftPosOffset: THREE.Vector3;
  leftRotOffset: THREE.Euler;
  rightPosOffset: THREE.Vector3;
  rightRotOffset: THREE.Euler;
  leftFingerCurls: { thumb: number; index: number; middle: number; ring: number; pinky: number };
  rightFingerCurls: { thumb: number; index: number; middle: number; ring: number; pinky: number };
  active: boolean;
}

export function calculateEmoteTransforms(
  emote: EmoteType,
  progress: number,
  currentTime: number
): EmoteArmsTransform {
  const leftPos = new THREE.Vector3();
  const leftRot = new THREE.Euler(0, 0, 0);
  const rightPos = new THREE.Vector3();
  const rightRot = new THREE.Euler(0, 0, 0);
  let leftCurls = { thumb: 0.2, index: 0.2, middle: 0.2, ring: 0.2, pinky: 0.2 };
  let rightCurls = { thumb: 0.2, index: 0.2, middle: 0.2, ring: 0.2, pinky: 0.2 };

  if (emote === 'none' || progress <= 0 || progress >= 1) {
    return {
      leftPosOffset: leftPos,
      leftRotOffset: leftRot,
      rightPosOffset: rightPos,
      rightRotOffset: rightRot,
      leftFingerCurls: { thumb: 0.65, index: 0.7, middle: 0.7, ring: 0.7, pinky: 0.7 },
      rightFingerCurls: { thumb: 0.65, index: 0.7, middle: 0.7, ring: 0.7, pinky: 0.7 },
      active: false,
    };
  }

  const envelope = Math.sin(progress * Math.PI);
  const t = currentTime * 0.001;

  if (emote === '67') {
    // Palmas viradas para cima, ondulação rítmica
    const rhythm = Math.sin(t * 8.0);
    const swayX = Math.cos(t * 4.0) * 0.035;
    leftPos.set(-0.08 + swayX, 0.18 + rhythm * 0.04, -0.10).multiplyScalar(envelope);
    rightPos.set(0.08 - swayX, 0.18 - rhythm * 0.04, -0.10).multiplyScalar(envelope);
    // Palmas viradas para frente / viradas ao contrário do rosto (rotacionadas no eixo Z / Y)
    leftRot.set(0.65 + rhythm * 0.15, 0.4, Math.PI - 0.2);
    rightRot.set(0.65 - rhythm * 0.15, -0.4, -Math.PI + 0.2);
    leftCurls  = { thumb: 0.1, index: 0.15, middle: 0.15, ring: 0.18, pinky: 0.2 };
    rightCurls = { thumb: 0.1, index: 0.15, middle: 0.15, ring: 0.18, pinky: 0.2 };

  } else if (emote === 'amostradinho') {
    // Sequência frenética: jab -> cruzado -> gancho -> rápido de novo -> crossover final
    const p = progress;
    const cycle = p * 5.0; // mais ciclos na duração

    const phase = cycle % 1.0;
    const punchIndex = Math.floor(cycle) % 4;

    let lp = new THREE.Vector3();
    let lr = new THREE.Euler();
    let rp = new THREE.Vector3();
    let rr = new THREE.Euler();
    let lc = { thumb: 0.92, index: 0.96, middle: 0.96, ring: 0.96, pinky: 0.96 };
    let rc = { thumb: 0.92, index: 0.96, middle: 0.96, ring: 0.96, pinky: 0.96 };

    const ext = Math.sin(phase * Math.PI);

    if (punchIndex === 0) {
      // Jab leve esquerda
      lp.set(-0.10 - ext * 0.20, -0.24 + ext * 0.06, -0.40 - ext * 0.52);
      lr.set(ext * 0.18, ext * 0.12, ext * 0.28);
      rp.set(0.22, -0.28, -0.38);
      rr.set(0.05, -0.12, -0.08);
    } else if (punchIndex === 1) {
      // Cruzado direita
      rp.set(0.10 + ext * 0.22, -0.24 + ext * 0.06, -0.40 - ext * 0.58);
      rr.set(ext * 0.14, -ext * 0.30, -ext * 0.28);
      lp.set(-0.22, -0.28, -0.38);
      lr.set(0.05, 0.12, 0.08);
    } else if (punchIndex === 2) {
      // Gancho esquerda
      lp.set(-0.12 + ext * 0.24, -0.26 - ext * 0.04, -0.42 - ext * 0.22);
      lr.set(-ext * 0.20, -ext * 0.90, ext * 0.80);
      rp.set(0.24, -0.30, -0.38);
      rr.set(0.10, -0.15, -0.12);
    } else {
      // Uppercut direita
      rp.set(0.18 - ext * 0.10, -0.38 + ext * 0.52, -0.42 - ext * 0.32);
      rr.set(ext * 1.3, ext * 0.28, -ext * 0.38);
      lp.set(-0.24, -0.28, -0.38);
      lr.set(0.05, 0.12, 0.08);
    }

    const envelopeLocal = Math.sin(Math.min(1, p * 2.2) * Math.PI);
    leftPos.copy(lp).multiplyScalar(envelopeLocal);
    rightPos.copy(rp).multiplyScalar(envelopeLocal);
    leftRot.copy(lr);
    rightRot.copy(rr);
    leftCurls = lc;
    rightCurls = rc;

  } else if (emote === 'dolorido') {
    // Fecha/abre com tremor de dor
    const clenchCycle = Math.sin(t * 5.0);
    const tremor = (Math.sin(t * 45.0) + Math.cos(t * 60.0)) * 0.008;
    leftPos.set(0.08 + tremor, 0.06 + clenchCycle * 0.03, -0.05).multiplyScalar(envelope);
    rightPos.set(-0.04 + tremor * 1.4, 0.10 + clenchCycle * 0.04, -0.08).multiplyScalar(envelope);
    leftRot.set(0.35 + clenchCycle * 0.25, 0.45, 0.6 * envelope);
    rightRot.set(-0.65 - clenchCycle * 0.4, -0.65, -0.85 * envelope);
    const clench = (Math.sin(t * 5.0) * 0.5 + 0.5) * envelope;
    leftCurls  = { thumb: clench * 0.85, index: clench, middle: clench, ring: clench * 0.9, pinky: clench * 0.9 };
    rightCurls = { thumb: 0.2, index: 0.3, middle: 0.3, ring: 0.3, pinky: 0.3 };

  } else if (emote === 'pose_v') {
    // Anime duplo V nas bochechas balançando
    const cuteSway = Math.sin(t * 6.5);
    const cuteTilt = Math.cos(t * 6.5);
    leftPos.set(-0.06 + cuteSway * 0.025, 0.18 + Math.abs(cuteSway) * 0.02, -0.10).multiplyScalar(envelope);
    rightPos.set(0.06 - cuteSway * 0.025, 0.18 + Math.abs(cuteSway) * 0.02, -0.10).multiplyScalar(envelope);
    leftRot.set(0.65 + cuteTilt * 0.15, -0.55, -0.75 * envelope);
    rightRot.set(0.65 - cuteTilt * 0.15, 0.55, 0.75 * envelope);
    leftCurls  = { thumb: 0.85, index: 0.0, middle: 0.0, ring: 0.95, pinky: 0.95 };
    rightCurls = { thumb: 0.85, index: 0.0, middle: 0.0, ring: 0.95, pinky: 0.95 };

  } else if (emote === 'arranca_olho') {
    // ARRANCA OLHO — 1 olho por mão, mãos sobem até o rosto, olhos colam na lente
    // Fase 1 (0–0.30): sobe até as órbitas
    // Fase 2 (0.30–0.55): pinça e treme no rosto
    // Fase 3 (0.55–0.85): puxa os olhos pra frente com força
    // Fase 4 (0.85–1.0): esmaga e mantém na lente
    const p = progress;

    if (p < 0.30) {
      const reach = Math.sin((p / 0.30) * Math.PI * 0.5);
      leftPos.set(0.22 * reach, 0.38 * reach, 0.24 * reach);
      rightPos.set(-0.22 * reach, 0.38 * reach, 0.24 * reach);
      leftRot.set(-0.55 + reach * 0.35, 0.30, -0.35);
      rightRot.set(-0.55 + reach * 0.35, -0.30, 0.35);
      leftCurls  = { thumb: 0.1, index: 0.04, middle: 0.04, ring: 0.7, pinky: 0.75 };
      rightCurls = { thumb: 0.1, index: 0.04, middle: 0.04, ring: 0.7, pinky: 0.75 };

    } else if (p < 0.55) {
      const grip = Math.sin(((p - 0.30) / 0.25) * Math.PI * 0.5);
      const tremor = Math.sin(t * 55.0) * 0.010 * grip;
      leftPos.set(0.02 + tremor, 0.40, 0.26);
      rightPos.set(-0.02 - tremor, 0.40, 0.26);
      leftRot.set(-0.20, 0.20, -0.20 + grip * 0.15);
      rightRot.set(-0.20, -0.20, 0.20 - grip * 0.15);
      const pinch = {
        thumb:  0.1 + grip * 0.85,
        index:  0.04 + grip * 0.92,
        middle: 0.04 + grip * 0.92,
        ring:   0.7 + grip * 0.2,
        pinky:  0.75 + grip * 0.2,
      };
      leftCurls = pinch;
      rightCurls = { ...pinch };

    } else if (p < 0.85) {
      const pull = Math.sin(((p - 0.55) / 0.30) * Math.PI * 0.5);
      leftPos.set(0.02, 0.40, 0.26);
      rightPos.set(-0.02, 0.40, 0.26);
      leftRot.set(-0.20 - pull * 0.40, 0.20 - pull * 0.15, -0.20 + pull * 0.30);
      rightRot.set(-0.20 - pull * 0.40, -0.20 + pull * 0.15, 0.20 - pull * 0.30);
      leftCurls  = { thumb: 0.95, index: 0.98, middle: 0.98, ring: 0.95, pinky: 0.95 };
      rightCurls = { thumb: 0.95, index: 0.98, middle: 0.98, ring: 0.95, pinky: 0.95 };

    } else {
      const crush = Math.sin(((p - 0.85) / 0.15) * Math.PI * 0.5);
      leftPos.set(0.02, 0.40, 0.26);
      rightPos.set(-0.02, 0.40, 0.26);
      leftRot.set(-0.60 - crush * 0.25, 0.05, -0.10 + crush * 0.20);
      rightRot.set(-0.60 - crush * 0.25, -0.05, 0.10 - crush * 0.20);
      leftCurls  = { thumb: 0.98, index: 0.99, middle: 0.99, ring: 0.98, pinky: 0.98 };
      rightCurls = { thumb: 0.98, index: 0.99, middle: 0.99, ring: 0.98, pinky: 0.98 };
    }
  }

  return {
    leftPosOffset: leftPos,
    leftRotOffset: leftRot,
    rightPosOffset: rightPos,
    rightRotOffset: rightRot,
    leftFingerCurls: leftCurls,
    rightFingerCurls: rightCurls,
    active: emote === 'arranca_olho' ? true : envelope > 0.001,
  };
}
