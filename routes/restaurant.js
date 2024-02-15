const express = require('express');
const router = express.Router();
const {
    getRestaurants,
    deleteRestaurant,
    getRestaurant,
    updateRestaurant,
    registerRestaurant
} = require('../controllers/admin');
const {protect, authorize} = require('../middleware/auth');

router.route('/')
    .get(protect, authorize(['admin']), getRestaurants)
    .post(protect, authorize(['admin']), registerRestaurant);

router.route('/:id')
    .get(protect, authorize(['admin', 'director']), getRestaurant)
    .put(protect, authorize(['admin']), updateRestaurant)
    .delete(protect, authorize(['admin']), deleteRestaurant);

module.exports = router;
