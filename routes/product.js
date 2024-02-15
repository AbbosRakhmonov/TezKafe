const express = require('express');
const router = express.Router();
const {
    createProduct,
    deleteProduct,
    getProduct,
    getProducts,
    updateProduct
} = require('../controllers/product');

const {isDirectorAtRestaurant, protect} = require('../middleware/auth');

router.route('/')
    .get(getProducts)
    .post(protect, isDirectorAtRestaurant, createProduct);

router.route('/:id')
    .get(getProduct)
    .put(protect, isDirectorAtRestaurant, updateProduct)
    .delete(protect, isDirectorAtRestaurant, deleteProduct);

module.exports = router;

