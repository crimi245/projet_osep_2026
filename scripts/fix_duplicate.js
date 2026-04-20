const fs = require('fs');

// Read the server.js file
const content = fs.readFileSync('server.js', 'utf-8');
const lines = content.split('\r\n');

// Remove lines 656-676 (0-indexed: 655-675) - the duplicate endpoint
const beforeDuplicate = lines.slice(0, 656);
const afterDuplicate = lines.slice(677);
const fixedLines = beforeDuplicate.concat(afterDuplicate);

// Write back
fs.writeFileSync('server.js', fixedLines.join('\r\n'), 'utf-8');

console.log('✅ Duplicate endpoint removed successfully!');
console.log('Removed lines 657-677 (duplicate /api/dashboard/running-meetings)');
console.log('Total lines before:', lines.length);
console.log('Total lines after:', fixedLines.length);
