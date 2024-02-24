const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Table = require('../models/Table');
const File = require('../models/File');
const mongoose = require('mongoose');
const {emitEventTo} = require('../listeners/socketManager');

// @desc      Get all categories
// @route     GET /api/v1/categories?restaurant=restaurant
// @access    Public
exports.getCategories = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.query;
    const categories = await Category.find({
        restaurant: new mongoose.Types.ObjectId(restaurant)
    }).populate('products');

    res.status(200).json(categories);
});

// @desc      Get single category
// @route     GET /api/v1/categories/:id
// @access    Public
exports.getCategory = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const category = await Category.findOne({
        restaurant,
        _id: req.params.id
    }).populate('products');

    if (!category) {
        return next(new ErrorResponse(`Category not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json(category);
});

// @desc      Create new category
// @route     POST /api/v1/categories
// @access    Private
exports.createCategory = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const category = await Category.create({
        ...req.body,
        restaurant
    })

    if (req.body.photo && req.body.photo !== 'no-photo.jpg') {
        const newPhoto = await File.findOne({name: req.body.photo});
        if (newPhoto) {
            newPhoto.inuse = true;
            await newPhoto.save()
        }
    } else {
        category.photo = 'no-photo.jpg'
        await category.save()
    }

    emitEventTo(`restaurant-${restaurant}`, 'categoryCreated', category);
    emitEventTo(`waiters-${restaurant}`, 'categoryCreated', category);

    res.status(201).json(category);
});

// @desc      Update category
// @route     PUT /api/v1/categories/:id
// @access    Private
exports.updateCategory = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const category = await Category.findOne({
        restaurant,
        _id: req.params.id
    })

    if (!category) {
        return next(new ErrorResponse(`Category not found with id of ${req.params.id}`, 404));
    }

    const {name, photo} = req.body;

    const result = await Category.findByIdAndUpdate(req.params.id, {
        name,
        photo,
        restaurant
    }, {
        new: true,
        runValidators: true
    })

    if (req.body.photo && req.body.photo !== category.photo && req.body.photo !== 'no-photo.jpg') {
        const newPhoto = await File.findOne({name: req.body.photo})
        if (newPhoto) {
            newPhoto.inuse = true
            await newPhoto.save()
        }
        const oldPhoto = await File.findOne({name: category.photo});
        if (oldPhoto) {
            oldPhoto.inuse = false
            await oldPhoto.save()
        }
    } else if (req.body.photo === null) {
        category.photo = 'no-photo.jpg'
        await category.save()
    }

    emitEventTo(`restaurant-${restaurant}`, 'categoryUpdated', result);
    emitEventTo(`waiters-${restaurant}`, 'categoryUpdated', result);

    res.status(200).json(result);
});

// @desc      Delete category
// @route     DELETE /api/v1/categories/:id
// @access    Private
exports.deleteCategory = asyncHandler(async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {restaurant} = req.user;
        const category = await Category.findOne({
            restaurant,
            _id: req.params.id
        })

        if (!category) {
            return new ErrorResponse(`Category not found with id of ${req.params.id}`, 404);
        }

        // Find all products that reference this category
        const products = await Product.find({category: category._id, restaurant})
        const productIds = products.map(product => product._id);

        const orders = await Order.find({
            items: {
                $elemMatch: {
                    product: {
                        $in: productIds
                    }
                }
            }
        })
        const ordersIds = orders.map(order => order._id);

        const activeOrders = await Table.find({
            $or: [
                {
                    activeOrders: {
                        $in: ordersIds
                    }
                },
                {
                    totalOrders: {
                        $in: ordersIds
                    }
                }
            ],
            restaurant,
            occupied: true
        })

        if (activeOrders.length > 0) {
            return next(new ErrorResponse(`You can't delete this category because the product related to it is used in active orders`, 400));
        }

        // Delete all orders that contain any of these products in their `items` array
        await Order.deleteMany({
            _id: {
                $in: ordersIds
            },
            restaurant
        })
        // Delete all products that reference this category
        await Product.deleteMany({category: category._id})

        await Category.deleteOne(category)

        const photo = await File.findOne({name: category.photo});

        if (photo) {
            photo.inuse = false
            await photo.save({session})
        }

        await session.commitTransaction();

        emitEventTo(`restaurant-${restaurant}`, 'categoryDeleted', {
            _id: req.params.id
        });
        emitEventTo(`waiters-${restaurant}`, 'categoryDeleted', {
            _id: req.params.id
        });

        res.status(200).json({});
    } catch (error) {
        await session.abortTransaction();
        return next(new ErrorResponse(error, 404));
    } finally {
        await session.endSession();
    }
});
