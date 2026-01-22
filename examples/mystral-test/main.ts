// Test using Mystral engine directly from src/
// This will reveal what's missing in the native runtime

import {
    Engine,
    Scene,
    Camera,
    HDRLoader,
    EquirectangularToCubemap,
    DirectionalLight,
    Vector3,
    loadGLBModel,
    Mesh,
    StandardMaterial,
    InputManager,
    ArcballController,
} from '../../../../src';

async function main() {
    console.log("Mystral Engine Test - Starting");

    // Get the canvas (created by native runtime)
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
        throw new Error("No canvas found");
    }

    // Create engine with debugger disabled (not available in native runtime)
    console.log("Creating Engine...");
    const engine = new Engine(canvas, { disableDebugger: true });
    await engine.init();
    console.log("Engine initialized");

    // Create scene
    const scene = new Scene(engine);
    console.log("Scene created");

    // Keep only essential effects for rendering
    scene.postProcessing.bloom.enabled = false;
    scene.postProcessing.ssao.enabled = false;
    scene.postProcessing.fxaa.enabled = false;
    scene.postProcessing.aa.enabled = false;  // TAA
    scene.postProcessing.ssr.enabled = false;
    scene.postProcessing.godRays.enabled = false;
    scene.postProcessing.tonemapping.enabled = true;
    scene.postProcessing.tonemapping.exposure = 1.0;

    // Indirect draw is now supported in native runtime with indirect-first-instance feature
    console.log("Post-processing minimal");

    // Debug: Set debug mode to visualize depth (mode 10) or albedo (mode 1)
    // scene.debugMode = 1;  // 1 = albedo visualization
    scene.debugMode = 0;  // 0 = normal rendering
    console.log("Debug mode set to:", scene.debugMode);

    // Setup camera
    const camera = new Camera();
    camera.transform.position = new Vector3(0, 0.3, 2.5);
    camera.transform.lookAt(new Vector3(0, 0, 0));

    // Setup input and camera controller
    console.log("Canvas properties check:", {
        hasStyle: !!canvas.style,
        hasAddEventListener: !!(canvas as any).addEventListener,
        hasSetPointerCapture: !!(canvas as any).setPointerCapture
    });

    const inputManager = new InputManager(canvas);
    const cameraController = new ArcballController(camera, new Vector3(0, 0, 0));
    cameraController.rotationSpeed = 1;  // Default value (web examples use 1-2)
    cameraController.zoomSpeed = 0.3;
    console.log("InputManager and ArcballController initialized");

    // Add directional light
    const sun = new DirectionalLight();
    sun.direction = new Vector3(1, 1, 0.5).normalize();
    sun.intensity = 3.0;
    sun.color = new Vector3(1, 0.98, 0.95);
    scene.addLight(sun);

    // Load HDR environment
    console.log("Loading HDR environment...");
    const device = engine.getDevice()!;
    try {
        const hdrPath = '/Users/suyogsonwalkar/Projects/mystral/apps/mystral/dist/assets/Skyboxes/sunny_rose_garden_2k.hdr';
        const hdrTexture = await HDRLoader.load(device, hdrPath);
        const envMap = EquirectangularToCubemap.convert(device, hdrTexture, 512);
        scene.environmentMap = envMap;
        scene.environmentIntensity = 0.4;
        console.log("Environment loaded");
    } catch (e) {
        console.log("Failed to load environment:", e);
    }

    // Load GLTF model using pure JS GLBLoader (no loaders.gl dependency)
    console.log("Loading DamagedHelmet GLB...");
    let helmetNode: any = null;
    try {
        const helmetPath = '/Users/suyogsonwalkar/Projects/mystral/apps/mystral/dist/assets/DamagedHelmet/glTF-Binary/DamagedHelmet.glb';
        const helmet = await loadGLBModel(device, helmetPath);
        helmetNode = helmet;
        if (helmet) {
            scene.addChild(helmet);
            console.log("Helmet loaded and added to scene");

            // Commented out - use normal helmet
            // helmet.traverse((node: any) => {
            //     if (node instanceof Mesh && node.material instanceof StandardMaterial) {
            //         console.log("Found helmet mesh, setting emissive to bright red");
            //         node.material.emissive = new Vector3(5, 0, 0);  // Bright red emissive
            //         console.log("Material emissive set to:", node.material.emissive);
            //     }
            // });
        }
        // Debug helmet transform
        console.log("Helmet transform:", JSON.stringify({
            position: { x: helmet.transform.position.x, y: helmet.transform.position.y, z: helmet.transform.position.z },
            scale: { x: helmet.transform.scale.x, y: helmet.transform.scale.y, z: helmet.transform.scale.z }
        }));
    } catch (e: any) {
        console.log("Failed to load helmet:", e.message || e);
    }

    // Render loop
    let frame = 0;
    let lastTime = performance.now();

    function render() {
        const now = performance.now();
        const deltaTime = (now - lastTime) / 1000; // Convert to seconds
        lastTime = now;

        // Update input and camera controller
        const inputState = inputManager.update();
        cameraController.update(deltaTime, inputState);

        // Debug output every 60 frames
        if (frame % 60 === 0) {
            console.log(`Frame ${frame}: Camera at (${camera.transform.position.x.toFixed(2)}, ${camera.transform.position.y.toFixed(2)}, ${camera.transform.position.z.toFixed(2)})`);
        }

        // Debug camera matrices on first frame
        if (frame === 0) {
            console.log("Camera viewMatrix diagonal:", [
                camera.viewMatrix.elements[0].toFixed(3),
                camera.viewMatrix.elements[5].toFixed(3),
                camera.viewMatrix.elements[10].toFixed(3),
                camera.viewMatrix.elements[15].toFixed(3)
            ].join(", "));
            console.log("Camera projectionMatrix diagonal:", [
                camera.projectionMatrix.elements[0].toFixed(3),
                camera.projectionMatrix.elements[5].toFixed(3),
                camera.projectionMatrix.elements[10].toFixed(3),
                camera.projectionMatrix.elements[15].toFixed(3)
            ].join(", "));

            // Debug helmet renderIndex
            if (helmetNode) {
                helmetNode.traverse((node: any) => {
                    if (node instanceof Mesh) {
                        console.log(`Helmet mesh renderIndex: ${node.renderIndex}, visible: ${node.visible}`);
                    }
                });
            }
        }

        // Render
        engine.render(scene, camera);

        frame++;
        requestAnimationFrame(render);
    }

    // Set up input event listeners
    console.log("Setting up input listeners...");

    document.addEventListener('keydown', (e: any) => {
        console.log(`Key down: ${e.key} (code: ${e.code})`);
    });

    document.addEventListener('keyup', (e: any) => {
        console.log(`Key up: ${e.key}`);
    });

    document.addEventListener('mousemove', (e: any) => {
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) {
            console.log(`Mouse: ${e.clientX.toFixed(0)}, ${e.clientY.toFixed(0)}`);
        }
    });

    document.addEventListener('click', (e: any) => {
        console.log(`Click at: ${e.clientX.toFixed(0)}, ${e.clientY.toFixed(0)}, button: ${e.button}`);
    });

    document.addEventListener('wheel', (e: any) => {
        console.log(`Wheel: deltaY=${e.deltaY.toFixed(0)}`);
    });

    window.addEventListener('gamepadconnected', (e: any) => {
        console.log(`Gamepad connected: ${e.gamepad.id}`);
    });

    window.addEventListener('gamepaddisconnected', (e: any) => {
        console.log(`Gamepad disconnected`);
    });

    console.log("Starting render loop...");
    render();
}

main().catch(e => {
    console.log("Error:", e.message || e);
});
