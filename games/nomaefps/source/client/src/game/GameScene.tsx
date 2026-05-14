import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { useSocket } from '../hooks/useSocket';
import { useInput } from '../hooks/useInput';
import { usePointerLock } from '../hooks/usePointerLock';
import { LocalPlayer } from './LocalPlayer';
import { RemotePlayer } from './RemotePlayer';
import { ArenaMap } from './Map';
import { Skybox } from './Skybox';
import { AudioManager } from './AudioManager';

function SceneContent() {
  const store = useGameStore();
  const { send } = useSocket();
  const { getInputs } = useInput();
  const { camera } = useThree();
  const audioRef = useRef<AudioManager | null>(null);

  useEffect(() => {
    audioRef.current = new AudioManager(store.volume);
    return () => audioRef.current?.destroy();
  }, []);

  useEffect(() => {
    audioRef.current?.setVolume(store.volume);
  }, [store.volume]);

  return (
    <>
      <Skybox />
      <ambientLight intensity={0.4} color="#ffeedd" />
      <directionalLight
        position={[50, 80, 30]}
        intensity={1.5}
        color="#fff5e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <directionalLight position={[-30, 40, -50]} intensity={0.3} color="#88ccff" />

      <ArenaMap />

      <LocalPlayer 
        send={send} 
        getInputs={getInputs} 
        audio={audioRef}
      />

      {store.players
        .filter(p => p.id !== store.playerId && !p.isDead)
        .map(player => (
          <RemotePlayer key={player.id} player={player} />
        ))}

      <fog attach="fog" args={['#d4c5a9', 60, 140]} />

      {store.graphicsQuality !== 'low' && (
        <ContactShadows 
          position={[0, 0.01, 0]} 
          opacity={0.4} 
          scale={100} 
          blur={2} 
          far={20} 
        />
      )}

      {store.graphicsQuality === 'high' && (
        <EffectComposer>
          <Bloom intensity={0.3} luminanceThreshold={0.8} />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}

export function GameScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useGameStore();
  const { requestLock } = usePointerLock(canvasRef);

  return (
    <div style={{ width: '100%', height: '100%', cursor: store.isPointerLocked ? 'none' : 'default' }}>
      <Canvas
        ref={canvasRef}
        shadows
        gl={{ 
          antialias: true, 
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          outputColorSpace: THREE.SRGBColorSpace
        }}
        camera={{ fov: 80, near: 0.1, far: 300 }}
        onClick={() => {
          if (!store.isPointerLocked && !store.showSettings) {
            requestLock();
          }
        }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
