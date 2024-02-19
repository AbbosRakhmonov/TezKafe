const express = require('express');
const router = express.Router();
const {
    createTable,
    deleteTable,
    getTables,
    setCodeToTable,
    updateTable,
    closeTable,
    getTable,
    callWaiter,
    loginToTable
} = require('../controllers/table');
const {protect, isDirectorAtRestaurant, isDirectorOrWaiterAtRestaurant} = require('../middleware/auth');


router.route('/')
    .get(protect, isDirectorOrWaiterAtRestaurant, getTables)
    .post(protect, isDirectorAtRestaurant, createTable);

router.route('/:id')
    .get(protect, getTable)
    .post(protect, isDirectorOrWaiterAtRestaurant, closeTable)
    .put(protect, isDirectorAtRestaurant, updateTable)
    .delete(protect, isDirectorAtRestaurant, deleteTable);

router.route('/code/:id')
    .post(loginToTable)
    .put(setCodeToTable);

router.route('/call/:id')
    .post(callWaiter);


module.exports = router;

