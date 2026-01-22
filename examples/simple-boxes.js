// Simple imperative test - no React
// Just creates boxes and a plane using the engine directly

console.log('=== Simple Boxes Test ===');

async function main() {
  const canvas = globalThis.canvas;
  if (!canvas) {
    throw new Error('No canvas found');
  }

  // Dynamically import the engine modules
  const { Engine } = await import('../../src/core/Engine.js');
  const { Scene } = await import('../../src/core/Scene.js');
  const { Camera } = await import('../../src/core/Camera.js');
  const { Mesh } = await import('../../src/core/Mesh.js');
  const { Vector3 } = await import('../../src/math/Vector3.js');
  const { BoxGeometry } = await import('../../src/geometries/BoxGeometry.js');
  const { PlaneGeometry } = await import('../../src/geometries/PlaneGeometry.js');
  const { StandardMaterial } = await import('../../src/core/materials/StandardMaterial.js');
  const { DirectionalLight, AmbientLight } = await import('../../src/core/Light.js');

  // Initialize engine
  const engine = new Engine(canvas, { disableDebugger: true });
  await engine.init();
  console.log('Engine initialized');

  // Create scene
  const scene = new Scene();
  scene.backgroundColor = { r: 0.05, g: 0.05, b: 0.1, a: 1.0 };

  // Create camera
  const camera = new Camera(60, canvas.width / canvas.height, 0.1, 1000);
  camera.transform.position.set(0, 2, 5);
  camera.transform.lookAt(new Vector3(0, 0, 0));

  // Create plane
  const planeGeom = new PlaneGeometry(10, 10);
  const planeMat = new StandardMaterial();
  planeMat.albedo = new Vector3(0.5, 0.5, 0.5);
  planeMat.roughness = 0.8;
  const plane = new Mesh(planeGeom, planeMat);
  plane.transform.rotation.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  scene.addChild(plane);

  // Create red cube
  const boxGeom1 = new BoxGeometry(1, 1, 1);
  const boxMat1 = new StandardMaterial();
  boxMat1.albedo = new Vector3(1.0, 0.3, 0.3);
  boxMat1.roughness = 0.4;
  boxMat1.metallic = 0.3;
  const box1 = new Mesh(boxGeom1, boxMat1);
  box1.transform.position.set(0, 0.5, 0);
  scene.addChild(box1);

  // Create blue cube
  const boxGeom2 = new BoxGeometry(0.5, 0.5, 0.5);
  const boxMat2 = new StandardMaterial();
  boxMat2.albedo = new Vector3(0.3, 0.7, 1.0);
  boxMat2.roughness = 0.2;
  const box2 = new Mesh(boxGeom2, boxMat2);
  box2.transform.position.set(2, 0.25, 0);
  scene.addChild(box2);

  // Create ambient light
  const ambient = new AmbientLight(new Vector3(1, 1, 1), 0.3);
  scene.addChild(ambient);
  scene.addLight(ambient);

  // Create directional light
  const dirLight = new DirectionalLight(new Vector3(1, 0.95, 0.9), 1.0);
  dirLight.transform.position.set(5, 5, 5);
  dirLight.transform.lookAt(new Vector3(0, 0, 0));
  dirLight.shadow.castShadow = true;
  scene.addChild(dirLight);
  scene.addLight(dirLight);

  console.log('Scene created with', scene.children.length, 'objects and', scene.lights.length, 'lights');

  // Debug: Log mesh details
  scene.traverse((node) => {
    if (node instanceof Mesh) {
      const pos = node.transform.position;
      console.log(`Mesh: pos=[${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}], visible=${node.visible}`);
      if (node.material) {
        console.log(`  Material albedo=[${node.material.albedo.x.toFixed(2)}, ${node.material.albedo.y.toFixed(2)}, ${node.material.albedo.z.toFixed(2)}]`);
      }
    }
  });

  // Render loop
  let frameCount = 0;
  function loop() {
    // Rotate the red cube
    box1.transform.rotate(new Vector3(0, 1, 0), 0.01);
    box1.transform.rotate(new Vector3(1, 0, 0), 0.005);

    engine.render(scene, camera);
    frameCount++;
    if (frameCount % 60 === 0) console.log('Frame', frameCount);
    requestAnimationFrame(loop);
  }

  console.log('Starting render loop...');
  requestAnimationFrame(loop);
}

main().catch(e => console.error('Fatal:', e.message, e.stack));
