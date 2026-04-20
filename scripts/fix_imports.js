
const fs = require('fs');
const path = require('path');

const dirs = ['scripts', 'tests'];

dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        if (!file.endsWith('.js')) return;
        const filePath = path.join(dirPath, file);
        let content = fs.readFileSync(filePath, 'utf8');

        // Replace ./db with ../config/db
        let newContent = content.replace(/require\(['"]\.\/db['"]\)/g, "require('../config/db')");

        // Replace ./server with ../server
        newContent = newContent.replace(/require\(['"]\.\/server['"]\)/g, "require('../server')");

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log(`Updated imports in ${dir}/${file}`);
        }
    });
});
console.log("Imports updated successfully.");
