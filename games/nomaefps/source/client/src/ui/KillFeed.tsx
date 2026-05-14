import { useGameStore } from '../store';

export function KillFeed() {
  const store = useGameStore();

  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      right: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      alignItems: 'flex-end'
    }}>
      {store.killFeed.map((entry, i) => (
        <div
          key={`${entry.time}-${i}`}
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '13px',
            fontWeight: '600',
            animation: 'feedIn 0.3s ease-out',
            whiteSpace: 'nowrap'
          }}
        >
          <style>{`
            @keyframes feedIn {
              from { opacity: 0; transform: translateX(20px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
          <span style={{ color: '#d4845a' }}>{entry.killer}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)', margin: '0 6px' }}>✕</span>
          <span style={{ color: '#fff' }}>{entry.victim}</span>
        </div>
      ))}
    </div>
  );
}
