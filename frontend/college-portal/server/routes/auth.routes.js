const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', authController.loginUser);
router.post('/register-owner', authController.registerOwner);
router.post('/google-login', authController.googleLogin);
router.get('/college/:slug', authController.getCollegeBySlug);
router.get('/colleges/search', authController.searchColleges);
router.get('/me', protect, authController.getMe);

module.exports = router;
