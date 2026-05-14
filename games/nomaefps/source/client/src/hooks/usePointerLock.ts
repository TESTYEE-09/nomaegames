import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store';

export function usePointerLock(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const store = useGameStore();
  const yaw = useRef(0);
  const pitch = useRef(0);

  const requestLock = useCallback(() => {
    canvasRef.current?.requestPointerLock();
  }, [canvasRef]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvasRef.current) return;
      const sens = store.sensitivity * 0.002;
      yaw.current -= e.movementX * sens;
      pitch.current -= e.movementY * sens;
      pitch.current = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch.current));
    };

    const onLockChange = () => {
      store.setPointerLocked(document.pointerLockElement === canvasRef.current);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, [canvasRef, store]);

  return { yaw, pitch, requestLock };
}
