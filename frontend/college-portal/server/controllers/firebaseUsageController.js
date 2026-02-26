const { google } = require('googleapis');
const { BigQuery } = require('@google-cloud/bigquery');
const { admin } = require('../config/firebase');

// Lazy-loaded clients to prevent failure at import time
let monitoringClient = null;
let bqClient = null;

/**
 * Gets credentials for Google Cloud APIs.
 * Prioritizes dedicated SA JSON, then falls back to individual env vars, then Firebase Admin vars.
 */
const getCredentials = () => {
    // 1. Try dedicated JSON blob (recommended by user)
    if (process.env.MONITORING_SA_JSON) {
        try {
            return JSON.parse(process.env.MONITORING_SA_JSON);
        } catch (e) {
            console.error('[Usage] Failed to parse MONITORING_SA_JSON');
        }
    }

    // 2. Fallback to individual Firebase Admin vars
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        return {
            project_id: process.env.FIREBASE_PROJECT_ID,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
    }

    return null;
};

/**
 * Lazy initializer for Monitoring Client
 */
const getMonitoringClient = async () => {
    if (monitoringClient) return monitoringClient;

    const credentials = getCredentials();
    if (!credentials) throw new Error('Missing Google Cloud credentials');

    const auth = new google.auth.GoogleAuth({
        credentials,
        projectId: credentials.project_id || process.env.FIREBASE_PROJECT_ID,
        scopes: ['https://www.googleapis.com/auth/monitoring.read'],
    });

    monitoringClient = await auth.getClient();
    return monitoringClient;
};

/**
 * Lazy initializer for BigQuery Client
 */
const getBigQueryClient = async (bqProjectId) => {
    if (bqClient) return bqClient;

    const credentials = getCredentials();
    if (!credentials) throw new Error('Missing BigQuery credentials');

    bqClient = new BigQuery({
        credentials,
        projectId: bqProjectId || process.env.BILLING_BQ_PROJECT_ID,
    });

    return bqClient;
};

/**
 * GET /api/owner/firebase-usage/overview?month=YYYY-MM
 */
const getUsageOverview = async (req, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'Month (YYYY-MM) is required' });

    try {
        const monitoring = google.monitoring('v3');
        const authClient = await getMonitoringClient();
        const projectId = process.env.FIREBASE_PROJECT_ID;

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

        const [totalReads, totalWrites, totalDeletes, authCreations, functionExecutions] = await Promise.all([
            getMetricValue('firestore.googleapis.com/document/read_count'),
            getMetricValue('firestore.googleapis.com/document/write_count'),
            getMetricValue('firestore.googleapis.com/document/delete_count'),
            getMetricValue('identitytoolkit.googleapis.com/accounts/create_count'),
            getMetricValue('cloudfunctions.googleapis.com/function/execution_count'),
        ]);

        console.log(`[Usage] Fetched metrics for ${projectId} in ${month}`);

        res.json({
            month,
            totalReads,
            totalWrites,
            totalDeletes,
            authCreations,
            functionExecutions
        });
    } catch (error) {
        console.error('[Owner] Error fetching Firebase usage:', error);
        res.json({
            month,
            totalReads: 0, totalWrites: 0, totalDeletes: 0,
            note: 'Monitoring info unavailable: ' + error.message
        });
    }
};

/**
 * GET /api/owner/firebase-usage/cost?month=YYYY-MM
 */
const getUsageCost = async (req, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'Month (YYYY-MM) is required' });

    const bqProjectId = process.env.BILLING_BQ_PROJECT_ID;
    const bqDataset = process.env.BILLING_BQ_DATASET;
    const bqTable = process.env.BILLING_BQ_TABLE;
    const targetProjectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

    if (!bqProjectId || !bqDataset || !bqTable) {
        return res.json({
            month, totalCostThisMonth: 0, currency: 'USD',
            note: 'Billing export not configured / Spark plan'
        });
    }

    try {
        const bigquery = await getBigQueryClient(bqProjectId);

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

        const [rows] = await bigquery.query({
            query,
            params: { projectId: targetProjectId, startDate, endDate },
        });

        if (rows.length === 0) {
            return res.json({ month, totalCostThisMonth: 0, currency: 'USD', note: 'No data found' });
        }

        res.json({
            month,
            totalCostThisMonth: rows[0].total_cost || 0,
            currency: rows[0].currency || 'USD',
            firestoreCostThisMonth: rows[0].firestore_cost || 0
        });
    } catch (error) {
        console.error('[Owner] Error fetching cost:', error);
        res.json({
            month, totalCostThisMonth: 0, currency: 'USD',
            note: 'Billing info unavailable: ' + error.message
        });
    }
};

module.exports = { getUsageOverview, getUsageCost };
