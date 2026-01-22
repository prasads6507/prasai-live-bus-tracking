const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadRoutesFile, downloadTemplate } = require('../controllers/bulkRouteController');
const { protect, authorize } = require('../middleware/auth');
const tenantIsolation = require('../middleware/tenantIsolation');

// Configure multer for file upload (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only Excel and CSV files
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv' // .csv
        ];

        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
        }
    }
});

// All routes protected + college admin/owner + tenant isolation
router.use(protect);
router.use(authorize('COLLEGE_ADMIN', 'OWNER', 'SUPER_ADMIN'));
router.use(tenantIsolation);

// Bulk upload route
router.post('/bulk-upload', upload.single('file'), uploadRoutesFile);

// Download template
router.get('/template', downloadTemplate);

module.exports = router;
