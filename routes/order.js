const express = require('express');
const router = express.Router();
const {
    approveOrder,
    createOrder,
    deleteOrder,
    getOrders,
    updateOrder
} = require('../controllers/order');
const {isWaiterAtRestaurant, isDirectorOrWaiterAtRestaurant, protect} = require('../middleware/auth');

router
    .route('/')
    .get(protect, isDirectorOrWaiterAtRestaurant, getOrders)
    .post(protect, isWaiterAtRestaurant, createOrder);

router
    .route('/:id')
    .put(protect, isWaiterAtRestaurant, updateOrder)
    .delete(protect, isWaiterAtRestaurant, deleteOrder)
    .post(protect, isWaiterAtRestaurant, approveOrder);

module.exports = router;