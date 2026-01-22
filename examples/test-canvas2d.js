// Canvas 2D test - Tests Skia-backed CanvasRenderingContext2D API
console.log("Canvas 2D test starting...");

function runTests() {
    // Get 2D context
    console.log("Getting 2D context...");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        console.error("Failed to get 2D context!");
        return;
    }

    console.log("Got 2D context:", ctx);
    console.log("Context type:", ctx._contextType);

    // Test 1: fillRect
    console.log("\n--- Test 1: fillRect ---");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(10, 10, 100, 50);
    console.log("Drew red rectangle at (10, 10) 100x50");

    // Test 2: strokeRect
    console.log("\n--- Test 2: strokeRect ---");
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 3;
    ctx.strokeRect(120, 10, 100, 50);
    console.log("Drew green stroked rectangle at (120, 10) 100x50");

    // Test 3: Text rendering
    console.log("\n--- Test 3: Text rendering ---");
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px sans-serif";
    ctx.fillText("Hello Canvas 2D!", 10, 100);
    console.log("Drew text 'Hello Canvas 2D!' at (10, 100)");

    // Test 4: measureText
    console.log("\n--- Test 4: measureText ---");
    const metrics = ctx.measureText("Hello");
    console.log("Text metrics for 'Hello':");
    console.log("  width:", metrics.width);
    console.log("  fontBoundingBoxAscent:", metrics.fontBoundingBoxAscent);
    console.log("  fontBoundingBoxDescent:", metrics.fontBoundingBoxDescent);

    // Test 5: Paths - Draw a triangle
    console.log("\n--- Test 5: Path drawing (triangle) ---");
    ctx.beginPath();
    ctx.moveTo(250, 80);
    ctx.lineTo(300, 10);
    ctx.lineTo(350, 80);
    ctx.closePath();
    ctx.fillStyle = "#0088ff";
    ctx.fill();
    console.log("Drew blue triangle");

    // Test 6: Arc
    console.log("\n--- Test 6: Arc (circle) ---");
    ctx.beginPath();
    ctx.arc(450, 45, 35, 0, Math.PI * 2);
    ctx.fillStyle = "#ffff00";
    ctx.fill();
    ctx.strokeStyle = "#ff8800";
    ctx.lineWidth = 2;
    ctx.stroke();
    console.log("Drew yellow circle with orange stroke");

    // Test 7: Save/Restore state
    console.log("\n--- Test 7: Save/Restore ---");
    ctx.save();
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(10, 130, 50, 50);
    console.log("Saved state, drew magenta rect");
    ctx.restore();
    ctx.fillRect(70, 130, 50, 50);  // Should use the previous fillStyle
    console.log("Restored state, drew rect with restored fillStyle");

    // Test 8: clearRect
    console.log("\n--- Test 8: clearRect ---");
    ctx.clearRect(20, 20, 30, 20);
    console.log("Cleared 30x20 region at (20, 20)");

    // Test 9: getImageData
    console.log("\n--- Test 9: getImageData ---");
    const imageData = ctx.getImageData(0, 0, 100, 100);
    console.log("Got image data:", imageData.width, "x", imageData.height);
    if (imageData.data) {
        console.log("Data buffer size:", imageData.data.byteLength, "bytes");
    }

    // Test 10: Text alignment
    console.log("\n--- Test 10: Text alignment ---");
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";

    // Draw reference line
    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(200, 150);
    ctx.lineTo(200, 220);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillText("Left", 200, 160);

    ctx.textAlign = "center";
    ctx.fillText("Center", 200, 180);

    ctx.textAlign = "right";
    ctx.fillText("Right", 200, 200);

    console.log("Drew text with different alignments");

    // Test 11: Bezier curve
    console.log("\n--- Test 11: Bezier curve ---");
    ctx.beginPath();
    ctx.moveTo(300, 150);
    ctx.bezierCurveTo(320, 100, 380, 200, 400, 150);
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    console.log("Drew cyan bezier curve");

    // Test 12: Quadratic curve (for rounded corners)
    console.log("\n--- Test 12: Rounded rectangle (using quadraticCurveTo) ---");
    const rx = 420, ry = 130, rw = 80, rh = 60, r = 10;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + rw - r, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
    ctx.lineTo(rx + rw, ry + rh - r);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
    ctx.lineTo(rx + r, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
    ctx.lineTo(rx, ry + r);
    ctx.quadraticCurveTo(rx, ry, rx + r, ry);
    ctx.closePath();
    ctx.fillStyle = "rgba(128, 0, 255, 0.8)";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    console.log("Drew rounded rectangle (purple with white border)");

    console.log("\n=== All Canvas 2D tests completed! ===");
    console.log("Canvas should show various shapes: red rect, green stroked rect,");
    console.log("white text, blue triangle, yellow circle, and more.");
}

runTests();
