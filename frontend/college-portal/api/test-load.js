module.exports = (req, res) => {
    const results = {};
    const modules = [
        '../server/config/firebase',
        '../server/routes/auth.routes',
        '../server/routes/owner.routes',
        '../server/routes/bulkRoute.routes',
        '../server/routes/collegeAdmin.routes',
        '../server/routes/driver.routes',
        '../server/routes/student.routes',
        '../server/controllers/geocodeController'
    ];

    for (const mod of modules) {
        try {
            const start = Date.now();
            require(mod);
            results[mod] = `OK (${Date.now() - start}ms)`;
        } catch (e) {
            results[mod] = `ERROR: ${e.message}`;
            // If it crashes, we might not even get here if it's a top-level crash that exits the process.
            // But this try/catch should catch most Node errors.
        }
    }

    res.json({
        ok: true,
        message: 'Module load test completed',
        results,
        env: {
            NODE_ENV: process.env.NODE_ENV,
            PWD: process.env.PWD
        }
    });
};
