/**
 * Minimal UI Test - Direct WebGPU quad rendering
 *
 * Tests if the UIRenderPass's basic quad rendering works
 * by bypassing the Canvas 2D text system entirely.
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
} from '../../../../src';

async function main() {
    console.log("=== Minimal UI Test - Starting ===");

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

    console.log("Scene created - NO UI PASS");

    // Render WITHOUT UI pass to verify base rendering works
    let frame = 0;

    function render() {
        const dt = 1 / 60;
        box.transform.rotation = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), frame * dt);

        engine.render(scene, camera);

        if (frame === 0) {
            console.log("=== Minimal Test - First Frame Rendered ===");
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
