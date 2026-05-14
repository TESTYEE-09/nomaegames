import { useEffect } from 'react';
import { useGameStore } from './store';
import { MainMenu } from './ui/MainMenu';
import { GameScene } from './game/GameScene';
import { HUD } from './ui/HUD';
import { Settings } from './ui/Settings';

export default function App() {
  const store = useGameStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        store.setShowScoreboard(true);
      }
      if (e.key === 'Escape') {
        if (store.inGame) {
          store.setShowSettings(!store.showSettings);
          if (!store.showSettings) {
            document.exitPointerLock();
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        store.setShowScoreboard(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [store, store.inGame, store.showSettings]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {!store.inGame && <MainMenu />}
      {store.inGame && (
        <>
          <GameScene />
          <HUD />
        </>
      )}
      {store.showSettings && <Settings />}
    </div>
  );
}
