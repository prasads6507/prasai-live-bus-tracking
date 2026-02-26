const { google } = require('googleapis');
const { BigQuery } = require('@google-cloud/bigquery');
const { db } = require('../config/firebase');

// Constants for Firestore metrics
const METRIC_READS = 'firestore.googleapis.com/document/read_count';
const METRIC_WRITES = 'firestore.googleapis.com/document/write_count';
const METRIC_DELETES = 'firestore.googleapis.com/document/delete_count';

/**
 * Gets authentication client for Google Cloud Monitoring
 */
const getMonitoringClient = async () => {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        projectId: process.env.FIREBASE_PROJECT_ID,
        scopes: ['https://www.googleapis.com/auth/monitoring.read'],
    });
    return await auth.getClient();
};

/**
 * GET /api/owner/firebase-usage/overview?month=YYYY-MM
 * Returns total Firestore reads, writes, and deletes for the specified month.
 */
const getUsageOverview = async (req, res) => {
    const { month } = req.query; // YYYY-MM
    if (!month) return res.status(400).json({ message: 'Month (YYYY-MM) is required' });

    try {
        const monitoring = google.monitoring('v3');
        const authClient = await getMonitoringClient();
        const projectId = process.env.FIREBASE_PROJECT_ID;

        // Calculate time range
        const startOfMonth = new Date(`${month}-01T00:00:00Z`);
        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);

        const startTime = startOfMonth.toISOString();
        const endTime = endOfMonth.toISOString();

        const getMetricValue = async (metricType) => {
            const request = {
                auth: authClient,
                name: `projects/${projectId}`,
                filter: `metric.type="${metricType}"`,
                'interval.startTime': startTime,
                'interval.endTime': endTime,
                view: 'FULL',
            };

            const response = await monitoring.projects.timeSeries.list(request);
            let total = 0;
            if (response.data.timeSeries) {
                for (const series of response.data.timeSeries) {
                    for (const point of series.points) {
                        total += parseInt(point.value.int64Value || 0);
                    }
                }
            }
            return total;
        };

        const [totalReads, totalWrites, totalDeletes] = await Promise.all([
            getMetricValue(METRIC_READS),
            getMetricValue(METRIC_WRITES),
            getMetricValue(METRIC_DELETES),
        ]);

        res.json({
            month,
            totalReads,
            totalWrites,
            totalDeletes,
        });
    } catch (error) {
        console.error('[Owner] Error fetching Firebase usage:', error);
        res.status(500).json({
            month,
            totalReads: 0,
            totalWrites: 0,
            totalDeletes: 0,
            note: 'Error fetching monitoring metrics: ' + error.message
        });
    }
};

/**
 * GET /api/owner/firebase-usage/cost?month=YYYY-MM
 * Returns total GCP/Firebase cost for the specified month from BigQuery billing export.
 */
const getUsageCost = async (req, res) => {
    const { month } = req.query; // YYYY-MM
    if (!month) return res.status(400).json({ message: 'Month (YYYY-MM) is required' });

    const bqProjectId = process.env.BILLING_BQ_PROJECT_ID;
    const bqDataset = process.env.BILLING_BQ_DATASET;
    const bqTable = process.env.BILLING_BQ_TABLE;
    const targetProjectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

    if (!bqProjectId || !bqDataset || !bqTable) {
        return res.json({
            month,
            totalCostThisMonth: 0,
            currency: 'USD',
            note: 'Billing export not configured / Spark plan'
        });
    }

    try {
        const bigquery = new BigQuery({
            credentials: {
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            projectId: bqProjectId,
        });

        const query = `
            SELECT
                SUM(cost) as total_cost,
                currency,
                SUM(CASE WHEN service.description = 'Cloud Firestore' THEN cost ELSE 0 END) as firestore_cost
            FROM
                \`${bqProjectId}.${bqDataset}.${bqTable}\`
            WHERE
                project.id = @projectId
                AND _PARTITIONDATE >= @startDate
                AND _PARTITIONDATE < @endDate
            GROUP BY
                currency
        `;

        const [year, monthVal] = month.split('-');
        const startDate = `${year}-${monthVal}-01`;
        const nextMonth = new Date(startDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const endDate = nextMonth.toISOString().split('T')[0];

        const options = {
            query,
            params: {
                projectId: targetProjectId,
                startDate,
                endDate
            },
        };

        const [rows] = await bigquery.query(options);

        if (rows.length === 0) {
            return res.json({
                month,
                totalCostThisMonth: 0,
                currency: 'USD',
                note: 'No billing data found for this period'
            });
        }

        res.json({
            month,
            totalCostThisMonth: rows[0].total_cost || 0,
            currency: rows[0].currency || 'USD',
            firestoreCostThisMonth: rows[0].firestore_cost || 0
        });
    } catch (error) {
        console.error('[Owner] Error fetching cost from BigQuery:', error);
        res.json({
            month,
            totalCostThisMonth: 0,
            currency: 'USD',
            note: 'Billing info unavailable: ' + error.message
        });
    }
};

module.exports = {
    getUsageOverview,
    getUsageCost
};
