const fs = require('fs');
const path = require('path');

function listFiles(dir, depth = 0) {
    if (depth > 3) return []; // Limit depth
    try {
        const files = fs.readdirSync(dir);
        let results = [];
        for (const f of files) {
            if (f === 'node_modules' || f === '.git') continue;
            const full = path.join(dir, f);
            try {
                const stat = fs.statSync(full);
                if (stat.isDirectory()) {
                    results.push(`DIR: ${full}`);
                    results = results.concat(listFiles(full, depth + 1));
                } else {
                    results.push(`FILE: ${full}`);
                }
            } catch (e) {
                results.push(`ERROR statting ${full}: ${e.message}`);
            }
        }
        return results;
    } catch (e) {
        return [`ERROR reading ${dir}: ${e.message}`];
    }
}

module.exports = (req, res) => {
    res.json({
        ok: true,
        cwd: process.cwd(),
        files: listFiles(process.cwd())
    });
};
