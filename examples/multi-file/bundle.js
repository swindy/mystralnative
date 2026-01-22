// examples/multi-file/utils.ts
function add(a, b) {
  return a + b;
}
function multiply(a, b) {
  return a * b;
}
var PI = 3.14159;

// examples/multi-file/main.ts
console.log("Multi-file example with imports");
console.log("Testing imports from ./utils.ts:");
console.log(`  add(2, 3) = ${add(2, 3)}`);
console.log(`  multiply(4, 5) = ${multiply(4, 5)}`);
console.log(`  PI = ${PI}`);
var radius = 5;
var area = multiply(PI, multiply(radius, radius));
console.log(`  Circle area (r=5) = ${area}`);
console.log("Import test passed!");
