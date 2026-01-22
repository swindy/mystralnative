// HTTP Fetch Test
// Tests HTTP/HTTPS fetch functionality with httpbin.org
console.log("HTTP Fetch Test starting...");

async function runTests() {
    let passed = 0;
    let failed = 0;

    // Test 1: Fetch a simple HTTPS JSON API
    console.log("\n=== Test 1: Fetch JSON API ===");
    try {
        const response = await fetch('https://httpbin.org/json');
        console.log("Status:", response.status);
        console.log("OK:", response.ok);

        if (response.ok) {
            const json = await response.json();
            console.log("JSON data received:", JSON.stringify(json).substring(0, 100) + "...");
            passed++;
        } else {
            console.log("Request failed with status:", response.status);
            failed++;
        }
    } catch (e) {
        console.log("Error:", e.message);
        failed++;
    }

    // Test 2: Fetch binary data (small image)
    console.log("\n=== Test 2: Fetch Binary Data ===");
    try {
        const response = await fetch('https://httpbin.org/image/png');
        console.log("Status:", response.status);
        console.log("OK:", response.ok);

        if (response.ok) {
            const buffer = await response.arrayBuffer();
            console.log("Received", buffer.byteLength, "bytes");

            // Check PNG magic bytes
            const bytes = new Uint8Array(buffer);
            const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
            console.log("Is PNG:", isPNG);

            if (isPNG && buffer.byteLength > 0) {
                passed++;
            } else {
                failed++;
            }
        } else {
            failed++;
        }
    } catch (e) {
        console.log("Error:", e.message);
        failed++;
    }

    // Test 3: Fetch with gzip compression (automatic)
    console.log("\n=== Test 3: Fetch Gzip Compressed ===");
    try {
        const response = await fetch('https://httpbin.org/gzip');
        console.log("Status:", response.status);

        if (response.ok) {
            const json = await response.json();
            console.log("Gzip response received, gzipped:", json.gzipped);
            if (json.gzipped) {
                passed++;
            } else {
                failed++;
            }
        } else {
            failed++;
        }
    } catch (e) {
        console.log("Error:", e.message);
        failed++;
    }

    // Test 4: Test 404 handling
    console.log("\n=== Test 4: Handle 404 ===");
    try {
        const response = await fetch('https://httpbin.org/status/404');
        console.log("Status:", response.status);
        console.log("OK:", response.ok);

        if (response.status === 404 && !response.ok) {
            console.log("404 handled correctly");
            passed++;
        } else {
            failed++;
        }
    } catch (e) {
        console.log("Error:", e.message);
        failed++;
    }

    // Test 5: Fetch redirect (httpbin redirects)
    console.log("\n=== Test 5: Follow Redirects ===");
    try {
        const response = await fetch('https://httpbin.org/redirect/1');
        console.log("Status:", response.status);
        console.log("Final URL:", response.url);

        if (response.ok && response.url.includes('/get')) {
            console.log("Redirect followed correctly");
            passed++;
        } else {
            failed++;
        }
    } catch (e) {
        console.log("Error:", e.message);
        failed++;
    }

    // Summary
    console.log("\n=== Results ===");
    console.log("Passed:", passed);
    console.log("Failed:", failed);

    if (failed === 0) {
        console.log("All tests passed!");
    }
}

runTests().catch(e => console.log("Test error:", e.message));
