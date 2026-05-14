import { useMemo } from 'react';
import * as THREE from 'three';

export function Skybox() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#4a7cb0');
    grad.addColorStop(0.4, '#8ab4d4');
    grad.addColorStop(0.6, '#d4c5a9');
    grad.addColorStop(1, '#b8a88a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Clouds
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 200;
      const w = 80 + Math.random() * 120;
      const h = 20 + Math.random() * 30;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Distant mountains
    ctx.fillStyle = '#6a7a6a';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, 350);
    for (let x = 0; x <= 1024; x += 50) {
      ctx.lineTo(x, 300 + Math.sin(x * 0.02) * 30 + Math.cos(x * 0.05) * 20);
    }
    ctx.lineTo(1024, 512);
    ctx.lineTo(0, 512);
    ctx.fill();
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  return (
    <mesh>
      <sphereGeometry args={[200, 32, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}
