const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Table = require('../models/Table');
const File = require('../models/File');
const {emitEventTo} = require('../listeners/socketManager');

// @desc      Get all products
// @route     GET /api/v1/products?restaurant=restaurant&category=category&available=available
// @access    Public
exports.getProducts = asyncHandler(async (req, res, next) => {
    const {restaurant, category, available} = req.query
    let filter = {
        restaurant,
        category
    }

    if (available) {
        filter.available = JSON.parse(available)
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

    if (req.body.photo && req.body.photo !== product.photo) {
        await File.findOneAndUpdate({name: req.body.photo}, {inuse: true});
        const oldFile = await File.findOne({name: product.photo});
        if (oldFile) {
            oldFile.inuse = false;
            await oldFile.save();
        }
    } else if (req.body.avatar === null) {
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

    const orders = await Order.find({
        restaurant,
        items: {
            $elemMatch: {
                product: req.params.id
            }
        }
    });

    const ordersIds = orders.map(order => order._id);

    const activeOrders = await Table.find({
        restaurant,
        occupied: true,
        $or: [
            {activeOrders: {$in: ordersIds}},
            {totalOrders: {$in: ordersIds}}
        ]
    });

    if (activeOrders.length > 0) {
        return next(new ErrorResponse(`You are not allowed to update a product that is in an active order`, 400));
    }

    await product.updateOne({
        ...req.body,
        restaurant
    }, {
        new: true,
        runValidators: true
    })

    if (req.body.photo && req.body.photo !== product.photo) {
        await File.findOneAndUpdate({name: req.body.photo}, {inuse: true});
        const oldFile = await File.findOne({name: product.photo});
        if (oldFile) {
            oldFile.inuse = false;
            await oldFile.save();
        }
    } else if (req.body.avatar === null) {
        product.photo = 'no-photo.jpg'
        await product.save()
    }

    emitEventTo(`restaurant-${restaurant}`, 'updateProduct', product);
    emitEventTo(`waiters-${restaurant}`, 'updateProduct', product);

    res.status(200).json(product);
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

    const orders = await Order.find({
        restaurant,
        items: {
            $elemMatch: {
                product: req.params.id
            }
        }
    });

    const ordersIds = orders.map(order => order._id);

    const activeOrders = await Table.find({
        restaurant,
        occupied: true,
        $or: [
            {activeOrders: {$in: ordersIds}},
            {totalOrders: {$in: ordersIds}}
        ]
    });

    if (activeOrders.length > 0) {
        return next(new ErrorResponse(`You are not allowed to delete a product that is in an active order`, 400));
    }

    await Order.deleteMany({
        _id: {
            $in: ordersIds
        }
    });

    await Product.deleteOne(product)

    await File.findOneAndUpdate({name: product.photo}, {inuse: false});

    emitEventTo(`restaurant-${restaurant}`, 'deleteProduct', {
        _id: req.params.id
    });
    emitEventTo(`waiters-${restaurant}`, 'deleteProduct', {
        _id: req.params.id
    });

    res.status(200).json({});
});