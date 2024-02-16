const express = require('express');
const router = express.Router();
const {
    createWaiter,
    deleteWaiter,
    getWaiter,
    getWaiterOrders,
    getWaiters,
    getWaiterTables,
    occupyTable,
    updateWaiter,
    declineCall,
    getCalls,
    goToTable
} = require('../controllers/waiter');

const {protect, isWaiterAtRestaurant, isDirectorAtRestaurant} = require('../middleware/auth');

router.route('/')
    .get(protect, isDirectorAtRestaurant, getWaiters)
    .post(protect, isDirectorAtRestaurant, createWaiter);

router
    .route('/:id')
    .get(protect, isDirectorAtRestaurant, getWaiter)
    .put(protect, isDirectorAtRestaurant, updateWaiter)
    .delete(protect, isDirectorAtRestaurant, deleteWaiter);

// /?table=tableId
router
    .route('/orders')
    .get(protect, isWaiterAtRestaurant, getWaiterOrders);

// /?type=type&occupied=occupied
router
    .route('/tables')
    .get(protect, isWaiterAtRestaurant, getWaiterTables)
    .post(protect, isWaiterAtRestaurant, occupyTable);

router
    .route('/tables/:id/callback')
    .put(protect, isWaiterAtRestaurant, goToTable)
    .delete(protect, isWaiterAtRestaurant, declineCall)

router
    .route('/tables/calls')
    .get(protect, isWaiterAtRestaurant, getCalls);

module.exports = router;