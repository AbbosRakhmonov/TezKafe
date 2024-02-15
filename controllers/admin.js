const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Admin = require('../models/Admin');
const Director = require('../models/Director');
const Restaurant = require('../models/Restaurant');
const Waiter = require('../models/Waiter');
const Table = require('../models/Table');
const Order = require('../models/Order');
const Category = require('../models/Category');
const TypeOfTable = require('../models/TypeOfTable');
const ArchiveOrder = require('../models/ArchiveOrder');
const Product = require('../models/Product');
const File = require('../models/File');

const mongoose = require('mongoose');

const sendWithCookie = (res, token) => {
    res
        .status(200)
        .cookie('tezkafe_token', token, {
            httpOnly: true,
            maxAge: 2 * 24 * 60 * 60 * 1000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
        })
        .json(token);
};

// @desc      Register admin
// @route     POST /api/v1/auth/admin/register
// @access    Private
exports.register = asyncHandler(async (req, res, next) => {
    try {
        const {secretKey} = req.body;
        // Create admin
        if (secretKey !== process.env.SECRET_KEY) {
            return next(new ErrorResponse('Secret key is wrong', 400));
        }

        const admin = await Admin.create(req.body);

        let token = admin.getSignedJwtToken();
        // send token in cookie and user as json
        sendWithCookie(res, token);
    } catch (err) {
        return next(new ErrorResponse(err, 500));
    }
});

// @desc      Login admin
// @route     POST /api/v1/auth/admin/login
// @access    Private
exports.login = asyncHandler(async (req, res, next) => {
    const {login, password} = req.body;

    // Validate email & password
    if (!login || !password) {
        return next(new ErrorResponse('Please provide an email and password', 400));
    }

    // Check for admin
    const admin = await Admin.findOne({login}).select('+password');

    if (!admin) {
        return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
        return next(new ErrorResponse('Invalid credentials', 401));
    }

    let token = admin.getSignedJwtToken();
    // send token in cookie and user as json
    sendWithCookie(res, token);
});

// @desc      Get current logged in admin
// @route     GET /api/v1/auth/admin/me
// @access    Private
exports.getMe = asyncHandler(async (req, res, next) => {
    const admin = await Admin.findById(req.user.id);

    res.status(200).json({
        success: true,
        data: admin,
    });
});

// @desc      Log admin out / clear cookie
// @route     GET /api/v1/auth/admin/logout
// @access    Private
exports.logout = asyncHandler(async (req, res, next) => {
    res
        .status(200)
        .cookie('cdlToken', 'none', {
            httpOnly: true,
            expires: new Date(0),
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
        })
        .json('Logged out successfully');
});

// @desc      Register restaurant
// @route     POST /api/v1/restaurants
// @access    Private
exports.registerRestaurant = asyncHandler(async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {photo, name, address, location, director} = req.body;
        const restaurant = await Restaurant.create([{photo, name, address, location}], {session});
        director.restaurant = restaurant[0]._id;
        await Director.create([{...director}], {session});
        await session.commitTransaction();
        const restaurantWithDirector = await Restaurant.findById(restaurant[0]._id).populate('director');

        if (req.body.photo && req.body.photo !== restaurantWithDirector.photo) {
            await File.findOneAndUpdate({name: req.body.photo}, {inuse: true});
            const oldFile = await File.findOne({name: restaurantWithDirector.photo});
            if (oldFile) {
                oldFile.inuse = false;
                await oldFile.save();
            }
        } else if (req.body.avatar === null) {
            restaurantWithDirector.photo = 'no-photo.jpg'
            await restaurantWithDirector.save()
        }
        res.status(201).json(restaurantWithDirector);
    } catch (error) {
        await session.abortTransaction();
        return next(new ErrorResponse(error, 500));
    } finally {
        await session.endSession();
    }
});

// @desc      Get all restaurants
// @route     GET /api/v1/restaurants
// @access    Private
exports.getRestaurants = asyncHandler(async (req, res, next) => {
    const restaurants = await Restaurant.find()
        .populate('waiters director tables orders categories typeOfTables archiveOrders products');

    res.status(200).json(restaurants);
});

// @desc      Get single restaurant
// @route     GET /api/v1/restaurants/:id
// @access    Private
exports.getRestaurant = asyncHandler(async (req, res, next) => {
    const restaurant = await Restaurant.findById(req.params.id)
        .populate('waiters director tables orders categories typeOfTables archiveOrders products');

    if (!restaurant) {
        return next(new ErrorResponse(`Restaurant not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json(restaurant);
});

// @desc      Update restaurant
// @route     PUT /api/v1/restaurants/:id
// @access    Private
exports.updateRestaurant = asyncHandler(async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {director, ...rest} = req.body;
        let restaurant = await Restaurant.findById(req.params.id).session(session);
        if (!restaurant) {
            return next(new ErrorResponse(`Restaurant not found with id of ${req.params.id}`, 404));
        }
        if (director) {
            let directorDoc = await Director.findById(director._id).session(session);
            if (!directorDoc) {
                return next(new ErrorResponse(`Director not found`, 404));
            }
            await Director.findByIdAndUpdate(director._id, {
                ...director,
                restaurant: restaurant._id
            }, {
                new: true,
                runValidators: true,
                session
            });
        }
        restaurant = await Restaurant.findByIdAndUpdate(req.params.id, rest, {
            new: true,
            runValidators: true,
            session
        });
        await session.commitTransaction();
        if (req.body.photo && req.body.photo !== restaurant.photo) {
            await File.findOneAndUpdate({name: req.body.photo}, {inuse: true});
            const oldFile = await File.findOne({name: restaurant.photo});
            if (oldFile) {
                oldFile.inuse = false;
                await oldFile.save();
            }
        } else if (req.body.avatar === null) {
            restaurant.photo = 'no-photo.jpg'
            await restaurant.save()
        }
        res.status(200).json(restaurant);
    } catch (error) {
        await session.abortTransaction();
        return next(new ErrorResponse(error, 500));
    } finally {
        await session.endSession();
    }
});

// @desc      Delete restaurant
// @route     DELETE /api/v1/restaurants/:id
// @access    Private
exports.deleteRestaurant = asyncHandler(async (req, res, next) => {
    const restaurant = await Restaurant.findById(req.params.id)

    if (!restaurant) {
        return next(new ErrorResponse(`Restaurant not found with id of ${req.params.id}`, 404));
    }

    await Promise.all([
        Director.deleteMany({restaurant: restaurant._id}),
        Waiter.deleteMany({restaurant: restaurant._id}),
        Table.deleteMany({restaurant: restaurant._id}),
        Order.deleteMany({restaurant: restaurant._id}),
        Category.deleteMany({restaurant: restaurant._id}),
        TypeOfTable.deleteMany({restaurant: restaurant._id}),
        ArchiveOrder.deleteMany({restaurant: restaurant._id}),
        Product.deleteMany({restaurant: restaurant._id}),
    ])

    await File.findOneAndUpdate({name: restaurant.photo}, {inuse: false});

    await Restaurant.deleteOne(restaurant)

    res.status(200).json({});
});