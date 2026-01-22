// Full Sponza test for Mystral Native Runtime
// Includes: atmosphere, day/night cycle, torches, fireflies, fog, god rays, WASD controls

import {
    Engine,
    Scene,
    Camera,
    DirectionalLight,
    PointLight,
    AmbientLight,
    Vector3,
    loadGLTFModel,
    InputManager,
    WASDController,
    Quaternion,
    Mesh,
    SphereGeometry,
    StandardMaterial,
} from '../../../../src';

async function main() {
    console.log("Mystral Native - Full Sponza Test Starting");

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

    // Sponza-specific settings
    scene.shadows.resolution = 4096;
    scene.shadows.maxLights = 2;  // Sun + Moon shadows

    scene.render.occlusionCulling = false;
    // Indirect draw is now supported in native runtime with indirect-first-instance feature

    // Post-processing
    scene.postProcessing.aa.enabled = true;
    scene.postProcessing.bloom.enabled = true;
    scene.postProcessing.bloom.threshold = 1.5;
    scene.postProcessing.bloom.intensity = 1.0;
    scene.postProcessing.tonemapping.enabled = true;
    scene.postProcessing.tonemapping.exposure = 1.0;

    // Disable heavy effects for now (can enable if working)
    scene.postProcessing.ssao.enabled = false;
    scene.postProcessing.fxaa.enabled = false;
    scene.postProcessing.ssr.enabled = false;

    // Global Illumination
    scene.globalIllumination.enabled = false;  // Disable for initial test
    scene.globalIllumination.intensity = 0.2;

    // God Rays (Volumetric Lighting)
    scene.postProcessing.godRays.enabled = true;
    scene.postProcessing.godRays.intensity = 0.2;
    scene.postProcessing.godRays.decay = 0.97;
    scene.postProcessing.godRays.density = 0.5;
    scene.postProcessing.godRays.weight = 0.1;
    scene.postProcessing.godRays.exposure = 0.3;
    scene.postProcessing.godRays.samples = 80;
    scene.postProcessing.godRays.maxDistance = 1.5;

    // Atmosphere
    scene.atmosphere.enabled = true;
    scene.atmosphere.sunIlluminance = new Vector3(10.0, 10.0, 10.0);
    scene.atmosphere.sunDiskEnabled = true;
    scene.atmosphere.sunDiskScale = 2.5;
    scene.atmosphere.moonEnabled = true;
    scene.atmosphere.moonPhase = 0.5;
    scene.atmosphere.moonScale = 1.8;
    scene.atmosphere.starsEnabled = true;
    scene.atmosphere.starsIntensity = 1.0;
    scene.atmosphere.starsTwinkle = 0.3;

    // Fog
    scene.fog.enabled = true;
    scene.fog.type = 'EXP2';
    scene.fog.density = 0.002;
    scene.fog.color = new Vector3(0.5, 0.6, 0.7);

    console.log("Scene settings configured");

    // Load Sponza
    const device = engine.getDevice()!;
    const sponzaPath = '/Users/suyogsonwalkar/Projects/mystral/apps/mystral/dist/assets/Sponza/glTF/Sponza.gltf';

    console.log("Loading Sponza...");
    let sponzaNode: any = null;
    try {
        sponzaNode = await loadGLTFModel(device, sponzaPath);
        if (sponzaNode) {
            sponzaNode.transform.scale = new Vector3(1, 1, 1);
            scene.addChild(sponzaNode);
            console.log("Sponza loaded and added to scene");
        }
    } catch (e: any) {
        console.log("Failed to load Sponza:", e.message || e);
    }

    // Sun Light (Directional) - synced with atmosphere
    const sunLight = new DirectionalLight(new Vector3(1, 0.95, 0.8), 2.0);
    sunLight.transform.position = new Vector3(20, 50, 10);
    sunLight.transform.lookAt(new Vector3(0, 0, 0));
    sunLight.shadow.castShadow = true;
    sunLight.shadow.bias = 0.001;
    sunLight.shadow.normalBias = 0.02;
    scene.addLight(sunLight);
    console.log("Sun light added");

    // Moon Light (Directional)
    const moonLight = new DirectionalLight(new Vector3(0.6, 0.7, 0.9), 0.0);
    moonLight.transform.position = new Vector3(-20, 50, -10);
    moonLight.transform.lookAt(new Vector3(0, 0, 0));
    moonLight.shadow.castShadow = true;
    moonLight.shadow.bias = 0.001;
    moonLight.shadow.normalBias = 0.02;
    moonLight.shadow.intensity = 0.95;
    scene.addLight(moonLight);
    console.log("Moon light added");

    // Ambient Light
    const ambientLight = new AmbientLight(new Vector3(1.0, 1.0, 1.0), 0.15);
    scene.addLight(ambientLight);
    console.log("Ambient light added");

    // Torch lights
    const torchPositions = [
        new Vector3(-10, 1, 0),
        new Vector3(10, 1, 0),
        new Vector3(-10, 1, -5),
        new Vector3(10, 1, -5),
        new Vector3(0, 1, 5),
    ];

    const torchLights: PointLight[] = [];
    const torchFlameMaterials: StandardMaterial[] = [];

    torchPositions.forEach((pos) => {
        const light = new PointLight(new Vector3(1.0, 0.6, 0.2), 0.0, 30, 1.5);
        light.transform.position = pos.clone();
        light.transform.position.y += 0.5;
        scene.addLight(light);
        torchLights.push(light);

        const flameMat = new StandardMaterial();
        flameMat.albedo = new Vector3(0.3, 0.3, 0.3);
        flameMat.emissive = new Vector3(0, 0, 0);
        torchFlameMaterials.push(flameMat);
    });
    console.log("Torch lights added:", torchLights.length);

    // Fireflies
    interface Firefly {
        light: PointLight;
        mesh: Mesh;
        material: StandardMaterial;
        basePos: Vector3;
        color: Vector3;
        phase: Vector3;
        speed: Vector3;
        amplitude: Vector3;
    }

    const fireflies: Firefly[] = [];
    const fireflyColors = [
        new Vector3(1.0, 0.9, 0.5),
        new Vector3(0.5, 1.0, 0.8),
        new Vector3(1.0, 0.5, 0.8),
        new Vector3(0.8, 0.6, 1.0),
        new Vector3(0.5, 0.8, 1.0),
        new Vector3(1.0, 0.7, 0.4),
        new Vector3(0.6, 1.0, 0.6),
        new Vector3(1.0, 0.4, 0.4),
    ];

    for (let i = 0; i < 10; i++) {
        const basePos = new Vector3(
            (Math.random() - 0.5) * 20,
            1.5 + Math.random() * 3,
            (Math.random() - 0.5) * 10
        );

        const color = fireflyColors[i % fireflyColors.length].clone();

        const light = new PointLight(color.clone(), 0.0, 8, 1.5);
        light.transform.position = basePos.clone();
        scene.addLight(light);

        const mat = new StandardMaterial();
        mat.albedo = new Vector3(0.3, 0.3, 0.3);
        mat.emissive = new Vector3(0, 0, 0);
        const mesh = new Mesh(new SphereGeometry(0.08, 8, 4), mat);
        mesh.transform.position = basePos.clone();
        scene.addChild(mesh);

        fireflies.push({
            light,
            mesh,
            material: mat,
            basePos,
            color,
            phase: new Vector3(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2),
            speed: new Vector3(0.08 + Math.random() * 0.12, 0.06 + Math.random() * 0.08, 0.08 + Math.random() * 0.12),
            amplitude: new Vector3(1.5 + Math.random() * 2.0, 0.5 + Math.random() * 1.0, 1.5 + Math.random() * 2.0),
        });
    }
    console.log("Fireflies added:", fireflies.length);

    // Camera
    const camera = new Camera(60, canvas.width / canvas.height, 0.1, 1000.0);
    camera.transform.position = new Vector3(0.5, 2, -0.75);
    camera.transform.rotation = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

    // Input and WASD controller
    const inputManager = new InputManager(canvas);
    const controller = new WASDController(camera);
    controller.movementSpeed = 10;
    console.log("WASD Controller initialized - use WASD to move, mouse to look");

    // Debug: log key presses
    window.addEventListener('keydown', (e: any) => {
        console.log(`Key pressed: ${e.key} (code: ${e.code})`);
    });

    // Time state
    let timeOfDay = 12.0;  // Start at noon
    const cycleSpeed = 1.0;  // 1 hour per 6 seconds
    let fireflyTime = 0;

    function timeToSunAngle(hours: number): number {
        return ((hours - 6) / 24) * Math.PI * 2;
    }

    function updateCelestials() {
        const angle = timeToSunAngle(timeOfDay);

        // Sun direction
        const sunY = Math.sin(angle);
        const sunX = Math.cos(angle);
        const sunDir = new Vector3(sunX, sunY, 0.2).normalize();
        scene.atmosphere.sunDirection.copy(sunDir);

        // Moon direction
        const moonPhase = 0.5;
        const moonAngle = angle + Math.PI + (moonPhase - 0.5) * 0.3;
        const moonY = Math.sin(moonAngle);
        const moonX = Math.cos(moonAngle);
        const moonDir = new Vector3(moonX, moonY, -0.1).normalize();
        scene.atmosphere.moonDirection.copy(moonDir);

        // Sync sun light
        sunLight.transform.position = sunDir.multiplyScalar(100);
        sunLight.transform.lookAt(new Vector3(0, 0, 0));

        const elevation = Math.max(0, sunDir.y);
        const isDaytime = sunDir.y > 0.1;
        sunLight.intensity = 3.0 * elevation;
        sunLight.color = new Vector3(
            1.0,
            Math.min(1.0, 0.5 + 0.5 * elevation),
            Math.min(1.0, 0.2 + 0.8 * elevation)
        );
        sunLight.shadow.castShadow = isDaytime;
        scene.atmosphere.sunIlluminance.copy(sunLight.color.clone().multiplyScalar(10.0));

        // Sync moon light
        moonLight.transform.position = moonDir.multiplyScalar(100);
        moonLight.transform.lookAt(new Vector3(0, 0, 0));

        const moonElevation = Math.max(0, moonDir.y);
        const isNightTime = sunDir.y < 0.1;
        const phaseBrightness = 0.5 + 0.5 * Math.abs(moonPhase - 0.5) * 2;
        const moonIntensity = isNightTime ? 0.4 * moonElevation * phaseBrightness : 0.0;
        moonLight.intensity = moonIntensity;
        moonLight.shadow.castShadow = isNightTime && moonElevation > 0.1;

        // Torch logic
        const torchFactor = isNightTime ? (1.0 - Math.max(0, (sunDir.y + 0.2) / 0.3)) : 0.0;
        const torchActive = torchFactor > 0.01;

        torchLights.forEach((light, i) => {
            if (torchActive) {
                light.intensity = 5.0 * torchFactor;
                torchFlameMaterials[i].emissive = new Vector3(1.5 * torchFactor, 0.8 * torchFactor, 0.2 * torchFactor);
                torchFlameMaterials[i].albedo = new Vector3(0, 0, 0);
            } else {
                light.intensity = 0.0;
                torchFlameMaterials[i].emissive = new Vector3(0, 0, 0);
                torchFlameMaterials[i].albedo = new Vector3(0.3, 0.3, 0.3);
            }
        });

        // Firefly visibility
        const nightFactor = torchFactor;
        return { isNightTime, nightFactor };
    }

    function updateFireflies(dt: number, isNight: boolean, nightFactor: number) {
        fireflyTime += dt;

        fireflies.forEach((firefly) => {
            if (!isNight || nightFactor < 0.01) {
                firefly.light.intensity = 0.0;
                firefly.material.emissive = new Vector3(0, 0, 0);
                firefly.material.albedo = new Vector3(0, 0, 0);
                firefly.mesh.visible = false;
                return;
            }

            firefly.mesh.visible = true;

            const offset = new Vector3(
                Math.sin(fireflyTime * firefly.speed.x + firefly.phase.x) * firefly.amplitude.x,
                Math.sin(fireflyTime * firefly.speed.y + firefly.phase.y) * firefly.amplitude.y,
                Math.sin(fireflyTime * firefly.speed.z + firefly.phase.z) * firefly.amplitude.z
            );

            const newPos = firefly.basePos.add(offset);
            firefly.light.transform.position = newPos;
            firefly.mesh.transform.position = newPos;

            firefly.light.intensity = 8.0 * nightFactor;
            firefly.light.color = firefly.color.clone();

            const emissiveStrength = 5 * nightFactor;
            firefly.material.emissive = firefly.color.multiplyScalar(emissiveStrength);
            firefly.material.albedo = new Vector3(0, 0, 0);
        });
    }

    function updateFog(sunDir: Vector3) {
        let targetFogColor: Vector3;
        if (sunDir.y > 0.2) {
            targetFogColor = new Vector3(0.5, 0.6, 0.7);
        } else if (sunDir.y > -0.1) {
            const dayColor = new Vector3(0.5, 0.6, 0.7);
            const sunsetColor = new Vector3(0.8, 0.5, 0.2);
            const nightColor = new Vector3(0.05, 0.05, 0.1);

            if (sunDir.y > 0.0) {
                targetFogColor = sunsetColor.lerp(dayColor, sunDir.y / 0.2);
            } else {
                targetFogColor = nightColor.lerp(sunsetColor, (sunDir.y + 0.1) / 0.1);
            }
        } else {
            targetFogColor = new Vector3(0.02, 0.02, 0.05);
        }
        scene.fog.color.copy(targetFogColor);
    }

    // Initial update
    updateCelestials();

    // Render loop
    let frame = 0;
    let lastTime = performance.now();

    function render() {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        // Update time of day
        const hoursPerSecond = cycleSpeed / 6.0;
        timeOfDay += dt * hoursPerSecond;
        if (timeOfDay >= 24) {
            timeOfDay -= 24;
        }

        // Update celestials and get night state
        const { isNightTime, nightFactor } = updateCelestials();

        // Update fireflies
        updateFireflies(dt, isNightTime, nightFactor);

        // Update fog color
        const angle = timeToSunAngle(timeOfDay);
        const sunY = Math.sin(angle);
        const sunX = Math.cos(angle);
        const sunDir = new Vector3(sunX, sunY, 0.2).normalize();
        updateFog(sunDir);

        // Update input and controller
        const inputState = inputManager.update();
        controller.update(dt, inputState);

        // Debug output
        if (frame % 120 === 0) {
            const pos = camera.transform.position;
            const hours = Math.floor(timeOfDay);
            const mins = Math.floor((timeOfDay - hours) * 60);
            console.log(`Frame ${frame}: Time ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}, Camera at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
        }

        // Render
        engine.render(scene, camera);

        frame++;
        requestAnimationFrame(render);
    }

    console.log("Starting render loop with day/night cycle...");
    render();
}

main().catch(e => {
    console.log("Error:", e.message || e);
});
