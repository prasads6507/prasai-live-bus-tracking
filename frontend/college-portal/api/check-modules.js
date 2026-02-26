const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
    const pathsToCheck = [
        'node_modules/firebase-admin',
        'node_modules/express',
        'frontend/college-portal/node_modules/firebase-admin',
        'frontend/college-portal/node_modules/express'
    ];

    const results = {};
    for (const p of pathsToCheck) {
        const full = path.join(process.cwd(), p);
        results[p] = fs.existsSync(full) ? 'EXISTS' : 'MISSING';
    }

    res.json({
        ok: true,
        cwd: process.cwd(),
        results,
        all_dirs: fs.readdirSync(process.cwd()).filter(f => fs.statSync(f).isDirectory())
    });
};
