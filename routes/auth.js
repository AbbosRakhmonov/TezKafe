const express = require('express');
const router = express.Router();
const {
    updatePassword,
    updateDetails,
    logout,
    login,
    getMe
} = require('../controllers/auth');
const {protect, authorize} = require('../middleware/auth');

router.post('/login', login);
router.get('/me', protect, authorize(['director', 'waiter']), getMe);
router.put('/me', protect, authorize(['director', 'waiter']), updateDetails);
router.put('/password', protect, authorize('director', 'waiter'), updatePassword);
router.get('/logout', protect, authorize('director', 'waiter'), logout);

module.exports = router;
