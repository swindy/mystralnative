// Sponza test for Mystral Native Runtime
// Tests: complex GLTF scene, multiple lights, atmosphere, fog, WASD controls

import {
    Engine,
    Scene,
    Camera,
    DirectionalLight,
    AmbientLight,
    Vector3,
    loadGLTFModel,
    InputManager,
    WASDController,
    Quaternion,
} from '../../../../src';

async function main() {
    console.log("Mystral Native - Sponza Test Starting");

    // Get the canvas (created by native runtime)
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
        throw new Error("No canvas found");
    }

    // Create engine
    console.log("Creating Engine...");
    const engine = new Engine(canvas, { disableDebugger: true });
    await engine.init();
    console.log("Engine initialized");

    // Create scene
    const scene = new Scene(engine);
    console.log("Scene created");

    // Disable heavy post-processing for initial testing
    scene.postProcessing.bloom.enabled = false;
    scene.postProcessing.ssao.enabled = false;
    scene.postProcessing.fxaa.enabled = false;
    scene.postProcessing.aa.enabled = false;  // TAA
    scene.postProcessing.ssr.enabled = false;
    scene.postProcessing.godRays.enabled = false;
    scene.postProcessing.tonemapping.enabled = true;
    scene.postProcessing.tonemapping.exposure = 1.0;

    // Indirect draw is now supported in native runtime with indirect-first-instance feature
    scene.render.occlusionCulling = false;

    // Disable atmosphere for initial test (can enable later)
    scene.atmosphere.enabled = false;

    // Disable fog for initial test
    scene.fog.enabled = false;

    // Disable GI for initial test
    scene.globalIllumination.enabled = false;

    console.log("Post-processing minimal setup complete");

    // Setup camera - inside Sponza looking down the corridor
    const camera = new Camera(60, canvas.width / canvas.height, 0.1, 1000.0);
    camera.transform.position = new Vector3(0.5, 2, -0.75);
    camera.transform.rotation = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

    // Setup input and WASD controller
    const inputManager = new InputManager(canvas);
    const controller = new WASDController(camera);
    controller.movementSpeed = 10;
    console.log("WASD Controller initialized - use WASD to move, mouse to look");

    // Add directional light (sun)
    const sunLight = new DirectionalLight(new Vector3(1, 0.95, 0.8), 3.0);
    sunLight.transform.position = new Vector3(20, 50, 10);
    sunLight.transform.lookAt(new Vector3(0, 0, 0));
    sunLight.shadow.castShadow = false;  // Disable shadows for initial test
    scene.addLight(sunLight);
    console.log("Sun light added");

    // Add ambient light for fill
    const ambientLight = new AmbientLight(new Vector3(1.0, 1.0, 1.0), 0.3);
    scene.addLight(ambientLight);
    console.log("Ambient light added");

    // Load Sponza model
    const device = engine.getDevice()!;
    const sponzaPath = '/Users/suyogsonwalkar/Projects/mystral/apps/mystral/dist/assets/Sponza/glTF/Sponza.gltf';

    console.log("Loading Sponza from:", sponzaPath);
    try {
        const sponzaNode = await loadGLTFModel(device, sponzaPath);
        if (sponzaNode) {
            sponzaNode.transform.scale = new Vector3(1, 1, 1);
            scene.addChild(sponzaNode);
            console.log("Sponza loaded and added to scene");
        }
    } catch (e: any) {
        console.log("Failed to load Sponza:", e.message || e);
    }

    // Render loop
    let frame = 0;
    let lastTime = performance.now();

    function render() {
        const now = performance.now();
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        // Update input and controller
        const inputState = inputManager.update();
        controller.update(deltaTime, inputState);

        // Debug output every 120 frames
        if (frame % 120 === 0) {
            const pos = camera.transform.position;
            console.log(`Frame ${frame}: Camera at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
        }

        // Render
        engine.render(scene, camera);

        frame++;
        requestAnimationFrame(render);
    }

    console.log("Starting render loop...");
    render();
}

main().catch(e => {
    console.log("Error:", e.message || e);
});
