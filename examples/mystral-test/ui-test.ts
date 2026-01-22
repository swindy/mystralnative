/**
 * UI System Test for Mystral Native Runtime
 *
 * Tests the Canvas-based UI library:
 * - UIManager and UIRenderPass
 * - Panel, Button, Label, Slider, Toggle components
 * - Flexbox-style layout
 * - Keyboard navigation
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
    Button,
    Label,
    Slider,
    Toggle,
} from '../../../../src';

async function main() {
    console.log("=== UI System Test - Starting ===");

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

    // Create scene with minimal settings for performance
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

    // Enable atmosphere for a nice background
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
    sun.color = new Vector3(1, 0.95, 0.9);
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
    // UI SYSTEM SETUP
    // ============================================
    console.log("Setting up UI System...");

    const uiManager = new UIManager();
    uiManager.init(canvas);

    // Add UI render pass to engine
    const uiPass = new UIRenderPass(uiManager);
    engine.addRenderPass(uiPass);

    // ============================================
    // CREATE UI ELEMENTS
    // ============================================

    // Root container (full screen)
    const uiRoot = new Panel({
        width: '100%',
        height: '100%',
    });
    uiRoot.name = 'uiRoot';
    uiManager.setRoot(uiRoot);

    // Main menu panel (centered)
    const menuPanel = new Panel({
        anchor: 'center',
        pivot: { x: 0.5, y: 0.5 },
        width: 400,
        backgroundColor: 'rgba(30, 35, 50, 0.92)',
        borderColor: '#4488aa',
        borderWidth: 2,
        borderRadius: 16,
        padding: 30,
        direction: 'vertical',
        alignItems: 'center',
        gap: 16,
    });
    menuPanel.name = 'menuPanel';

    // Title
    const title = new Label('UI SYSTEM TEST', {
        fontSize: 28,
        color: '#ffffff',
        textAlign: 'center',
    });
    menuPanel.addChild(title);

    // Subtitle
    const subtitle = new Label('Mystral Native Runtime', {
        fontSize: 14,
        color: '#8899aa',
        textAlign: 'center',
    });
    menuPanel.addChild(subtitle);

    // Spacer
    const spacer1 = new Panel({ height: 20 });
    menuPanel.addChild(spacer1);

    // Test button 1
    const button1 = new Button('Primary Button', {
        width: 280,
        height: 50,
        fontSize: 18,
        backgroundColor: '#3a6ea5',
        hoverBackgroundColor: '#4a7eb5',
        pressedBackgroundColor: '#2a5e95',
        borderRadius: 8,
        focusBorderColor: '#63b3ed',
        focusBorderWidth: 3,
    });
    button1.onClick = () => {
        console.log('[UI] Primary button clicked!');
        statusLabel.text = 'Status: Primary clicked';
    };
    menuPanel.addChild(button1);

    // Test button 2
    const button2 = new Button('Secondary Button', {
        width: 280,
        height: 50,
        fontSize: 18,
        backgroundColor: '#445566',
        hoverBackgroundColor: '#556677',
        pressedBackgroundColor: '#334455',
        borderRadius: 8,
        focusBorderColor: '#63b3ed',
        focusBorderWidth: 3,
    });
    button2.onClick = () => {
        console.log('[UI] Secondary button clicked!');
        statusLabel.text = 'Status: Secondary clicked';
    };
    menuPanel.addChild(button2);

    // Spacer
    const spacer2 = new Panel({ height: 10 });
    menuPanel.addChild(spacer2);

    // Volume slider
    const volumeSlider = new Slider(
        { min: 0, max: 100, value: 75, label: 'Volume' },
        { width: 280, labelWidth: 70 }
    );
    volumeSlider.onChange = (value) => {
        console.log(`[UI] Volume changed to: ${value}`);
        statusLabel.text = `Status: Volume = ${value}`;
    };
    menuPanel.addChild(volumeSlider);

    // Brightness slider
    const brightnessSlider = new Slider(
        { min: 0, max: 100, value: 50, label: 'Bright' },
        { width: 280, labelWidth: 70 }
    );
    brightnessSlider.onChange = (value) => {
        console.log(`[UI] Brightness changed to: ${value}`);
        // Actually adjust the exposure
        scene.postProcessing.tonemapping.exposure = 0.5 + (value / 100) * 1.5;
        statusLabel.text = `Status: Brightness = ${value}`;
    };
    menuPanel.addChild(brightnessSlider);

    // Fullscreen toggle
    const fullscreenToggle = new Toggle('Fullscreen', false);
    fullscreenToggle.onChange = (value) => {
        console.log(`[UI] Fullscreen toggle: ${value}`);
        statusLabel.text = `Status: Fullscreen = ${value}`;
    };
    menuPanel.addChild(fullscreenToggle);

    // Spacer
    const spacer3 = new Panel({ height: 10 });
    menuPanel.addChild(spacer3);

    // Status label
    const statusLabel = new Label('Status: Ready', {
        fontSize: 14,
        color: '#66dd66',
        textAlign: 'center',
    });
    menuPanel.addChild(statusLabel);

    // Instructions
    const instructionsLabel = new Label('Use Arrow keys or W/S to navigate, Enter to select', {
        fontSize: 11,
        color: '#667788',
        textAlign: 'center',
        margin: { top: 10, right: 0, bottom: 0, left: 0 },
    });
    menuPanel.addChild(instructionsLabel);

    uiRoot.addChild(menuPanel);

    console.log("UI Elements created");

    // ============================================
    // KEYBOARD NAVIGATION
    // ============================================
    const focusableElements = [button1, button2, volumeSlider, brightnessSlider, fullscreenToggle];
    let focusIndex = 0;

    const updateFocus = () => {
        for (let i = 0; i < focusableElements.length; i++) {
            focusableElements[i].setFocus(i === focusIndex);
        }
    };

    // Set initial focus
    updateFocus();

    document.addEventListener('keydown', (e: any) => {
        const key = e.key;
        console.log(`[UI] Key pressed: ${key}`);

        // Navigation
        if (key === 'ArrowUp' || key === 'w' || key === 'W') {
            focusIndex = (focusIndex - 1 + focusableElements.length) % focusableElements.length;
            updateFocus();
        } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
            focusIndex = (focusIndex + 1) % focusableElements.length;
            updateFocus();
        }

        // Activation
        if (key === 'Enter' || key === ' ') {
            const focused = focusableElements[focusIndex];
            if (focused && focused.onClick) {
                focused.onClick({
                    type: 'click',
                    x: 0,
                    y: 0,
                    stopPropagation: () => {},
                    preventDefault: () => {},
                });
            }
        }

        // Slider adjustment with left/right
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
            const focused = focusableElements[focusIndex];
            if (focused instanceof Slider) {
                focused.value = Math.max(focused.config.min, focused.value - 5);
            }
        } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
            const focused = focusableElements[focusIndex];
            if (focused instanceof Slider) {
                focused.value = Math.min(focused.config.max, focused.value + 5);
            }
        }
    });

    console.log("Keyboard navigation set up");

    // ============================================
    // RENDER LOOP
    // ============================================
    let frame = 0;
    let rotationAngle = 0;

    function render() {
        const dt = 1 / 60;

        // Animate objects in scene
        rotationAngle += dt;
        box.transform.rotation = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), rotationAngle);
        sphere.transform.position = new Vector3(2, 0.6 + Math.sin(rotationAngle * 2) * 0.2, 0);

        // Update UI
        uiManager.update(dt);

        // Render
        engine.render(scene, camera);

        // Debug output
        if (frame === 0) {
            console.log("=== UI System Test Initialized Successfully ===");
            console.log("UI Root:", uiRoot.name);
            console.log("Menu Panel:", menuPanel.name);
            console.log("Focusable elements:", focusableElements.length);
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
