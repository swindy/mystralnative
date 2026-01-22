/**
 * Mystral Engine GPU Tests
 *
 * Tests the full Mystral engine examples with indirect draw enabled.
 * These tests verify that:
 * - Damaged Helmet (main.js) renders correctly
 * - Sponza scene loads and renders
 * - Forest2 procedural scene works
 * - UI components render properly
 * - React reconciler works with native runtime
 *
 * Screenshots are saved to /tmp/ for visual verification.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { spawn } from "bun";
import { existsSync, mkdirSync, rmSync, statSync } from "fs";
import { join } from "path";

const MYSTRAL_BIN = join(import.meta.dir, "../../build/mystral");
const EXAMPLES_DIR = join(import.meta.dir, "../../examples");
const OUTPUT_DIR = "/tmp";

// Helper function to run an example and capture screenshot
async function runExample(
  scriptPath: string,
  outputName: string,
  frames: number = 120,
  timeout: number = 60000
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const outputPath = join(OUTPUT_DIR, outputName);

  // Remove old screenshot if exists
  if (existsSync(outputPath)) {
    rmSync(outputPath);
  }

  const proc = spawn({
    cmd: [
      MYSTRAL_BIN,
      "run",
      scriptPath,
      "--headless",
      "--screenshot",
      outputPath,
      "--frames",
      String(frames),
      "--width",
      "1280",
      "--height",
      "720",
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  // Wait for process with timeout
  const exitCode = await proc.exited;

  const screenshotSaved = stdout.includes("Screenshot saved") && existsSync(outputPath);

  if (screenshotSaved) {
    const stats = statSync(outputPath);
    console.log(`Screenshot saved: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  return {
    success: screenshotSaved,
    stdout,
    stderr,
  };
}

describe("Mystral Engine Examples", () => {
  beforeAll(() => {
    // Verify mystral binary exists
    if (!existsSync(MYSTRAL_BIN)) {
      throw new Error(`Mystral binary not found at ${MYSTRAL_BIN}. Run 'bun run build' first.`);
    }
  });

  it("should render Damaged Helmet (main.js) with indirect draw", async () => {
    const scriptPath = join(EXAMPLES_DIR, "mystral-test/main.js");
    if (!existsSync(scriptPath)) {
      console.log("Skipping: main.js not found - run prebundle first");
      return;
    }

    const result = await runExample(scriptPath, "mystral-main.png", 120);

    // Verify indirect draw is enabled in output
    expect(result.stdout).toContain("indirect-first-instance feature enabled");
    expect(result.success).toBe(true);

    // Verify no fatal errors
    expect(result.stdout).not.toContain("Fatal:");
  }, 120000);

  it("should render Sponza scene with indirect draw", async () => {
    const scriptPath = join(EXAMPLES_DIR, "mystral-test/sponza.js");
    if (!existsSync(scriptPath)) {
      console.log("Skipping: sponza.js not found - run prebundle first");
      return;
    }

    const result = await runExample(scriptPath, "mystral-sponza.png", 120);

    expect(result.stdout).toContain("indirect-first-instance feature enabled");
    expect(result.success).toBe(true);
    expect(result.stdout).not.toContain("Fatal:");
  }, 180000); // Sponza takes longer to load

  it("should render Sponza Full scene with indirect draw", async () => {
    const scriptPath = join(EXAMPLES_DIR, "mystral-test/sponza-full.js");
    if (!existsSync(scriptPath)) {
      console.log("Skipping: sponza-full.js not found - run prebundle first");
      return;
    }

    const result = await runExample(scriptPath, "mystral-sponza-full.png", 120);

    expect(result.stdout).toContain("indirect-first-instance feature enabled");
    expect(result.success).toBe(true);
    expect(result.stdout).not.toContain("Fatal:");
  }, 180000);

  it("should render Forest2 procedural scene with indirect draw", async () => {
    const scriptPath = join(EXAMPLES_DIR, "mystral-test/forest2.js");
    if (!existsSync(scriptPath)) {
      console.log("Skipping: forest2.js not found - run prebundle first");
      return;
    }

    const result = await runExample(scriptPath, "mystral-forest2.png", 120);

    expect(result.stdout).toContain("indirect-first-instance feature enabled");
    expect(result.success).toBe(true);
    expect(result.stdout).not.toContain("Fatal:");
  }, 180000);

  it("should render UI Simple test with indirect draw", async () => {
    const scriptPath = join(EXAMPLES_DIR, "mystral-test/ui-simple.js");
    if (!existsSync(scriptPath)) {
      console.log("Skipping: ui-simple.js not found - run prebundle first");
      return;
    }

    const result = await runExample(scriptPath, "mystral-ui-simple.png", 120);

    expect(result.stdout).toContain("indirect-first-instance feature enabled");
    expect(result.success).toBe(true);
    expect(result.stdout).not.toContain("Fatal:");
  }, 120000);

  it("should render UI Test with indirect draw", async () => {
    const scriptPath = join(EXAMPLES_DIR, "mystral-test/ui-test.js");
    if (!existsSync(scriptPath)) {
      console.log("Skipping: ui-test.js not found - run prebundle first");
      return;
    }

    const result = await runExample(scriptPath, "mystral-ui-test.png", 120);

    expect(result.stdout).toContain("indirect-first-instance feature enabled");
    expect(result.success).toBe(true);
    expect(result.stdout).not.toContain("Fatal:");
  }, 120000);

  it("should render Basic Scene with indirect draw", async () => {
    const scriptPath = join(EXAMPLES_DIR, "mystral-test/basic-scene.js");
    if (!existsSync(scriptPath)) {
      console.log("Skipping: basic-scene.js not found - run prebundle first");
      return;
    }

    const result = await runExample(scriptPath, "mystral-basic-scene.png", 120);

    expect(result.stdout).toContain("indirect-first-instance feature enabled");
    expect(result.success).toBe(true);
    expect(result.stdout).not.toContain("Fatal:");
  }, 120000);

  it("should render React test with indirect draw", async () => {
    const scriptPath = join(EXAMPLES_DIR, "react-test/dist/bundle.js");
    if (!existsSync(scriptPath)) {
      console.log("Skipping: react-test bundle not found - run 'cd examples/react-test && bun run build' first");
      return;
    }

    const result = await runExample(scriptPath, "mystral-react-test.png", 120);

    // Verify indirect draw is enabled
    expect(result.stdout).toContain("indirect-first-instance feature enabled");
    expect(result.success).toBe(true);

    // Verify React components mounted
    expect(result.stdout).toContain("React tree mounted");

    // Verify all 3 meshes rendered (plane + 2 cubes)
    expect(result.stdout).toContain("Rendered 3 deferred meshes");

    expect(result.stdout).not.toContain("Fatal:");
  }, 120000);

  it("should render 3D UI test (Canvas 2D over WebGPU)", async () => {
    const scriptPath = join(EXAMPLES_DIR, "test-ui-3d.js");
    if (!existsSync(scriptPath)) {
      console.log("Skipping: test-ui-3d.js not found");
      return;
    }

    const result = await runExample(scriptPath, "mystral-ui-3d.png", 120);

    expect(result.success).toBe(true);

    // Verify Canvas 2D context was created
    expect(result.stdout).toContain("Canvas 2D context created");

    // Verify UI pipeline was created
    expect(result.stdout).toContain("UI pipeline created");

    // Verify render loop started
    expect(result.stdout).toContain("Starting render loop - 3D cube with UI overlay!");

    expect(result.stdout).not.toContain("Fatal:");
  }, 120000);
});
