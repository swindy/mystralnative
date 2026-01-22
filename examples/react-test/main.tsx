/**
 * React Test for Mystral Native Runtime
 *
 * This demonstrates using Mystral's React components in the native runtime.
 * The key difference from browser: we use renderNative() instead of ReactDOM.
 */

// =============================================================================
// Polyfills (must come before any imports)
// =============================================================================
if (typeof globalThis.queueMicrotask === 'undefined') {
  (globalThis as any).queueMicrotask = (cb: () => void) => Promise.resolve().then(cb);
}
if (typeof globalThis.MessageChannel === 'undefined') {
  (globalThis as any).MessageChannel = class {
    port1 = { onmessage: null as any, postMessage(d: any) { setTimeout(() => (this as any)._other?.onmessage?.({ data: d }), 0); }, start() {}, close() {} };
    port2 = { onmessage: null as any, postMessage(d: any) { setTimeout(() => (this as any)._other?.onmessage?.({ data: d }), 0); }, start() {}, close() {} };
    constructor() { (this.port1 as any)._other = this.port2; (this.port2 as any)._other = this.port1; }
  };
}
if (typeof globalThis.URL === 'undefined') {
  (globalThis as any).URL = class { href: string; constructor(u: string) { this.href = u; } toString() { return this.href; } static createObjectURL() { return 'blob:native'; } static revokeObjectURL() {} };
}

// =============================================================================
// Imports
// =============================================================================
import React, { useRef } from 'react';
import {
  Box,
  Plane,
  DirectionalLight,
  AmbientLight,
  PerspectiveCamera,
  MystralProvider,
  useFrame,
} from '../../../../src/react';
import { render } from '../../../../src/react/reconciler/reconciler';
import { Engine } from '../../../../src/core/Engine';
import { Scene } from '../../../../src/core/Scene';
import { Camera } from '../../../../src/core/Camera';
import { Node } from '../../../../src/core/Node';
import { Vector3 } from '../../../../src/math/Vector3';

// =============================================================================
// Components - These use the existing Mystral React API
// =============================================================================

function SpinningCube({ position, color }: { position: [number, number, number]; color: [number, number, number] }) {
  const meshRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.transform.rotate(new Vector3(0, 1, 0), delta);
      meshRef.current.transform.rotate(new Vector3(1, 0, 0), delta * 0.5);
    }
  });

  return <Box ref={meshRef} position={position} color={color} roughness={0.4} metallic={0.3} />;
}

function TestScene() {
  return (
    <>
      <PerspectiveCamera position={[0, 5, 10]} lookAt={[0, 0, 0]} makeDefault />
      <AmbientLight color={[1, 1, 1]} intensity={0.3} />
      <DirectionalLight position={[5, 5, 5]} color={[1, 0.95, 0.9]} intensity={1.0} castShadow />
      <Plane args={[10, 10]} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} color={[0.5, 0.5, 0.5]} roughness={0.8} />
      <SpinningCube position={[0, 0.5, 0]} color={[1.0, 0.3, 0.3]} />
      <Box position={[2, 0.25, 0]} args={[0.5, 0.5, 0.5]} color={[0.3, 0.7, 1.0]} roughness={0.2} />
    </>
  );
}

// =============================================================================
// Native Runtime Bootstrap
// =============================================================================

async function main() {
  console.log('=== Mystral React Native Test ===');

  const nativeCanvas = (globalThis as any).canvas;
  if (!nativeCanvas) {
    throw new Error('No canvas found - must run in mystral native');
  }

  // Initialize engine
  const engine = new Engine(nativeCanvas, { disableDebugger: true });
  await engine.init();
  console.log('Engine initialized');

  // Create scene with dark blue background
  const scene = new Scene();
  scene.backgroundColor = { r: 0.05, g: 0.05, b: 0.1, a: 1.0 };
  // Indirect draw is now supported in native runtime with indirect-first-instance feature

  // Create camera - further back to see the full scene
  const camera = new Camera(60, nativeCanvas.width / nativeCanvas.height, 0.1, 1000);
  camera.transform.position.set(0, 5, 10);
  camera.transform.lookAt(new Vector3(0, 0, 0));

  // Create root node for React elements
  const rootNode = new Node('ReactRoot');
  scene.addChild(rootNode);

  // Setup the reconciler container
  const container = { scene, camera, rootContainer: rootNode };

  // Render React tree with MystralProvider for hooks to work
  console.log('Rendering React tree...');
  render(
    <MystralProvider engine={engine} scene={scene} camera={camera} canvas={nativeCanvas}>
      <TestScene />
    </MystralProvider>,
    container,
    nativeCanvas,
    () => console.log('React tree mounted')
  );

  // Render loop
  let frameCount = 0;
  function loop() {
    engine.render(scene, camera);
    frameCount++;
    if (frameCount % 60 === 0) console.log(`Frame ${frameCount}`);
    requestAnimationFrame(loop);
  }

  console.log('Starting render loop...');
  requestAnimationFrame(loop);
}

main().catch(e => console.error('Fatal:', e.message, e.stack));
