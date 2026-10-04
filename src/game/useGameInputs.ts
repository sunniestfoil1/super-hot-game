import { useEffect } from 'react';

interface GameInputListenersParams {
  container: HTMLDivElement | null;
  gameState: 'menu' | 'playing' | 'cleared' | 'gameover';
  keys: { w: boolean; s: boolean; a: boolean; d: boolean; space: boolean; e: boolean };
  currentWeapon: string | null;
  onWallJump: () => void;
  onCatchWeapon: () => void;
  onHotswitch: () => void;
  onRestartLevel: () => void;
  onToggleDev: () => void;
  onTriggerEmote: (slot: 1 | 2 | 3 | 4 | 5) => void;
  onEmoteWheelOpen?: (open: boolean) => void;
  onFire: () => void;
  onThrow: () => void;
  onMouseMove: (deltaX: number, deltaY: number) => void;
  onPointerLockStateChange: (isLocked: boolean) => void;
}

export const useGameInputs = (params: GameInputListenersParams) => {
  const {
    container,
    gameState,
    keys,
    currentWeapon,
    onWallJump,
    onCatchWeapon,
    onHotswitch,
    onRestartLevel,
    onToggleDev,
    onTriggerEmote,
    onEmoteWheelOpen,
    onFire,
    onThrow,
    onMouseMove,
    onPointerLockStateChange,
  } = params;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true;

      if (e.code === 'Space') {
        keys.space = true;
        onWallJump();
        e.preventDefault();
      }
      if (e.code === 'KeyE') {
        keys.e = true;
        onCatchWeapon();
      }
      if (e.code === 'KeyF') {
        onHotswitch();
      }
      if (e.code === 'KeyR') {
        onRestartLevel();
      }
      if (e.repeat) return;
      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        onTriggerEmote(1);
        return;
      }
      if (e.code === 'Digit2' || e.code === 'Numpad2') {
        onTriggerEmote(2);
        return;
      }
      if (e.code === 'Digit3' || e.code === 'Numpad3') {
        onTriggerEmote(3);
        return;
      }
      if (e.code === 'Digit4' || e.code === 'Numpad4') {
        onTriggerEmote(4);
        return;
      }
      if (e.code === 'Digit5' || e.code === 'Numpad5') {
        onTriggerEmote(5);
        return;
      }
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      if (e.code === 'KeyP') {
        onToggleDev();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = false;
      if (e.code === 'Space') keys.space = false;
      if (e.code === 'KeyE') keys.e = false;
      if (e.code === 'Tab') onEmoteWheelOpen?.(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (gameState === 'gameover') return;

      if (document.pointerLockElement !== container && container) {
        container.requestPointerLock();
      }

      if (e.button === 0) {
        if (currentWeapon === null) {
          onCatchWeapon();
        }
        onFire();
      } else if (e.button === 2) {
        onThrow();
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (gameState === 'gameover') return;
      if (document.pointerLockElement === container) {
        onMouseMove(e.movementX, e.movementY);
      }
    };

    const onPointerLockChange = () => {
      onPointerLockStateChange(document.pointerLockElement === container);
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    if (container) {
      container.addEventListener('mousedown', onMouseDown);
      container.addEventListener('contextmenu', onContextMenu);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      if (container) {
        container.removeEventListener('mousedown', onMouseDown);
        container.removeEventListener('contextmenu', onContextMenu);
      }
    };
  }, [
    container,
    gameState,
    keys,
    currentWeapon,
    onWallJump,
    onCatchWeapon,
    onHotswitch,
    onRestartLevel,
    onToggleDev,
    onTriggerEmote,
    onEmoteWheelOpen,
    onFire,
    onThrow,
    onMouseMove,
    onPointerLockStateChange,
  ]);
};
