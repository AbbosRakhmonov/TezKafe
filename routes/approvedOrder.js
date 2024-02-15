const express = require('express');
const router = express.Router();
const {
    getApprovedOrder,
    updateApprovedOrder,
    deleteApprovedOrder,
} = require('../controllers/order');
const {isWaiterAtRestaurant, isDirectorOrWaiterAtRestaurant, protect} = require('../middleware/auth');

router
    .route('/')
    .get(protect, isDirectorOrWaiterAtRestaurant, getApprovedOrder)

router
    .route('/:id')
    .put(protect, isWaiterAtRestaurant, updateApprovedOrder)
    .delete(protect, isWaiterAtRestaurant, deleteApprovedOrder)

module.exports = router;