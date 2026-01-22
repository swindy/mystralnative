/**
 * Fetch API Tests
 *
 * Tests fetch() with file:// and http:// - no GPU required (runs headless with early exit).
 * These tests run in CI.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { spawn } from "bun";
import { existsSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const MYSTRAL_BIN = join(import.meta.dir, "../../build/mystral");
const TEST_DIR = join(import.meta.dir, "../../.test-tmp");

describe("Fetch API", () => {
  beforeAll(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    // Create test JSON file
    writeFileSync(
      join(TEST_DIR, "test.json"),
      JSON.stringify({ message: "Hello from test", value: 42 })
    );

    // Create test text file
    writeFileSync(join(TEST_DIR, "test.txt"), "Hello, World!");
  });

  it("should fetch local JSON file", async () => {
    if (!existsSync(MYSTRAL_BIN)) {
      console.log("Skipping: mystral binary not found");
      return;
    }

    // Create a test script that fetches the JSON file
    const testScript = `
      async function main() {
        try {
          const response = await fetch('file://${join(TEST_DIR, "test.json")}');
          if (!response.ok) {
            console.log('FAIL: response not ok');
            return;
          }
          const data = await response.json();
          if (data.message === 'Hello from test' && data.value === 42) {
            console.log('PASS: JSON fetch works');
          } else {
            console.log('FAIL: unexpected data', JSON.stringify(data));
          }
        } catch (e) {
          console.log('FAIL: ' + e.message);
        }
      }
      main();
    `;

    writeFileSync(join(TEST_DIR, "fetch-test.js"), testScript);

    const screenshotPath = join(TEST_DIR, "fetch-test-screenshot.png");
    const proc = spawn({
      cmd: [
        MYSTRAL_BIN,
        "run",
        join(TEST_DIR, "fetch-test.js"),
        "--headless",
        "--screenshot",
        screenshotPath,
        "--frames",
        "10",
      ],
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    expect(stdout).toContain("PASS: JSON fetch works");
  });

  it("should fetch local text file", async () => {
    if (!existsSync(MYSTRAL_BIN)) {
      console.log("Skipping: mystral binary not found");
      return;
    }

    const testScript = `
      async function main() {
        try {
          const response = await fetch('file://${join(TEST_DIR, "test.txt")}');
          if (!response.ok) {
            console.log('FAIL: response not ok');
            return;
          }
          const text = await response.text();
          if (text === 'Hello, World!') {
            console.log('PASS: text fetch works');
          } else {
            console.log('FAIL: unexpected text: ' + text);
          }
        } catch (e) {
          console.log('FAIL: ' + e.message);
        }
      }
      main();
    `;

    writeFileSync(join(TEST_DIR, "fetch-text-test.js"), testScript);

    const screenshotPath = join(TEST_DIR, "fetch-text-screenshot.png");
    const proc = spawn({
      cmd: [
        MYSTRAL_BIN,
        "run",
        join(TEST_DIR, "fetch-text-test.js"),
        "--headless",
        "--screenshot",
        screenshotPath,
        "--frames",
        "10",
      ],
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    expect(stdout).toContain("PASS: text fetch works");
  });

  it("should return 404 for nonexistent file", async () => {
    if (!existsSync(MYSTRAL_BIN)) {
      console.log("Skipping: mystral binary not found");
      return;
    }

    const testScript = `
      async function main() {
        try {
          const response = await fetch('file://${join(TEST_DIR, "nonexistent.txt")}');
          if (response.status === 404 && !response.ok) {
            console.log('PASS: 404 for nonexistent file');
          } else {
            console.log('FAIL: expected 404, got ' + response.status);
          }
        } catch (e) {
          console.log('FAIL: ' + e.message);
        }
      }
      main();
    `;

    writeFileSync(join(TEST_DIR, "fetch-404-test.js"), testScript);

    const screenshotPath = join(TEST_DIR, "fetch-404-screenshot.png");
    const proc = spawn({
      cmd: [
        MYSTRAL_BIN,
        "run",
        join(TEST_DIR, "fetch-404-test.js"),
        "--headless",
        "--screenshot",
        screenshotPath,
        "--frames",
        "10",
      ],
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    expect(stdout).toContain("PASS: 404 for nonexistent file");
  });

  it("should support arrayBuffer()", async () => {
    if (!existsSync(MYSTRAL_BIN)) {
      console.log("Skipping: mystral binary not found");
      return;
    }

    const testScript = `
      async function main() {
        try {
          const response = await fetch('file://${join(TEST_DIR, "test.txt")}');
          const buffer = await response.arrayBuffer();
          if (buffer instanceof ArrayBuffer && buffer.byteLength === 13) {
            console.log('PASS: arrayBuffer works');
          } else {
            console.log('FAIL: unexpected buffer size ' + buffer.byteLength);
          }
        } catch (e) {
          console.log('FAIL: ' + e.message);
        }
      }
      main();
    `;

    writeFileSync(join(TEST_DIR, "fetch-buffer-test.js"), testScript);

    const screenshotPath = join(TEST_DIR, "fetch-buffer-screenshot.png");
    const proc = spawn({
      cmd: [
        MYSTRAL_BIN,
        "run",
        join(TEST_DIR, "fetch-buffer-test.js"),
        "--headless",
        "--screenshot",
        screenshotPath,
        "--frames",
        "10",
      ],
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    expect(stdout).toContain("PASS: arrayBuffer works");
  });
});
