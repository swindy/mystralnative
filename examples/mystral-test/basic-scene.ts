/**
 * Basic Scene Test - No UI
 *
 * Tests basic 3D rendering without any UI components.
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
} from '../../../../src';

async function main() {
    console.log("=== Basic Scene Test (No UI) - Starting ===");

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
        throw new Error("No canvas found");
    }

    console.log("Creating Engine...");
    const engine = new Engine(canvas, { disableDebugger: true });
    await engine.init();
    console.log("Engine initialized");

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

    // Create ground
    const groundMat = new StandardMaterial(new Vector3(0.3, 0.4, 0.3), 0.8, 0.0);
    const ground = new Mesh(new PlaneGeometry(20, 20), groundMat);
    ground.transform.rotation = Quaternion.fromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
    scene.addChild(ground);

    // Create box
    const boxMat = new StandardMaterial(new Vector3(0.7, 0.3, 0.3), 0.5, 0.0);
    const box = new Mesh(new BoxGeometry(1, 1, 1), boxMat);
    box.transform.position = new Vector3(-2, 0.5, 0);
    scene.addChild(box);

    // Create sphere
    const sphereMat = new StandardMaterial(new Vector3(0.3, 0.3, 0.7), 0.3, 0.0);
    const sphere = new Mesh(new SphereGeometry(0.6, 24, 16), sphereMat);
    sphere.transform.position = new Vector3(2, 0.6, 0);
    scene.addChild(sphere);

    console.log("3D Scene objects created");

    // Render loop
    let frame = 0;
    let rotationAngle = 0;

    function render() {
        const dt = 1 / 60;

        // Animate objects
        rotationAngle += dt;
        box.transform.rotation = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), rotationAngle);
        sphere.transform.position = new Vector3(2, 0.6 + Math.sin(rotationAngle * 2) * 0.2, 0);

        // Render
        engine.render(scene, camera);

        if (frame === 0) {
            console.log("=== Basic Scene Test Initialized ===");
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
