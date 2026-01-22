/**
 * Simple Mystral Example - Spinning Cube
 *
 * Demonstrates the Mystral engine subset running on the native runtime.
 * Uses vertex pulling pattern to work with the native WebGPU bindings.
 */

import { Engine, Scene, Camera, Mesh, Light, BoxGeometry, Vector3 } from './index';

async function main() {
  console.log('Mystral Engine - Simple Cube Example');

  // Create and initialize the engine
  const engine = new Engine();
  await engine.init();
  console.log('Engine initialized');

  // Create the scene
  const scene = new Scene('MainScene');
  scene.backgroundColor = { r: 0.05, g: 0.05, b: 0.1, a: 1.0 };

  // Add a directional light
  const light: Light = {
    type: 'directional',
    color: new Vector3(1, 1, 1),
    intensity: 1.0,
    direction: new Vector3(0.5, 1.0, 0.3),
  };
  scene.addLight(light);
  console.log('Scene created with light');

  // Create the camera
  const camera = new Camera(60, (canvas as any).width / (canvas as any).height, 0.1, 100);
  camera.transform.position.set(0, 0, 5);
  console.log('Camera created');

  // Create a cube
  const cubeGeometry = new BoxGeometry(1.5, 1.5, 1.5);
  const cube = new Mesh(cubeGeometry, {
    color: new Vector3(0.2, 0.6, 1.0), // Blue color
  });
  scene.addChild(cube);
  console.log('Cube created and added to scene');

  // Run the render loop
  let time = 0;
  engine.run((deltaTime) => {
    time += deltaTime;

    // Rotate the cube
    cube.transform.rotation.setFromEuler(time * 0.5, time * 0.7, time * 0.3);

    // Render the scene
    engine.render(scene, camera);
  });

  console.log('Render loop started');
}

// Start the application
main().catch(console.error);
