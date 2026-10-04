import { EmoteType } from './emoteAnimations';

export interface EmoteControllerState {
  currentEmote: EmoteType;
  emoteTimer: number;
  emoteDuration: number;
}

export function createInitialEmoteState(): EmoteControllerState {
  return {
    currentEmote: 'none',
    emoteTimer: 0,
    emoteDuration: 0,
  };
}

export function triggerEmoteBySlot(
  slot: 1 | 2 | 3 | 4 | 5,
  state: EmoteControllerState,
  onStateChange: (emote: EmoteType) => void
) {
  const slotMap: Record<1 | 2 | 3 | 4 | 5, EmoteType> = {
    1: '67',
    2: 'amostradinho',
    3: 'dolorido',
    4: 'pose_v',
    5: 'arranca_olho',
  };

  const selected = slotMap[slot];
  // Se já estiver rodando este emote, reinicia do zero
  if (state.currentEmote === selected && state.emoteDuration > 0) {
    state.emoteTimer = 0;
    onStateChange(selected);
    return;
  }

  state.currentEmote = selected;
  state.emoteTimer = 0;
  state.emoteDuration = selected === 'amostradinho' ? 3.2 : selected === 'arranca_olho' ? 5.0 : 2.2;
  onStateChange(selected);
}

/** Cancela emote no meio (tiro, throw, etc). */
export function cancelEmote(
  state: EmoteControllerState,
  onStateChange: (emote: EmoteType) => void
) {
  if (state.currentEmote === 'none') return;
  state.currentEmote = 'none';
  state.emoteTimer = 0;
  state.emoteDuration = 0;
  onStateChange('none');
}

export function updateEmoteTick(
  rawDt: number,
  state: EmoteControllerState,
  onComplete: () => void
): number {
  if (state.currentEmote === 'none' || state.emoteDuration <= 0) {
    return 0;
  }

  state.emoteTimer += rawDt;
  const progress = state.emoteTimer / state.emoteDuration;

  if (progress >= 1.0) {
    state.currentEmote = 'none';
    state.emoteTimer = 0;
    state.emoteDuration = 0;
    onComplete();
    return 0;
  }

  return progress;
}
