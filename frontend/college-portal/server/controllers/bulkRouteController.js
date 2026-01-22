const { db } = require('../config/firebase');
const xlsx = require('xlsx');

// @desc    Upload and import routes from Excel/CSV file
// @route   POST /api/admin/routes/bulk-upload
// @access  Private (College Admin)
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
                if (!row['Route Name'] || !row['Start Point'] || !row['End Point']) {
                    results.errors.push({
                        row: row,
                        error: 'Missing required fields (Route Name, Start Point, End Point)'
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
                    startPoint: row['Start Point'].toString().trim(),
                    endPoint: row['End Point'].toString().trim(),
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
                            latitude: parseFloat(stop['Latitude']) || 0,
                            longitude: parseFloat(stop['Longitude']) || 0,
                            order: parseInt(stop['Order']) || (index + 1)
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
            { 'Route Name': 'Route A', 'Start Point': 'Main Campus', 'End Point': 'City Center' },
            { 'Route Name': 'Route B', 'Start Point': 'North Gate', 'End Point': 'South Station' }
        ];

        const stopsData = [
            { 'Route Name': 'Route A', 'Stop Name': 'Stop 1', 'Latitude': 12.34, 'Longitude': 56.78, 'Order': 1 },
            { 'Route Name': 'Route A', 'Stop Name': 'Stop 2', 'Latitude': 12.35, 'Longitude': 56.79, 'Order': 2 },
            { 'Route Name': 'Route B', 'Stop Name': 'Stop 1', 'Latitude': 13.45, 'Longitude': 57.89, 'Order': 1 }
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
    downloadTemplate
};
