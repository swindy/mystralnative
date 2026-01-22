// Simple debug test to check what's available in mystral native
console.log("=== Debug Test ===");

console.log("typeof Symbol:", typeof Symbol);
console.log("typeof Symbol.for:", typeof Symbol.for);
console.log("typeof globalThis:", typeof globalThis);
console.log("typeof window:", typeof window);
console.log("typeof document:", typeof document);
console.log("typeof canvas:", typeof canvas);
console.log("typeof navigator:", typeof navigator);
console.log("typeof navigator.gpu:", typeof navigator.gpu);

// Check if we have the necessary Symbol support
try {
  const testSymbol = Symbol.for("test.symbol");
  console.log("Symbol.for works:", testSymbol.toString());
} catch (e) {
  console.log("Symbol.for error:", e.message);
}

// Check if Object.defineProperty works
try {
  const obj = {};
  Object.defineProperty(obj, 'test', { value: 42, configurable: true });
  console.log("Object.defineProperty works:", obj.test);
} catch (e) {
  console.log("Object.defineProperty error:", e.message);
}

// Check queueMicrotask
console.log("typeof queueMicrotask:", typeof queueMicrotask);

// Check Promise
console.log("typeof Promise:", typeof Promise);

// Check setTimeout
console.log("typeof setTimeout:", typeof setTimeout);

// Check document.createElement
try {
  if (typeof document !== 'undefined' && document.createElement) {
    const el = document.createElement('div');
    console.log("document.createElement works:", el ? "yes" : "no");
  } else {
    console.log("document.createElement not available");
  }
} catch (e) {
  console.log("document.createElement error:", e.message);
}

// Try a simple async function
async function testAsync() {
  console.log("Async function works");
  return 42;
}

testAsync().then(v => console.log("Promise resolved:", v)).catch(e => console.log("Promise error:", e));

// Try to render a simple frame
async function renderTest() {
  console.log("Starting renderTest...");

  if (!navigator.gpu) {
    console.log("No WebGPU!");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  console.log("Got WebGPU device");

  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device: device,
    format: format,
    alphaMode: "opaque"
  });

  // Simple render
  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: textureView,
      loadOp: "clear",
      storeOp: "store",
      clearValue: { r: 0.2, g: 0.8, b: 0.2, a: 1.0 }  // Green
    }]
  });
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);
  console.log("Frame rendered!");

  requestAnimationFrame(() => {
    console.log("RAF callback executed");
  });
}

renderTest().catch(e => console.log("renderTest error:", e.message, e.stack));

console.log("Debug test complete");
