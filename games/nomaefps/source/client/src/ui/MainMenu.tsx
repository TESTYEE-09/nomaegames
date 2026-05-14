import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store';

export function MainMenu() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');
  const { connect, send } = useSocket();
  const store = useGameStore();

  const startPractice = () => {
    store.setPlayerId('local');
    store.setRoomCode('PRACTICE');
    store.setPlayers([]);
    store.setGameStarted(true);
    store.setInGame(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Enter a name');
      return;
    }

    const code = mode === 'create' 
      ? Math.random().toString(36).substring(2, 8).toUpperCase()
      : roomCode.toUpperCase();

    connect(() => {
      send({ type: 'join', roomCode: code, name: name.trim() });
    });
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '48px',
        width: '380px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <h1 style={{
          margin: '0 0 8px 0',
          fontSize: '42px',
          fontWeight: '800',
          color: '#fff',
          letterSpacing: '-1px',
          textAlign: 'center'
        }}>
          NOMAEFPS
        </h1>
        <p style={{
          margin: '0 0 32px 0',
          color: '#d4845a',
          fontSize: '14px',
          fontWeight: '600',
          letterSpacing: '4px',
          textAlign: 'center',
          textTransform: 'uppercase'
        }}>
          Arena Shooter
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            onClick={() => setMode('create')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'create' ? '#d4845a' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Create Room
          </button>
          <button
            onClick={() => setMode('join')}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'join' ? '#d4845a' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Join Room
          </button>
        </div>

        <input
          type="text"
          placeholder="Your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff',
            fontSize: '16px',
            marginBottom: '12px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />

        {mode === 'join' && (
          <input
            type="text"
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '16px',
              marginBottom: '12px',
              outline: 'none',
              boxSizing: 'border-box',
              letterSpacing: '4px',
              textAlign: 'center'
            }}
          />
        )}

        {error && (
          <p style={{ color: '#e85d4e', fontSize: '13px', margin: '0 0 12px 0', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '8px',
            border: 'none',
            background: '#d4845a',
            color: '#fff',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          {mode === 'create' ? 'Create & Play' : 'Join Room'}
        </button>

        <button
          onClick={startPractice}
          style={{
            width: '100%',
            marginTop: '10px',
            padding: '14px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          Practice Offline
        </button>

        <p style={{
          marginTop: '24px',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          WASD to move • Mouse to look • Click to shoot
        </p>
      </div>
    </div>
  );
}
