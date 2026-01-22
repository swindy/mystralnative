/**
 * UI Test WITHOUT border radius
 *
 * Tests UI panels using the direct GPU quad path (no Canvas 2D).
 * Panels without borderRadius and without transparency go through
 * the backgroundQuads path which works in native.
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
    PlaneGeometry,
    Quaternion,
    // UI System
    UIManager,
    UIRenderPass,
    Panel,
} from '../../../../src';

async function main() {
    console.log("=== UI No-Radius Test - Starting ===");

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
        throw new Error("No canvas found");
    }

    console.log("Creating Engine...");
    const engine = new Engine(canvas, { disableDebugger: true });
    await engine.init();
    console.log("Engine initialized");

    // Create scene
    const scene = new Scene(engine);
    scene.postProcessing.bloom.enabled = false;
    scene.postProcessing.ssao.enabled = false;
    scene.postProcessing.fxaa.enabled = false;
    scene.postProcessing.aa.enabled = false;
    scene.postProcessing.ssr.enabled = false;
    scene.postProcessing.godRays.enabled = false;
    scene.postProcessing.tonemapping.enabled = true;
    // Indirect draw is now supported in native runtime with indirect-first-instance feature

    scene.atmosphere.enabled = true;
    scene.atmosphere.sunDirection = new Vector3(0.5, 0.8, 0.3).normalize();

    const camera = new Camera();
    camera.transform.position = new Vector3(0, 2, 5);
    camera.transform.lookAt(new Vector3(0, 0, 0));

    const sun = new DirectionalLight();
    sun.direction = new Vector3(0.5, 1, 0.5).normalize();
    sun.intensity = 2.0;
    scene.addLight(sun);

    // Simple 3D objects
    const groundMat = new StandardMaterial(new Vector3(0.3, 0.4, 0.3), 0.8, 0.0);
    const ground = new Mesh(new PlaneGeometry(20, 20), groundMat);
    ground.transform.rotation = Quaternion.fromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    scene.addChild(ground);

    const boxMat = new StandardMaterial(new Vector3(0.7, 0.3, 0.3), 0.5, 0.0);
    const box = new Mesh(new BoxGeometry(1, 1, 1), boxMat);
    box.transform.position = new Vector3(0, 0.5, 0);
    scene.addChild(box);

    console.log("3D Scene created");

    // ============================================
    // UI SETUP - NO BORDER RADIUS, NO TRANSPARENCY
    // ============================================
    console.log("Setting up UI System...");

    const uiManager = new UIManager();
    uiManager.init(canvas);

    const uiPass = new UIRenderPass(uiManager);
    engine.addRenderPass(uiPass);

    // Root container
    const uiRoot = new Panel({
        width: '100%',
        height: '100%',
    });
    uiRoot.name = 'uiRoot';
    uiManager.setRoot(uiRoot);

    // Main panel - NO border radius, FULLY OPAQUE
    const mainPanel = new Panel({
        anchor: 'center',
        pivot: { x: 0.5, y: 0.5 },
        width: 400,
        height: 300,
        backgroundColor: '#1e2332',  // Fully opaque (no alpha)
        borderRadius: 0,  // NO border radius!
        padding: 20,
        direction: 'vertical',
        alignItems: 'center',
        gap: 12,
    });
    mainPanel.name = 'mainPanel';

    // Color boxes - NO border radius, FULLY OPAQUE
    const box1 = new Panel({
        width: 300,
        height: 50,
        backgroundColor: '#3a6ea5',  // Fully opaque
        borderRadius: 0,
    });

    const box2 = new Panel({
        width: 300,
        height: 50,
        backgroundColor: '#445566',
        borderRadius: 0,
    });

    const box3 = new Panel({
        width: 300,
        height: 50,
        backgroundColor: '#664433',
        borderRadius: 0,
    });

    mainPanel.addChild(box1);
    mainPanel.addChild(box2);
    mainPanel.addChild(box3);
    uiRoot.addChild(mainPanel);

    // Top-left HUD - no border radius
    const hudPanel = new Panel({
        anchor: 'top-left',
        x: 20,
        y: 20,
        width: 150,
        height: 60,
        backgroundColor: '#000000',  // Fully opaque black
        borderRadius: 0,
        borderColor: '#ffdd44',
        borderWidth: 2,
    });
    uiRoot.addChild(hudPanel);

    console.log("UI Panels created (no borderRadius)");

    // Debug: check render data
    const renderData = uiManager.getRenderData();
    console.log("UI Render Data count:", renderData.length);
    for (let i = 0; i < Math.min(3, renderData.length); i++) {
        const d = renderData[i];
        console.log(`RenderData[${i}]:`, JSON.stringify({
            type: d.type,
            borderRadius: d.borderRadius,
            backgroundColor: d.backgroundColor,
            backgroundAlpha: d.backgroundAlpha,
        }));
    }

    // Render loop
    let frame = 0;

    function render() {
        const dt = 1 / 60;
        box.transform.rotation = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), frame * dt);

        uiManager.update(dt);
        engine.render(scene, camera);

        if (frame === 0) {
            console.log("=== First frame rendered ===");
        }
        if (frame % 60 === 0) {
            console.log(`Frame ${frame}`);
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
