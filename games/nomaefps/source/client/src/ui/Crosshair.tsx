export function Crosshair() {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none'
    }}>
      {/* Center dot */}
      <div style={{
        width: '4px',
        height: '4px',
        background: 'rgba(255,255,255,0.9)',
        borderRadius: '50%',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }} />

      {/* Cross lines */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }}>
        <div style={{ position: 'absolute', width: '16px', height: '2px', background: 'rgba(255,255,255,0.7)', top: '-1px', left: '4px' }} />
        <div style={{ position: 'absolute', width: '16px', height: '2px', background: 'rgba(255,255,255,0.7)', top: '-1px', right: '4px' }} />
        <div style={{ position: 'absolute', width: '2px', height: '16px', background: 'rgba(255,255,255,0.7)', left: '-1px', top: '4px' }} />
        <div style={{ position: 'absolute', width: '2px', height: '16px', background: 'rgba(255,255,255,0.7)', left: '-1px', bottom: '4px' }} />
      </div>
    </div>
  );
}
