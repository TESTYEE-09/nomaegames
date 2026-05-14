import { useGameStore } from '../store';
import { Crosshair } from './Crosshair';
import { KillFeed } from './KillFeed';
import { Scoreboard } from './Scoreboard';

export function HUD() {
  const store = useGameStore();
  const isHitmarker = Date.now() - store.hitmarkerTime < 150;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: 100
    }}>
      <Crosshair />
      <KillFeed />
      {store.showScoreboard && <Scoreboard />}

      {/* Health - Bottom Left */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '8px',
          background: store.localHealth > 50 ? '#4a9e8e' : store.localHealth > 25 ? '#d4845a' : '#b85050',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: '800',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {store.localHealth}
        </div>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: '600', letterSpacing: '1px' }}>
            HEALTH
          </div>
          <div style={{
            width: '120px',
            height: '6px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '3px',
            marginTop: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${store.localHealth}%`,
              height: '100%',
              background: store.localHealth > 50 ? '#4a9e8e' : store.localHealth > 25 ? '#d4845a' : '#b85050',
              borderRadius: '3px',
              transition: 'width 0.2s'
            }} />
          </div>
        </div>
      </div>

      {/* Ammo - Bottom Right */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        textAlign: 'right'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{
            fontSize: '36px',
            fontWeight: '800',
            color: store.localAmmo === 0 ? '#b85050' : '#fff'
          }}>
            {store.localAmmo}
          </span>
          <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
            / {store.localReserve}
          </span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: '600', letterSpacing: '1px' }}>
          {store.localIsReloading ? 'RELOADING...' : 'ASSAULT RIFLE'}
        </div>
      </div>

      {/* Timer / Score - Top Center */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          borderRadius: '8px',
          padding: '8px 20px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {Math.floor(store.timeRemaining / 60)}:{String(store.timeRemaining % 60).padStart(2, '0')}
          </div>
          <div style={{ fontSize: '11px', color: '#d4845a', fontWeight: '600', letterSpacing: '1px' }}>
            FREE FOR ALL
          </div>
        </div>
      </div>

      {/* Room Code - Top Left */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        borderRadius: '6px',
        padding: '6px 12px'
      }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>ROOM </span>
        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '700', letterSpacing: '2px' }}>
          {store.roomCode}
        </span>
      </div>

      {/* Hitmarker */}
      {isHitmarker && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '800',
          textShadow: '0 0 8px rgba(255,255,255,0.8)',
          animation: 'hitmarker 0.15s ease-out'
        }}>
          <style>{`
            @keyframes hitmarker {
              0% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
            }
          `}</style>
          ✕
        </div>
      )}

      {/* Damage flash */}
      {store.localHealth < 30 && store.localHealth > 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle, transparent 60%, rgba(184,80,80,0.3) 100%)',
          animation: 'pulse 1s ease-in-out infinite'
        }}>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.6; }
            }
          `}</style>
        </div>
      )}

      {/* Game Over */}
      {store.gameEnded && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <h1 style={{ color: '#d4845a', fontSize: '48px', margin: '0 0 16px 0' }}>MATCH OVER</h1>
          <p style={{ color: '#fff', fontSize: '24px', margin: 0 }}>
            {store.winnerName} wins!
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '32px',
              padding: '14px 32px',
              borderRadius: '8px',
              border: 'none',
              background: '#d4845a',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
