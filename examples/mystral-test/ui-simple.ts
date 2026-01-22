/**
 * Simple UI Test for Mystral Native Runtime
 *
 * Tests basic UI panels WITHOUT text (to avoid Canvas 2D dependency).
 * This verifies the core UI rendering pipeline works in native.
 */

import {
    Engine,
    Scene,
    Camera,
    DirectionalLight,
    Vector3,
    Mesh,
    StandardMaterial,
    BoxGeometry,
    SphereGeometry,
    PlaneGeometry,
    Quaternion,
    // UI System
    UIManager,
    UIRenderPass,
    Panel,
} from '../../../../src';

async function main() {
    console.log("=== Simple UI Test (No Text) - Starting ===");

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

    const device = engine.getDevice()!;

    // Create scene with minimal settings
    const scene = new Scene(engine);
    scene.postProcessing.bloom.enabled = false;
    scene.postProcessing.ssao.enabled = false;
    scene.postProcessing.fxaa.enabled = false;
    scene.postProcessing.aa.enabled = false;
    scene.postProcessing.ssr.enabled = false;
    scene.postProcessing.godRays.enabled = false;
    scene.postProcessing.tonemapping.enabled = true;
    scene.postProcessing.tonemapping.exposure = 1.0;
    // Indirect draw is now supported in native runtime with indirect-first-instance feature

    // Enable atmosphere
    scene.atmosphere.enabled = true;
    scene.atmosphere.sunDiskEnabled = true;
    scene.atmosphere.sunDirection = new Vector3(0.5, 0.8, 0.3).normalize();

    // Setup camera
    const camera = new Camera();
    camera.transform.position = new Vector3(0, 2, 5);
    camera.transform.lookAt(new Vector3(0, 0, 0));
    console.log("Camera and Scene created");

    // Add light
    const sun = new DirectionalLight();
    sun.direction = new Vector3(0.5, 1, 0.5).normalize();
    sun.intensity = 2.0;
    scene.addLight(sun);

    // Create simple 3D scene for background
    const groundMat = new StandardMaterial(new Vector3(0.3, 0.4, 0.3), 0.8, 0.0);
    const ground = new Mesh(new PlaneGeometry(20, 20), groundMat);
    ground.transform.rotation = Quaternion.fromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    scene.addChild(ground);

    const boxMat = new StandardMaterial(new Vector3(0.7, 0.3, 0.3), 0.5, 0.0);
    const box = new Mesh(new BoxGeometry(1, 1, 1), boxMat);
    box.transform.position = new Vector3(-2, 0.5, 0);
    scene.addChild(box);

    const sphereMat = new StandardMaterial(new Vector3(0.3, 0.3, 0.7), 0.3, 0.0);
    const sphere = new Mesh(new SphereGeometry(0.6, 24, 16), sphereMat);
    sphere.transform.position = new Vector3(2, 0.6, 0);
    scene.addChild(sphere);

    console.log("3D Scene objects created");

    // ============================================
    // UI SYSTEM SETUP - Panels only, no text
    // ============================================
    console.log("Setting up UI System...");

    const uiManager = new UIManager();
    uiManager.init(canvas);
    console.log("UIManager initialized");

    const uiPass = new UIRenderPass(uiManager);
    console.log("UIRenderPass created");

    engine.addRenderPass(uiPass);
    console.log("UIRenderPass added to engine");

    // Debug: Check UIRenderPass state
    console.log("UIRenderPass has device:", !!(uiPass as any).device);
    console.log("UIRenderPass has context:", !!(uiPass as any).context);
    console.log("UIRenderPass has textContext:", !!(uiPass as any).textContext);
    console.log("UIRenderPass has textCanvas:", !!(uiPass as any).textCanvas);
    console.log("UIRenderPass textCanvas size:", (uiPass as any).textCanvas?.width, "x", (uiPass as any).textCanvas?.height);
    console.log("UIRenderPass has textTexture:", !!(uiPass as any).textTexture);
    console.log("UIRenderPass has quadPipeline:", !!(uiPass as any).quadPipeline);
    console.log("UIRenderPass width/height:", (uiPass as any).width, "x", (uiPass as any).height);

    // Root container
    const uiRoot = new Panel({
        width: '100%',
        height: '100%',
    });
    uiRoot.name = 'uiRoot';
    uiManager.setRoot(uiRoot);

    // Main panel - center of screen
    const mainPanel = new Panel({
        anchor: 'center',
        pivot: { x: 0.5, y: 0.5 },
        width: 400,
        height: 300,
        backgroundColor: 'rgba(30, 35, 50, 0.9)',
        borderColor: '#4488aa',
        borderWidth: 3,
        borderRadius: 16,
        padding: 20,
        direction: 'vertical',
        alignItems: 'center',
        gap: 12,
    });
    mainPanel.name = 'mainPanel';

    // Color boxes to simulate buttons (no text)
    const box1 = new Panel({
        width: 300,
        height: 50,
        backgroundColor: '#3a6ea5',
        borderRadius: 8,
    });

    const box2 = new Panel({
        width: 300,
        height: 50,
        backgroundColor: '#445566',
        borderRadius: 8,
    });

    const box3 = new Panel({
        width: 300,
        height: 50,
        backgroundColor: '#664433',
        borderRadius: 8,
    });

    mainPanel.addChild(box1);
    mainPanel.addChild(box2);
    mainPanel.addChild(box3);
    uiRoot.addChild(mainPanel);

    // Top-left HUD element
    const hudPanel = new Panel({
        anchor: 'top-left',
        x: 20,
        y: 20,
        width: 150,
        height: 60,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 8,
        borderColor: '#ffdd44',
        borderWidth: 2,
    });
    uiRoot.addChild(hudPanel);

    // Bottom-right control panel
    const controlPanel = new Panel({
        anchor: 'bottom-right',
        x: -20,
        y: -20,
        width: 200,
        height: 100,
        backgroundColor: 'rgba(50, 50, 60, 0.85)',
        borderRadius: 12,
        borderColor: '#66aaff',
        borderWidth: 2,
        padding: 10,
        direction: 'vertical',
        gap: 8,
    });

    // Mini color indicators
    const indicator1 = new Panel({
        width: '100%',
        height: 25,
        backgroundColor: '#44aa44',
        borderRadius: 4,
    });
    const indicator2 = new Panel({
        width: '100%',
        height: 25,
        backgroundColor: '#aa4444',
        borderRadius: 4,
    });

    controlPanel.addChild(indicator1);
    controlPanel.addChild(indicator2);
    uiRoot.addChild(controlPanel);

    console.log("UI Panels created (no text)");

    // ============================================
    // RENDER LOOP
    // ============================================
    let frame = 0;
    let rotationAngle = 0;

    function render() {
        const dt = 1 / 60;

        // Animate objects
        rotationAngle += dt;
        box.transform.rotation = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), rotationAngle);
        sphere.transform.position = new Vector3(2, 0.6 + Math.sin(rotationAngle * 2) * 0.2, 0);

        // Update UI
        uiManager.update(dt);

        // Render
        engine.render(scene, camera);

        // Debug output
        if (frame === 0) {
            console.log("=== Simple UI Test Initialized ===");
            console.log("UI Root:", uiRoot.name);
            console.log("Main Panel:", mainPanel.name);
            // Check render data
            const renderData = uiManager.getRenderData();
            console.log("UI Render Data count:", renderData.length);
            if (renderData.length > 0) {
                console.log("First render data:", JSON.stringify({
                    type: renderData[0].type,
                    bounds: renderData[0].bounds,
                    backgroundColor: renderData[0].backgroundColor,
                }));
            }
        }

        if (frame % 60 === 0) {
            console.log(`Frame ${frame}: Rendering...`);
        }

        frame++;
        requestAnimationFrame(render);
    }

    console.log("Starting render loop...");
    render();
}

main().catch(e => {
    console.log("Error:", e.message || e);
});
