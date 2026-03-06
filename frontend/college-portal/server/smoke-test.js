const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'controllers');
const controllers = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));

console.log('--- Controller Smoke Test ---');
for (const controller of controllers) {
    try {
        console.log(`Loading: ${controller}...`);
        require(`./controllers/${controller}`);
        console.log(`Success: ${controller}`);
    } catch (error) {
        console.error(`FAILED: ${controller}`);
        console.error(error);
        process.exit(1);
    }
}
console.log('--- All Controllers Loaded Successfully ---');
