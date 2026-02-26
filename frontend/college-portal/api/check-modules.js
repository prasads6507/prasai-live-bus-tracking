const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
    const modulesToCheck = [
        'firebase-admin',
        'express',
        'googleapis',
        'express-rate-limit'
    ];

    const results = {};
    for (const mod of modulesToCheck) {
        try {
            require.resolve(mod);
            results[mod] = 'EXISTS';
        } catch (e) {
            results[mod] = 'MISSING';
        }
    }

    res.json({
        ok: true,
        cwd: process.cwd(),
        results,
        env: process.env.NODE_ENV,
        node_version: process.version
    });
};
