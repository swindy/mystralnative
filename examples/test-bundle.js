// examples/test-bundle/test.ts
console.log("Test bundle starting...");
function add(a, b) {
  return a + b;
}
var result = add(2, 3);
console.log(`2 + 3 = ${result}`);
async function main() {
  console.log("Main function starting...");
  if (!navigator.gpu) {
    console.error("WebGPU not supported!");
    return;
  }
  console.log("WebGPU available");
  const adapter = await navigator.gpu.requestAdapter();
  console.log("Adapter:", adapter);
  if (!adapter) {
    console.error("No adapter");
    return;
  }
  const device = await adapter.requestDevice();
  console.log("Device acquired");
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: "opaque"
  });
  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      storeOp: "store",
      clearValue: { r: 0.5, g: 0.2, b: 0.8, a: 1 }
    }]
  });
  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
  console.log("Rendered one frame!");
  function render() {
    const commandEncoder2 = device.createCommandEncoder();
    const renderPass2 = commandEncoder2.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0.5, g: 0.2, b: 0.8, a: 1 }
      }]
    });
    renderPass2.end();
    device.queue.submit([commandEncoder2.finish()]);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
  console.log("Render loop started");
}
main().catch((e) => console.error("Error:", e));
