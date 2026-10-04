import { superhotSound } from '../audio/SuperhotAudio';

export interface LevelClearParams {
  onSetGameState: (state: 'cleared') => void;
  onSetMantraWord: (word: 'SUPER' | 'HOT') => void;
  onAutoAdvance: () => void;
  intervalRef: { current: number | null };
}

/** SUPER → HOT × 3, lento, WAV sincronizado com o texto. */
export function startLevelClearMantra(params: LevelClearParams) {
  const { onSetGameState, onSetMantraWord, onAutoAdvance, intervalRef } = params;

  onSetGameState('cleared');

  // Limpa qualquer sequência anterior
  if (intervalRef.current) {
    clearTimeout(intervalRef.current);
    intervalRef.current = null;
  }
  superhotSound.stopMantra();

  // Cadência deliberada (wav SUPER~0.65s / HOT~0.55s + pausa)
  const BEATS: Array<{ word: 'SUPER' | 'HOT'; holdMs: number }> = [
    { word: 'SUPER', holdMs: 1200 },
    { word: 'HOT', holdMs: 1100 },
  ];

  let i = 0;

  const beat = () => {
    if (i >= BEATS.length) {
      intervalRef.current = null;
      intervalRef.current = window.setTimeout(() => onAutoAdvance(), 350);
      return;
    }
    const { word, holdMs } = BEATS[i++];
    onSetMantraWord(word);
    superhotSound.playSuperWord(word);
    intervalRef.current = window.setTimeout(beat, holdMs);
  };

  beat();
}
