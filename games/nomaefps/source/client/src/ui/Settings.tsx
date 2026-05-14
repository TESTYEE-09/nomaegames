import { useGameStore } from '../store';

export function Settings() {
  const store = useGameStore();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'rgba(20,20,30,0.95)',
        borderRadius: '12px',
        padding: '32px',
        width: '340px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h2 style={{ color: '#fff', margin: '0 0 24px 0', fontSize: '24px' }}>Settings</h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
            Mouse Sensitivity
          </label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={store.sensitivity}
            onChange={(e) => store.setSensitivity(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <span style={{ color: '#fff', fontSize: '13px' }}>{store.sensitivity.toFixed(1)}</span>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
            Volume
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={store.volume}
            onChange={(e) => store.setVolume(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <span style={{ color: '#fff', fontSize: '13px' }}>{Math.round(store.volume * 100)}%</span>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
            Graphics Quality
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['low', 'medium', 'high'] as const).map(q => (
              <button
                key={q}
                onClick={() => store.setGraphicsQuality(q)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: store.graphicsQuality === q ? '#d4845a' : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            store.setShowSettings(false);
            if (store.inGame) {
              document.body.requestPointerLock();
            }
          }}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '8px',
            border: 'none',
            background: '#d4845a',
            color: '#fff',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Resume
        </button>

        <button
          onClick={() => {
            store.reset();
            window.location.reload();
          }}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '8px',
            border: 'none',
            background: 'transparent',
            color: '#e85d4e',
            fontWeight: '600',
            cursor: 'pointer',
            marginTop: '8px'
          }}
        >
          Leave Game
        </button>
      </div>
    </div>
  );
}
