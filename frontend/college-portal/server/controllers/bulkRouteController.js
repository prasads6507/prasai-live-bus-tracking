const { db } = require('../config/firebase');
const xlsx = require('xlsx');

// @desc    Upload and import routes from Excel/CSV file
// @route   POST /api/admin/routes/bulk-upload
// @access  Private (College Admin)
// @desc    Bulk create routes from JSON (Frontend parsed)
// @route   POST /api/admin/routes/bulk-json
// @access  Private (College Admin)
const createBulkRoutesJson = async (req, res) => {
    try {
        const { routes } = req.body;

        if (!Array.isArray(routes) || routes.length === 0) {
            return res.status(400).json({ message: 'No routes provided' });
        }

        const batch = db.batch();
        const results = {
            success: [],
            errors: [],
            createdRoutes: 0,
            createdStops: 0
        };

        const collegeId = req.collegeId;

        // Fetch existing routes to minimize reads? or just check one by one.
        // For simplicity and correctness with overwrite, let's check one by one or fetch all.
        // Fetching all routes for college to check existence efficiently.
        const routesSnapshot = await db.collection('routes').where('collegeId', '==', collegeId).get();
        const existingRoutesMap = new Map();
        routesSnapshot.docs.forEach(doc => {
            existingRoutesMap.set(doc.data().routeName, doc.id);
        });

        for (const routeItem of routes) {
            try {
                const routeName = routeItem.routeName;
                const stopsStr = routeItem.stops || '';

                if (!routeName) {
                    results.errors.push({ route: routeItem, error: 'Missing route name' });
                    continue;
                }

                let routeId = existingRoutesMap.get(routeName);

                // create or update route
                if (!routeId) {
                    routeId = 'route-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    const newRoute = {
                        routeId,
                        collegeId,
                        routeName,
                        startPoint: '',
                        endPoint: '',
                        createdAt: new Date().toISOString()
                    };
                    batch.set(db.collection('routes').doc(routeId), newRoute);
                    results.createdRoutes++;
                } else {
                    // If updating... we don't really change much on route itself unless start/end point provided
                }

                // Process Stops (Overwrite existing stops for simplicity? Or smart merge? User said "apply accordingly")
                // Easiest is to delete existing stops for this route and re-create them from the list, ensuring order.
                // However, we can't easily delete in a batch without reading them first.
                // Alternative: Use a sub-batch or just create new ones and orphan old ones? No, bad.
                // Let's standardise: If uploading via bulk, we REPLACE the stops for that route.

                // 1. Find existing stops to delete
                const stopsRef = db.collection('stops');
                if (existingRoutesMap.has(routeName)) {
                    // We need to delete old stops.
                    // This is expensive in a loop.
                    // IMPORTANT: Limit execution. If too many routes, this might timeout.
                    const oldStops = await stopsRef.where('routeId', '==', routeId).where('collegeId', '==', collegeId).get();
                    oldStops.docs.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                }

                const stopNames = stopsStr.split(',').map(s => s.trim()).filter(s => s);
                stopNames.forEach((name, index) => {
                    const stopId = 'stop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + index;
                    const stopData = {
                        stopId,
                        collegeId,
                        routeId,
                        stopName: name,
                        latitude: 0,
                        longitude: 0,
                        order: index + 1
                    };
                    batch.set(db.collection('stops').doc(stopId), stopData);
                    results.createdStops++;
                });

                results.success.push(routeName);

            } catch (err) {
                results.errors.push({ route: routeItem, error: err.message });
            }
        }

        await batch.commit();

        res.json({
            message: `Processed ${routes.length} routes. Created/Updated: ${results.success.length}`,
            results
        });

    } catch (error) {
        console.error('Bulk route json error:', error);
        res.status(500).json({ message: error.message });
    }
};

const uploadRoutesFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Parse the uploaded file
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });

        // Get routes sheet
        const routesSheetName = workbook.SheetNames[0];
        const routesSheet = workbook.Sheets[routesSheetName];
        const routesData = xlsx.utils.sheet_to_json(routesSheet);

        // Get stops sheet if exists
        let stopsData = [];
        if (workbook.SheetNames.length > 1) {
            const stopsSheetName = workbook.SheetNames[1];
            const stopsSheet = workbook.Sheets[stopsSheetName];
            stopsData = xlsx.utils.sheet_to_json(stopsSheet);
        }

        // Validate and prepare data
        const results = {
            success: [],
            errors: [],
            totalRoutes: routesData.length,
            createdRoutes: 0,
            createdStops: 0
        };

        const batch = db.batch();
        const processedRoutes = new Map();

        // Process each route
        for (const row of routesData) {
            try {
                // Validate required fields
                if (!row['Route Name']) {
                    results.errors.push({
                        row: row,
                        error: 'Missing required field: Route Name'
                    });
                    continue;
                }

                const routeName = row['Route Name'].toString().trim();

                // Check for duplicate route names in file
                if (processedRoutes.has(routeName)) {
                    results.errors.push({
                        row: row,
                        error: `Duplicate route name: ${routeName}`
                    });
                    continue;
                }

                // Check if route already exists in database
                const existingRoute = await db.collection('routes')
                    .where('collegeId', '==', req.collegeId)
                    .where('routeName', '==', routeName)
                    .get();

                if (!existingRoute.empty) {
                    results.errors.push({
                        row: row,
                        error: `Route already exists: ${routeName}`
                    });
                    continue;
                }

                // Create route
                const routeId = 'route-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                const newRoute = {
                    routeId,
                    collegeId: req.collegeId,
                    routeName: routeName,
                    startPoint: '',
                    endPoint: '',
                    createdAt: new Date().toISOString()
                };

                batch.set(db.collection('routes').doc(routeId), newRoute);
                processedRoutes.set(routeName, routeId);
                results.createdRoutes++;
                results.success.push(routeName);

                // Process stops for this route
                const routeStops = stopsData.filter(stop =>
                    stop['Route Name'] && stop['Route Name'].toString().trim() === routeName
                );

                routeStops.forEach((stop, index) => {
                    if (stop['Stop Name']) {
                        const stopId = 'stop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + index;
                        const stopData = {
                            stopId,
                            collegeId: req.collegeId,
                            routeId,
                            stopName: stop['Stop Name'].toString().trim(),
                            latitude: 0,
                            longitude: 0,
                            order: index + 1
                        };
                        batch.set(db.collection('stops').doc(stopId), stopData);
                        results.createdStops++;
                    }
                });

            } catch (error) {
                results.errors.push({
                    row: row,
                    error: error.message
                });
            }
        }

        // Commit all changes
        if (results.createdRoutes > 0) {
            await batch.commit();
        }

        res.json({
            message: `Successfully imported ${results.createdRoutes} routes with ${results.createdStops} stops`,
            results
        });

    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({
            message: 'Failed to process file',
            error: error.message
        });
    }
};

// @desc    Download sample Excel template
// @route   GET /api/admin/routes/template
// @access  Private (College Admin)
const downloadTemplate = (req, res) => {
    try {
        // Create sample data
        const routesData = [
            { 'Route Name': 'Route A' },
            { 'Route Name': 'Route B' },
            { 'Route Name': 'Route C' }
        ];

        const stopsData = [
            { 'Route Name': 'Route A', 'Stop Name': 'Stop 1' },
            { 'Route Name': 'Route A', 'Stop Name': 'Stop 2' },
            { 'Route Name': 'Route A', 'Stop Name': 'Stop 3' },
            { 'Route Name': 'Route B', 'Stop Name': 'Stop 1' },
            { 'Route Name': 'Route B', 'Stop Name': 'Stop 2' }
        ];

        // Create workbook
        const wb = xlsx.utils.book_new();

        // Add routes sheet
        const routesWS = xlsx.utils.json_to_sheet(routesData);
        xlsx.utils.book_append_sheet(wb, routesWS, 'Routes');

        // Add stops sheet
        const stopsWS = xlsx.utils.json_to_sheet(stopsData);
        xlsx.utils.book_append_sheet(wb, stopsWS, 'Stops');

        // Generate buffer
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set headers
        res.setHeader('Content-Disposition', 'attachment; filename=routes_template.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        res.send(buffer);

    } catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ message: 'Failed to generate template' });
    }
};

module.exports = {
    uploadRoutesFile,
    downloadTemplate,
    createBulkRoutesJson
};
