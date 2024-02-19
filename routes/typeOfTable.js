const express = require('express');
const router = express.Router();
const {
    createTypeOfTable,
    deleteTypeOfTable,
    getTypeOfTables,
    updateTypeOfTable
} = require('../controllers/typeOfTable');
const {protect, isDirectorAtRestaurant} = require('../middleware/auth');

router
    .route('/')
    .get(protect, getTypeOfTables)
    .post(protect, isDirectorAtRestaurant, createTypeOfTable);

router.route('/:id')
    .put(protect, isDirectorAtRestaurant, updateTypeOfTable)
    .delete(protect, isDirectorAtRestaurant, deleteTypeOfTable);

module.exports = router;