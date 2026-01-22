#!/usr/bin/env bun
/**
 * Bundle all mystral-test examples
 *
 * This script bundles all TypeScript examples in the mystral-test directory
 * into JavaScript files that can be run with the mystral CLI.
 *
 * Usage:
 *   bun scripts/bundle-examples.ts
 */

import { Glob } from "bun";
import { join, basename } from "path";

const EXAMPLES_DIR = join(import.meta.dir, "../examples/mystral-test");

// List of example files to bundle
const EXAMPLES = [
  "main.ts",
  "basic-scene.ts",
  "sponza.ts",
  "sponza-full.ts",
  "forest2.ts",
  "ui-simple.ts",
  "ui-minimal.ts",
  "ui-test.ts",
  "ui-no-radius.ts",
];

async function bundleExample(entryFile: string): Promise<boolean> {
  const entryPath = join(EXAMPLES_DIR, entryFile);
  const outputPath = join(EXAMPLES_DIR, entryFile.replace(".ts", ".js"));

  console.log(`Bundling: ${entryFile} -> ${basename(outputPath)}`);

  try {
    const result = await Bun.build({
      entrypoints: [entryPath],
      target: "browser",
      format: "esm",
      minify: false,
      sourcemap: "none",
      splitting: false,
      define: {
        "process.env.NODE_ENV": '"production"',
      },
    });

    if (!result.success) {
      console.error(`  Failed to bundle ${entryFile}:`);
      for (const log of result.logs) {
        console.error(`    ${log}`);
      }
      return false;
    }

    // Get the bundled output
    let output = await result.outputs[0].text();

    // Post-process: Replace import.meta with a safe fallback
    output = output.replace(/import\.meta/g, '({ env: {}, url: "" })');

    // Write to file
    await Bun.write(outputPath, output);

    const sizeKB = (output.length / 1024).toFixed(1);
    console.log(`  Done: ${sizeKB} KB`);
    return true;
  } catch (error) {
    console.error(`  Error bundling ${entryFile}: ${error}`);
    return false;
  }
}

async function main() {
  console.log("=== Bundling Mystral Engine Examples ===\n");

  let success = 0;
  let failed = 0;

  for (const example of EXAMPLES) {
    const result = await bundleExample(example);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Success: ${success}/${EXAMPLES.length}`);

  if (failed > 0) {
    console.log(`Failed: ${failed}/${EXAMPLES.length}`);
    process.exit(1);
  }
}

main();
