const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('INSERT INTO users')) {
        console.log(`Found at line ${index + 1}: ${line.trim()}`);
    }
});
