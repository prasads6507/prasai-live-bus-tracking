const express = require('express');
const router = express.Router();
const { loginUser, getMe, registerOwner, googleLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', loginUser);
router.post('/register-owner', registerOwner);
router.post('/google-login', googleLogin);
router.get('/me', protect, getMe);

module.exports = router;
