import { useGameStore } from '../store';

export function Scoreboard() {
  const store = useGameStore();
  const sorted = [...store.players].sort((a, b) => b.score - a.score);

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(10,10,20,0.92)',
      backdropFilter: 'blur(8px)',
      borderRadius: '12px',
      padding: '24px',
      minWidth: '400px',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
    }}>
      <h2 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: '18px', textAlign: 'center' }}>
        SCOREBOARD
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 60px 60px', gap: '8px', marginBottom: '8px' }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '600' }}>#</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '600' }}>PLAYER</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '600', textAlign: 'center' }}>KILLS</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '600', textAlign: 'center' }}>HP</span>
      </div>

      {sorted.map((player, i) => (
        <div
          key={player.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 60px 60px',
            gap: '8px',
            padding: '8px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            alignItems: 'center'
          }}
        >
          <span style={{ color: i === 0 ? '#d4b850' : 'rgba(255,255,255,0.5)', fontWeight: '700' }}>
            {i + 1}
          </span>
          <span style={{ 
            color: player.id === store.playerId ? '#d4845a' : '#fff',
            fontWeight: player.id === store.playerId ? '700' : '400'
          }}>
            {player.name} {player.id === store.playerId && '(You)'}
          </span>
          <span style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>
            {player.score}
          </span>
          <span style={{ 
            color: player.health > 50 ? '#4a9e8e' : player.health > 25 ? '#d4845a' : '#b85050',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            {player.health}
          </span>
        </div>
      ))}

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', textAlign: 'center', margin: '12px 0 0 0' }}>
        First to 15 kills wins
      </p>
    </div>
  );
}
