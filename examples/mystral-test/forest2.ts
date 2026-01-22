/**
 * Forest2 Demo for Mystral Native Runtime
 * Tests procedural generation: landscape, water, trees, grass, rocks, flowers, clouds
 */

// Core engine
import { Engine } from '/Users/suyogsonwalkar/Projects/mystral/src/core/Engine';
import { Scene } from '/Users/suyogsonwalkar/Projects/mystral/src/core/Scene';
import { Mesh } from '/Users/suyogsonwalkar/Projects/mystral/src/core/Mesh';
import { Geometry } from '/Users/suyogsonwalkar/Projects/mystral/src/core/Geometry';
import { Texture } from '/Users/suyogsonwalkar/Projects/mystral/src/core/Texture';
import { StandardMaterial } from '/Users/suyogsonwalkar/Projects/mystral/src/core/materials/StandardMaterial';
import { InputManager } from '/Users/suyogsonwalkar/Projects/mystral/src/core/InputManager';
import { WASDController } from '/Users/suyogsonwalkar/Projects/mystral/src/core/controllers';

// Math
import { Vector3 } from '/Users/suyogsonwalkar/Projects/mystral/src/math/Vector3';
import { Quaternion } from '/Users/suyogsonwalkar/Projects/mystral/src/math/Quaternion';

// Procedural
import { Landscape } from '/Users/suyogsonwalkar/Projects/mystral/src/core/procedural/landscape/Landscape';
import { Water } from '/Users/suyogsonwalkar/Projects/mystral/src/core/procedural/water';
import { EzTreeGenerator, loadEzTreePreset } from '/Users/suyogsonwalkar/Projects/mystral/src/core/procedural/foliage';
import { BillboardCloudsMesh } from '/Users/suyogsonwalkar/Projects/mystral/src/core/procedural/clouds';
import { createInstancedMeshFromGLB, createInstancedMeshGroupFromGLB } from '/Users/suyogsonwalkar/Projects/mystral/src/core/InstancedMesh';

// Seeded RNG for reproducible randomness
function createRng(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Asset base path (absolute path to mystral static assets)
const ASSET_BASE = '/Users/suyogsonwalkar/Projects/mystral/apps/mystral/static';

async function main() {
  console.log("Mystral Native - Forest2 Procedural Test Starting");

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error("No canvas found");
  }

  // ============================================
  // Engine + Scene Setup
  // ============================================

  console.log("Creating Engine...");
  const engine = new Engine(canvas, { disableDebugger: true });
  await engine.init();
  const device = engine.getDevice()!;
  console.log("Engine initialized");

  // Scene.fromPreset() returns scene with atmosphere, fog, lights, camera
  console.log("Creating scene from 'forest' preset...");
  const { scene, sun, ambient, camera } = Scene.fromPreset('forest', {
    cameraPosition: new Vector3(80, 25, 80),
    cameraTarget: new Vector3(0, 0, 0),
  });

  // Enable cloud shadows for visual interest
  scene.cloudShadows.enabled = true;
  scene.cloudShadows.intensity = 0.5;
  scene.cloudShadows.scale = 0.025;

  // Enable SSGI for bounce lighting (disable for initial test if slow)
  scene.globalIllumination.enabled = false;
  scene.globalIllumination.intensity = 0.3;

  // Disable heavy post-processing for initial test
  scene.postProcessing.ssao.enabled = false;
  scene.postProcessing.ssr.enabled = false;
  scene.render.occlusionCulling = false;
  // Indirect draw is now supported in native runtime with indirect-first-instance feature

  console.log("Scene configured");

  // ============================================
  // Configuration
  // ============================================

  const LANDSCAPE_SIZE = 256; // Smaller for initial test
  const WATER_LEVEL = 10;

  // ============================================
  // Landscape with Grass/Dirt Texture Blending
  // ============================================

  console.log("Creating landscape...");
  const landscape = new Landscape({
    size: { width: LANDSCAPE_SIZE, depth: LANDSCAPE_SIZE },
    heightScale: 40,
    segments: { x: 64, z: 64 }, // Lower resolution for initial test
  });
  await landscape.init(device);
  const commandEncoder = device.createCommandEncoder();
  await landscape.generate(commandEncoder);
  scene.addChild(landscape);
  console.log("Landscape created");

  // Configure landscape material with grass/dirt blending
  const landscapeMat = landscape.getMaterial() as StandardMaterial;
  if (landscapeMat) {
    landscapeMat.blendMode = 'noise';
    landscapeMat.useWorldSpaceUV = true;
    landscapeMat.worldSpaceUVScale = 30;
    landscapeMat.blendNoiseScale = 100;
    landscapeMat.blendPatchiness = 0.6;
    landscapeMat.roughness = 0.9;

    // Load ground textures
    const grassTex = new Texture('Ground Grass', { srgb: true });
    const dirtTex = new Texture('Ground Dirt', { srgb: true });
    const dirtNormalTex = new Texture('Ground Dirt Normal');

    Promise.all([
      grassTex.load(device, `${ASSET_BASE}/textures/ground/grass.jpg`),
      dirtTex.load(device, `${ASSET_BASE}/textures/ground/dirt_color.jpg`),
      dirtNormalTex.load(device, `${ASSET_BASE}/textures/ground/dirt_normal.jpg`),
    ]).then(() => {
      landscapeMat.albedoMap = grassTex;
      landscapeMat.blendMap2 = dirtTex;
      landscapeMat.blendNormalMap2 = dirtNormalTex;
      console.log('Landscape textures loaded (grass + dirt blending)');
    }).catch(e => console.warn('Failed to load ground textures:', e));
  }

  // ============================================
  // Water
  // ============================================

  console.log("Creating water...");
  const water = new Water({
    size: { width: LANDSCAPE_SIZE, depth: LANDSCAPE_SIZE },
    waterLevel: 0,
    shallowColor: new Vector3(0.0, 0.5, 0.5),
    opacity: 0.8,
    waveHeight: 0.3,
    waveSpeed: 1.0,
  });
  await water.init(device);
  water.transform.position.set(0, WATER_LEVEL, 0);
  scene.addChild(water);
  console.log("Water created");

  // ============================================
  // Helper: Check if position is above water
  // ============================================

  function isAboveWater(x: number, z: number): boolean {
    const height = landscape.getHeightAt(x, z);
    return height > WATER_LEVEL + 1;
  }

  function getTerrainHeight(x: number, z: number): number {
    return landscape.getHeightAt(x, z);
  }

  // ============================================
  // Trees (EzTree procedural generation)
  // ============================================

  console.log("Creating procedural trees...");
  const treeOptions = loadEzTreePreset('oak_medium');
  treeOptions.seed = 12345;

  const generator = new EzTreeGenerator(treeOptions);
  const { branchGeometry, leafGeometry } = generator.generate();

  // Load bark textures
  const barkColorTex = new Texture('Bark Color', { srgb: true });
  const barkNormalTex = new Texture('Bark Normal');
  await Promise.all([
    barkColorTex.load(device, `${ASSET_BASE}/textures/bark/oak_color_1k.jpg`),
    barkNormalTex.load(device, `${ASSET_BASE}/textures/bark/oak_normal_1k.jpg`),
  ]).catch(() => console.warn('Failed to load bark textures'));

  // Load leaf texture
  const leafTex = new Texture('Leaf', { srgb: true, premultiplyAlpha: true });
  await leafTex.load(device, `${ASSET_BASE}/textures/leaves/oak_color.png`).catch(() => {});

  // Create tree instances - only above water
  const rng = createRng(12345);
  const treeCount = 10; // Fewer trees for initial test
  const treeSpread = LANDSCAPE_SIZE * 0.4;
  let treesPlaced = 0;

  for (let i = 0; i < treeCount * 3 && treesPlaced < treeCount; i++) {
    const x = (rng() - 0.5) * treeSpread * 2;
    const z = (rng() - 0.5) * treeSpread * 2;

    if (!isAboveWater(x, z)) continue;

    const y = getTerrainHeight(x, z);
    const scale = 0.8 + rng() * 0.4;
    const rotation = rng() * Math.PI * 2;

    // Branch mesh
    const branchGeom = new Geometry();
    branchGeom.setAttribute('position', new Float32Array(branchGeometry.positions));
    branchGeom.setAttribute('normal', new Float32Array(branchGeometry.normals));
    branchGeom.setAttribute('uv', new Float32Array(branchGeometry.uvs));
    branchGeom.setIndices(new Uint32Array(branchGeometry.indices));

    const branchMat = new StandardMaterial(new Vector3(1, 1, 1), 0.8, 0);
    branchMat.albedoMap = barkColorTex;
    branchMat.normalMap = barkNormalTex;

    const branchMesh = new Mesh(branchGeom, branchMat);
    branchMesh.transform.position.set(x, y, z);
    branchMesh.transform.scale.set(scale, scale, scale);
    branchMesh.transform.rotation = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), rotation);
    scene.addChild(branchMesh);

    // Leaf mesh
    if (leafGeometry.vertexCount > 0) {
      const leafGeom = new Geometry();
      leafGeom.setAttribute('position', new Float32Array(leafGeometry.positions));
      leafGeom.setAttribute('normal', new Float32Array(leafGeometry.normals));
      leafGeom.setAttribute('uv', new Float32Array(leafGeometry.uvs));
      leafGeom.setIndices(new Uint32Array(leafGeometry.indices));

      const leafMat = new StandardMaterial(new Vector3(0.3, 0.5, 0.2), 0.6, 0);
      leafMat.alphaMode = 'MASK';
      leafMat.alphaCutoff = 0.5;
      leafMat.doubleSided = true;
      leafMat.receiveShadows = false;
      leafMat.windEnabled = true;
      leafMat.windStrength = 0.15;
      leafMat.windSpeed = 1.0;
      if (leafTex) leafMat.albedoMap = leafTex;

      const leafMesh = new Mesh(leafGeom, leafMat);
      leafMesh.transform.position.set(x, y, z);
      leafMesh.transform.scale.set(scale, scale, scale);
      leafMesh.transform.rotation = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), rotation);
      scene.addChild(leafMesh);
    }

    treesPlaced++;
  }
  console.log(`Created ${treesPlaced} trees (above water only)`);

  // ============================================
  // Grass (GPU Instanced) - ON terrain, above water
  // ============================================

  let grassInstancer: any = null;
  try {
    const grassCount = 500; // Fewer for initial test
    grassInstancer = await createInstancedMeshFromGLB(device, `${ASSET_BASE}/assets/rocks/grass.glb`, grassCount);
    grassInstancer.material.alphaMode = 'MASK';
    grassInstancer.material.alphaCutoff = 0.5;
    grassInstancer.material.doubleSided = true;
    grassInstancer.material.windEnabled = true;
    grassInstancer.material.windStrength = 0.15;
    grassInstancer.material.windSpeed = 1.0;

    const grassRng = createRng(77777);
    const grassSpread = LANDSCAPE_SIZE * 0.45;
    let grassPlaced = 0;

    for (let i = 0; i < grassCount * 2 && grassPlaced < grassCount; i++) {
      const x = (grassRng() - 0.5) * grassSpread * 2;
      const z = (grassRng() - 0.5) * grassSpread * 2;

      if (!isAboveWater(x, z)) continue;

      const y = getTerrainHeight(x, z);
      const scaleX = 4 + grassRng() * 2;
      const scaleY = 3 + grassRng() * 2;
      const scaleZ = 4 + grassRng() * 2;
      const tintG = 0.3 + grassRng() * 0.3;

      grassInstancer.addInstance({
        position: new Vector3(x, y, z),
        rotation: grassRng() * Math.PI * 2,
        scale: new Vector3(scaleX, scaleY, scaleZ),
        color: new Vector3(0.3, tintG, 0.1),
      });
      grassPlaced++;
    }

    grassInstancer.uploadInstances();
    scene.addChild(grassInstancer);
    console.log(`Created ${grassPlaced} grass instances (above water only)`);
  } catch (e: any) {
    console.warn('Failed to load grass:', e.message || e);
  }

  // ============================================
  // Rocks (GPU Instanced) - ON terrain, above water
  // ============================================

  const rockInstancers: any[] = [];
  try {
    const rockPaths = [
      `${ASSET_BASE}/assets/rocks/rock1.glb`,
      `${ASSET_BASE}/assets/rocks/rock2.glb`,
      `${ASSET_BASE}/assets/rocks/rock3.glb`,
    ];
    const rockCount = 20; // Fewer for initial test
    const rocksPerType = Math.ceil(rockCount / rockPaths.length);

    for (const path of rockPaths) {
      const instancer = await createInstancedMeshFromGLB(device, path, rocksPerType * 2);
      instancer.material.roughness = 0.85;
      rockInstancers.push(instancer);
    }

    const rockRng = createRng(54321);
    const rockSpread = LANDSCAPE_SIZE * 0.4;
    let rocksPlaced = 0;

    for (let i = 0; i < rockCount * 3 && rocksPlaced < rockCount; i++) {
      const instancer = rockInstancers[Math.floor(rockRng() * rockInstancers.length)];
      const x = (rockRng() - 0.5) * rockSpread * 2;
      const z = (rockRng() - 0.5) * rockSpread * 2;

      if (!isAboveWater(x, z)) continue;

      const y = getTerrainHeight(x, z);
      const scale = 1.5 + rockRng() * 3.0;

      instancer.addInstance({
        position: new Vector3(x, y, z),
        rotation: rockRng() * Math.PI * 2,
        scale,
        color: new Vector3(1, 1, 1),
      });
      rocksPlaced++;
    }

    for (const instancer of rockInstancers) {
      instancer.uploadInstances();
      scene.addChild(instancer);
    }
    console.log(`Created ${rocksPlaced} rock instances (above water only)`);
  } catch (e: any) {
    console.warn('Failed to load rocks:', e.message || e);
  }

  // ============================================
  // Flowers (GPU Instanced) - ON terrain, above water
  // ============================================

  const flowerInstancers: any[] = [];
  try {
    const flowerPaths = [
      `${ASSET_BASE}/assets/rocks/flower_blue.glb`,
      `${ASSET_BASE}/assets/rocks/flower_white.glb`,
      `${ASSET_BASE}/assets/rocks/flower_yellow.glb`,
    ];
    const flowerCount = 50; // Fewer for initial test

    for (const path of flowerPaths) {
      const instancer = await createInstancedMeshGroupFromGLB(device, path, 50);
      instancer.setMaterialProperties({
        alphaMode: 'MASK',
        alphaCutoff: 0.01,
        doubleSided: true,
        windEnabled: true,
        windStrength: 0.1,
        windSpeed: 1.0,
      });
      flowerInstancers.push(instancer);
    }

    const flowerRng = createRng(99999);
    const flowerSpread = LANDSCAPE_SIZE * 0.35;
    let flowersPlaced = 0;

    for (let i = 0; i < flowerCount * 3 && flowersPlaced < flowerCount; i++) {
      const instancer = flowerInstancers[Math.floor(flowerRng() * flowerInstancers.length)];
      const x = (flowerRng() - 0.5) * flowerSpread * 2;
      const z = (flowerRng() - 0.5) * flowerSpread * 2;

      if (!isAboveWater(x, z)) continue;

      const y = getTerrainHeight(x, z);
      const scale = 0.03 + flowerRng() * 0.04;

      instancer.addInstance({
        position: new Vector3(x, y, z),
        rotation: flowerRng() * Math.PI * 2,
        scale,
        color: new Vector3(1, 1, 1),
      });
      flowersPlaced++;
    }

    for (const instancer of flowerInstancers) {
      instancer.uploadInstances();
      scene.addChild(instancer);
    }
    console.log(`Created ${flowersPlaced} flower instances (above water only)`);
  } catch (e: any) {
    console.warn('Failed to load flowers:', e.message || e);
  }

  // ============================================
  // Billboard Clouds (skip for initial test)
  // ============================================

  // let billboardClouds: BillboardCloudsMesh | null = null;
  // try {
  //   billboardClouds = new BillboardCloudsMesh({
  //     enabled: true,
  //     count: 15,
  //     opacity: 0.9,
  //     height: 80,
  //     spread: 200,
  //     speed: 0.3,
  //     color: new Vector3(1, 1, 1),
  //     windDirection: 45,
  //     followCamera: false,
  //     scale: 1.2,
  //   });
  //   const gBuffer = (engine as any).renderGraph?.gBuffer || null;
  //   await billboardClouds.init(device, undefined, gBuffer);
  //   scene.addChild(billboardClouds);
  //   console.log('Billboard clouds added');
  // } catch (e: any) {
  //   console.warn('Failed to create billboard clouds:', e.message || e);
  // }

  console.log('Forest2 demo initialized!');
  console.log('Controls: WASD to move, mouse to look around');

  // ============================================
  // Controls
  // ============================================

  const inputManager = new InputManager(canvas);
  const controller = new WASDController(camera);
  controller.movementSpeed = 15;

  // ============================================
  // Render Loop
  // ============================================

  let lastTime = performance.now();
  let frame = 0;

  function render() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    const input = inputManager.update();
    controller.update(deltaTime, input);

    // Debug output every 120 frames
    if (frame % 120 === 0) {
      const pos = camera.transform.position;
      console.log(`Frame ${frame}: Camera at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
    }

    engine.render(scene, camera);
    frame++;
    requestAnimationFrame(render);
  }

  console.log("Starting render loop...");
  render();
}

main().catch(e => {
  console.log("Error:", e.message || e);
  console.log("Stack:", e.stack || "No stack");
});
