// Test setTimeout, setInterval, and fetch with file:// protocol
console.log("=== Testing setTimeout and fetch ===");

// Test setTimeout
console.log("Testing setTimeout...");
let timeoutCount = 0;
setTimeout(() => {
    timeoutCount++;
    console.log("Timeout 1 fired! (100ms)");
}, 100);

setTimeout(() => {
    timeoutCount++;
    console.log("Timeout 2 fired! (200ms)");
}, 200);

// Test setInterval
console.log("Testing setInterval...");
let intervalCount = 0;
const intervalId = setInterval(() => {
    intervalCount++;
    console.log("Interval tick:", intervalCount);
    if (intervalCount >= 3) {
        clearInterval(intervalId);
        console.log("Interval cleared after 3 ticks");
    }
}, 150);

// Test fetch with file://
async function testFetch() {
    console.log("Testing fetch with file://...");
    try {
        const response = await fetch('file:///tmp/test.json');
        console.log("Fetch response ok:", response.ok);
        console.log("Fetch response status:", response.status);

        const text = await response.text();
        console.log("Response text:", text);

        // Parse JSON
        const data = JSON.parse(text);
        console.log("Parsed JSON - message:", data.message);
        console.log("Parsed JSON - value:", data.value);

        console.log("=== Fetch test completed ===");
    } catch (e) {
        console.error("Fetch test error:", e);
    }
}

testFetch();

// Summary after 1 second
setTimeout(() => {
    console.log("=== Summary ===");
    console.log("Timeout count:", timeoutCount);
    console.log("Interval count:", intervalCount);
    console.log("=== All tests completed ===");
}, 1000);
