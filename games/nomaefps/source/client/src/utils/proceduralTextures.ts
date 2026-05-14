import * as THREE from 'three';

export function createConcreteTexture(color = '#8a8a8a'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#999' : '#777';
    ctx.globalAlpha = 0.15;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createMetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#555';
  ctx.fillRect(0, 0, 256, 256);

  // Brushed metal lines
  for (let i = 0; i < 256; i += 2) {
    ctx.fillStyle = Math.random() > 0.5 ? '#666' : '#444';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, i, 256, 1);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
