import { useEffect, useRef, useCallback } from 'react';
import type { InputState } from '@shared/types';

export function useInput() {
  const inputs = useRef<InputState>({
    w: false, a: false, s: false, d: false, space: false, shift: false
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') inputs.current.w = true;
      if (key === 'a') inputs.current.a = true;
      if (key === 's') inputs.current.s = true;
      if (key === 'd') inputs.current.d = true;
      if (key === ' ') inputs.current.space = true;
      if (key === 'shift') inputs.current.shift = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') inputs.current.w = false;
      if (key === 'a') inputs.current.a = false;
      if (key === 's') inputs.current.s = false;
      if (key === 'd') inputs.current.d = false;
      if (key === ' ') inputs.current.space = false;
      if (key === 'shift') inputs.current.shift = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const getInputs = useCallback(() => inputs.current, []);

  return { inputs, getInputs };
}
