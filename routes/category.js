const express = require('express');
const router = express.Router();
const {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../controllers/category');

const {protect, isDirectorAtRestaurant} = require('../middleware/auth');

router
    .route('/')
    .get(getCategories)
    .post(protect, isDirectorAtRestaurant, createCategory);

router
    .route('/:id')
    .get(getCategory)
    .put(protect, isDirectorAtRestaurant, updateCategory)
    .delete(protect, isDirectorAtRestaurant, deleteCategory);

module.exports = router;