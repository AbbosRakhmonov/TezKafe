const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Table = require('../models/Table');
const ActiveOrder = require('../models/ActiveOrder');
const File = require('../models/File');
const {emitEventTo} = require('../listeners/socketManager');
const {mongo} = require('mongoose');
const mongoose = require('mongoose');

// @desc      Get all products
// @route     GET /api/v1/products?restaurant=restaurant&category=category&available=available
// @access    Public
exports.getProducts = asyncHandler(async (req, res, next) => {
    const {restaurant, category, available} = req.query

    let filter = {
        restaurant,
    }

    if (available) {
        filter.available = JSON.parse(available)
    }

    if (category) {
        filter.category = category
    }

    const products = await Product.find(filter);

    res.status(200).json(products);
});

// @desc      Get single product
// @route     GET /api/v1/products/:id?restaurant=restaurant
// @access    Public
exports.getProduct = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.query
    const product = await Product.findOne({
        restaurant,
        _id: req.params.id
    });

    if (!product) {
        return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json(product);
});

// @desc      Create new product
// @route     POST /api/v1/products
// @access    Private
exports.createProduct = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const product = await Product.create({
        ...req.body,
        restaurant
    })

    if (req.body.photo && req.body.photo !== 'no-photo.jpg') {
        const photo = await File.findOne({name: req.body.photo});
        if (photo) {
            photo.inuse = true;
            await photo.save();
        }
    } else {
        product.photo = 'no-photo.jpg'
        await product.save()
    }

    emitEventTo(`restaurant-${restaurant}`, 'newProduct', product);
    emitEventTo(`waiters-${restaurant}`, 'newProduct', product);

    res.status(201).json(product);
});

// @desc      Update product
// @route     PUT /api/v1/products/:id
// @access    Private
exports.updateProduct = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const product = await Product.findOne({
        restaurant,
        _id: req.params.id
    })

    if (!product) {
        return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
    }

    // Check if the product is in an active order or orders
    const orders = await Order.find({
        restaurant,
        products: {
            $elemMatch: {
                product: req.params.id
            }
        }
    });

    if (orders.length > 0) {
        return next(new ErrorResponse(`The product is in an order`, 400));
    }

    const activeOrders = await ActiveOrder.find({
        restaurant,
        products: {
            $elemMatch: {
                product: req.params.id
            }
        }
    });

    if (activeOrders.length > 0) {
        return next(new ErrorResponse(`The product is in an active order`, 400));
    }

    let updateProduct = await product.updateOne({
        ...req.body,
        restaurant
    }, {
        new: true,
        runValidators: true
    })

    if (req.body.photo && req.body.photo !== product.photo && req.body.photo !== 'no-photo.jpg') {
        const photo = await File.findOne({name: req.body.photo});
        if (photo) {
            photo.inuse = true;
            await photo.save();
        }
        const oldPhoto = await File.findOne({name: product.photo});
        if (oldPhoto) {
            oldPhoto.inuse = false;
            await oldPhoto.save();
        }
    } else if (req.body.avatar === null) {
        updateProduct.photo = 'no-photo.jpg'
        await updateProduct.save()
    }

    emitEventTo(`restaurant-${restaurant}`, 'updateProduct', updateProduct);
    emitEventTo(`waiters-${restaurant}`, 'updateProduct', updateProduct);

    res.status(200).json(updateProduct);
});

// @desc      Delete product
// @route     DELETE /api/v1/products/:id
// @access    Private
exports.deleteProduct = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const product = await Product.findOne({
        restaurant,
        _id: req.params.id
    });

    if (!product) {
        return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
    }

    // Check if the product is in an active order or orders
    const orders = await Order.find({
        restaurant,
        products: {
            $elemMatch: {
                product: req.params.id
            }
        }
    });

    if (orders.length > 0) {
        return next(new ErrorResponse(`The product is in an order`, 400));
    }

    const activeOrders = await ActiveOrder.find({
        restaurant,
        products: {
            $elemMatch: {
                product: req.params.id
            }
        }
    });

    if (activeOrders.length > 0) {
        return next(new ErrorResponse(`The product is in an active order`, 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await Product.deleteOne({
            _id: req.params.id
        }, {
            session
        });

        if (product.photo && product.photo !== 'no-photo.jpg') {
            const photo = await File.findOne({name: product.photo});
            if (photo) {
                photo.inuse = false;
                await photo.save({session});
            }
        }

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        return next(new ErrorResponse(`Error deleting the product with id of ${req.params.id}`, 500));
    } finally {
        await session.endSession();
    }

    emitEventTo(`restaurant-${restaurant}`, 'deleteProduct', {
        _id: req.params.id
    });
    emitEventTo(`waiters-${restaurant}`, 'deleteProduct', {
        _id: req.params.id
    });

    res.status(200).json({});
});