/**
 * GLTF Loading Test
 *
 * Tests the Mystral.loadGLTF() binding by loading the Damaged Helmet model
 */

// Declare the Mystral namespace
declare const Mystral: {
    loadGLTF: (path: string) => any;
};

console.log("GLTF Loading Test - Starting");

// Load the damaged helmet GLB file
const helmetPath = "/Users/suyogsonwalkar/Projects/mystral/apps/mystral/dist/assets/DamagedHelmet/glTF-Binary/DamagedHelmet.glb";

console.log("Loading: " + helmetPath);

try {
    const gltf = Mystral.loadGLTF(helmetPath);

    console.log("\n=== GLTF Data ===");
    console.log("Meshes: " + gltf.meshes.length);
    console.log("Materials: " + gltf.materials.length);
    console.log("Images: " + gltf.images.length);
    console.log("Nodes: " + gltf.nodes.length);
    console.log("Scenes: " + gltf.scenes.length);

    // Print mesh details
    for (let i = 0; i < gltf.meshes.length; i++) {
        const mesh = gltf.meshes[i];
        console.log("\nMesh " + i + ": " + mesh.name);
        console.log("  Primitives: " + mesh.primitives.length);

        for (let j = 0; j < mesh.primitives.length; j++) {
            const prim = mesh.primitives[j];
            console.log("  Primitive " + j + ":");
            console.log("    Positions: " + (prim.positions ? prim.positionCount : 0));
            console.log("    Indices: " + (prim.indices ? prim.indexCount : 0));
            console.log("    Has normals: " + (prim.normals !== undefined));
            console.log("    Has texcoords: " + (prim.texcoords !== undefined));
            console.log("    Has tangents: " + (prim.tangents !== undefined));
            console.log("    Material index: " + prim.materialIndex);
        }
    }

    // Print material details
    for (let i = 0; i < gltf.materials.length; i++) {
        const mat = gltf.materials[i];
        console.log("\nMaterial " + i + ": " + mat.name);
        console.log("  Base color: [" + mat.baseColorFactor.join(", ") + "]");
        console.log("  Metallic: " + mat.metallicFactor);
        console.log("  Roughness: " + mat.roughnessFactor);
        console.log("  Base color texture index: " + mat.baseColorTextureIndex);
        console.log("  Normal texture index: " + mat.normalTextureIndex);
        console.log("  MetallicRoughness texture index: " + mat.metallicRoughnessTextureIndex);
        console.log("  Emissive texture index: " + mat.emissiveTextureIndex);
        console.log("  Occlusion texture index: " + mat.occlusionTextureIndex);
    }

    // Print image details
    for (let i = 0; i < gltf.images.length; i++) {
        const img = gltf.images[i];
        console.log("\nImage " + i + ": " + img.name);
        console.log("  URI: " + img.uri);
        console.log("  MIME type: " + img.mimeType);
        console.log("  Has embedded data: " + (img.data !== undefined));
        if (img.data) {
            console.log("  Data size: " + img.data.length + " bytes");
        }
    }

    console.log("\n=== GLTF Loading Test Complete ===");

} catch (e: any) {
    console.log("Error loading GLTF: " + (e.message || e));
}

// Exit after printing
