const express = require('express');
const router = express.Router();
const {
    addProductToBasket,
    clearBasket,
    getClientOrders,
    makeOrder,
    removeProductFromBasket,
    updateProductInBasket,
    getBasket
} = require('../controllers/client');

router
    .route('/orders')
    .get(getClientOrders)
    .post(makeOrder);

router
    .route('/basket')
    .get(getBasket)
    .post(addProductToBasket)
    .delete(clearBasket)

router
    .route('/basket/:id')
    .put(updateProductInBasket)
    .delete(removeProductFromBasket);

module.exports = router;
