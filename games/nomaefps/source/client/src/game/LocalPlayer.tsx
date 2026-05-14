import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import type { ClientMessage } from '@shared/types';

interface Props {
  send: (msg: ClientMessage) => void;
  getInputs: () => { w: boolean; a: boolean; s: boolean; d: boolean; space: boolean; shift: boolean };
  audio: React.MutableRefObject<{ playShoot: () => void; playReload: () => void; playHit: () => void; playDeath: () => void; setVolume: (v: number) => void; destroy: () => void } | null>;
}

const MOVE_SPEED = 10;
const SPRINT_SPEED = 16;
const JUMP_FORCE = 8;
const GRAVITY = 25;
const FRICTION = 8;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const FIRE_RATE = 0.1;
const RECOIL_RECOVERY = 5;

export function LocalPlayer({ send, getInputs, audio }: Props) {
  const store = useGameStore();
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 2, 0));
  const vel = useRef(new THREE.Vector3(0, 0, 0));
  const yaw = useRef(0);
  const pitch = useRef(0);
  const isGrounded = useRef(false);
  const lastFire = useRef(0);
  const recoil = useRef(0);
  const swayTime = useRef(0);
  const isShooting = useRef(false);
  const isReloading = useRef(false);
  const isDead = useRef(false);
  const health = useRef(100);

  useEffect(() => {
    camera.position.copy(pos.current);
  }, [camera]);

  useFrame((_, dt) => {
    if (!store.isPointerLocked || isDead.current) return;

    const inputs = getInputs();
    const speed = inputs.shift ? SPRINT_SPEED : MOVE_SPEED;

    const forward = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

    let moveX = 0, moveZ = 0;
    if (inputs.w) { moveX += forward.x; moveZ += forward.z; }
    if (inputs.s) { moveX -= forward.x; moveZ -= forward.z; }
    if (inputs.d) { moveX += right.x; moveZ += right.z; }
    if (inputs.a) { moveX -= right.x; moveZ += right.z; }

    const len = Math.sqrt(moveX*moveX + moveZ*moveZ);
    if (len > 0) { moveX /= len; moveZ /= len; }

    const control = isGrounded.current ? 1.0 : 0.3;
    vel.current.x += moveX * speed * control * dt * 10;
    vel.current.z += moveZ * speed * control * dt * 10;

    if (isGrounded.current) {
      vel.current.x *= Math.max(0, 1 - FRICTION * dt);
      vel.current.z *= Math.max(0, 1 - FRICTION * dt);
    } else {
      vel.current.x *= Math.max(0, 1 - FRICTION * 0.1 * dt);
      vel.current.z *= Math.max(0, 1 - FRICTION * 0.1 * dt);
    }

    if (inputs.space && isGrounded.current) {
      vel.current.y = JUMP_FORCE;
      isGrounded.current = false;
    }

    vel.current.y -= GRAVITY * dt;

    pos.current.x += vel.current.x * dt;
    pos.current.y += vel.current.y * dt;
    pos.current.z += vel.current.z * dt;

    // Simple floor collision
    if (pos.current.y <= PLAYER_HEIGHT) {
      pos.current.y = PLAYER_HEIGHT;
      vel.current.y = 0;
      isGrounded.current = true;
    }

    // Map bounds
    pos.current.x = Math.max(-48, Math.min(48, pos.current.x));
    pos.current.z = Math.max(-48, Math.min(48, pos.current.z));

    // Camera bob
    const bobSpeed = inputs.shift ? 12 : 8;
    const bobAmount = inputs.shift ? 0.08 : 0.05;
    const bob = isGrounded.current && len > 0 ? Math.sin(performance.now() * 0.001 * bobSpeed) * bobAmount : 0;

    // Recoil recovery
    recoil.current = Math.max(0, recoil.current - RECOIL_RECOVERY * dt);

    // Idle sway
    swayTime.current += dt;
    const swayX = Math.sin(swayTime.current * 1.5) * 0.005;
    const swayY = Math.cos(swayTime.current * 1.2) * 0.005;

    // Apply to camera
    camera.position.set(
      pos.current.x,
      pos.current.y + bob,
      pos.current.z
    );

    const euler = new THREE.Euler(
      pitch.current + recoil.current + swayY,
      yaw.current + swayX,
      0,
      'YXZ'
    );
    camera.quaternion.setFromEuler(euler);

    // Send state to server
    send({
      type: 'input',
      inputs,
      position: { x: pos.current.x, y: pos.current.y, z: pos.current.z },
      rotation: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
      quaternion: { x: camera.quaternion.x, y: camera.quaternion.y, z: camera.quaternion.z, w: camera.quaternion.w },
      yaw: yaw.current,
      pitch: pitch.current
    });
  });

  // Handle mouse look from store
  useEffect(() => {
    const interval = setInterval(() => {
      if (store.isPointerLocked) {
        // yaw/pitch updated by usePointerLock hook via global or we need another mechanism
        // For now, we'll read from a global that the hook sets
      }
    }, 16);
    return () => clearInterval(interval);
  }, [store.isPointerLocked]);

  return null;
}
