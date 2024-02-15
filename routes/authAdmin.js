const express = require('express');
const router = express.Router();
const {
    register,
    getMe,
    login,
    logout,
} = require('../controllers/admin');
const {protect, authorize} = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/logout', protect, logout);
router.get('/me', protect, authorize(['admin']), getMe);

module.exports = router;