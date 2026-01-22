// Multi-file example demonstrating imports
import { add, multiply, PI } from './utils';

console.log("Multi-file example with imports");
console.log("Testing imports from ./utils.ts:");
console.log(`  add(2, 3) = ${add(2, 3)}`);
console.log(`  multiply(4, 5) = ${multiply(4, 5)}`);
console.log(`  PI = ${PI}`);

// Test calculation
const radius = 5;
const area = multiply(PI, multiply(radius, radius));
console.log(`  Circle area (r=5) = ${area}`);

console.log("Import test passed!");
