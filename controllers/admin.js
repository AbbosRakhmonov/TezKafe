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
const ActiveOrder = require('../models/ActiveOrder');

const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");

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

        const admin = await Admin.create({
            ...req.body,
            photo: 'no-photo.jpg'
        });

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
        return next(new ErrorResponse('Please provide an login and password', 400));
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
        if (!director) {
            return next(new ErrorResponse('Please provide director', 400))
        }
        const waiter = await Waiter.findOne({phone: director.phone});
        if (waiter) {
            return next(new ErrorResponse('The phone number is already in use', 400))
        }
        const restaurant = await Restaurant.create([{photo, name, address, location}], {session});
        if (req.body.photo && req.body.photo !== 'no-photo.jpg') {
            const newPhoto = await File.findOne({name: req.body.photo});
            if (newPhoto) {
                newPhoto.inuse = true;
                await newPhoto.save({session});
            }
        } else if (req.body.photo === null) {
            restaurant.photo = 'no-photo.jpg'
            await restaurant.save({session})
        }
        director.restaurant = restaurant[0]._id;
        let [newDirector] = await Director.create([{...director}], {session})
        if (director.avatar && director.avatar !== 'no-photo.jpg') {
            const newPhoto = await File.findOne({name: director.avatar});
            if (newPhoto) {
                newPhoto.inuse = true;
                await newPhoto.save({session});
            }
        } else if (director.avatar === null) {
            newDirector.avatar = 'no-photo.jpg'
            await newDirector.save({session})
        }
        await session.commitTransaction();
        const restaurantWithDirector = await Restaurant.findById(restaurant[0]._id).populate('director');

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
        let restaurant = await Restaurant.findById(req.params.id)
        if (!restaurant) {
            return next(new ErrorResponse(`Restaurant not found with id of ${req.params.id}`, 404));
        }
        const updatedRestaurant = await Restaurant.findByIdAndUpdate(req.params.id, rest, {
            new: true,
            runValidators: true,
            session
        });
        if (req.body.photo && req.body.photo !== restaurant.photo && req.body.photo !== 'no-photo.jpg') {
            const newPhoto = await File.findOne({name: req.body.photo});
            if (newPhoto) {
                newPhoto.inuse = true;
                await newPhoto.save({session});
            }
            const oldFile = await File.findOne({name: restaurant.photo});
            if (oldFile) {
                oldFile.inuse = false;
                await oldFile.save({session});
            }
        } else if (req.body.photo === null) {
            updatedRestaurant.photo = 'no-photo.jpg'
            await updatedRestaurant.save({session})
        }
        if (director) {
            let directorDoc = await Director.findOne({restaurant: restaurant._id})
            if (!directorDoc) {
                return next(new ErrorResponse(`Director not found`, 404));
            }
            if (director.password) {
                const salt = await bcrypt.genSalt(10);
                director.password = await bcrypt.hash(director.password, salt);
            }
            const newGenDirector = await Director.findByIdAndUpdate(director._id, {
                ...director,
                restaurant: restaurant._id
            }, {
                new: true,
                runValidators: true,
                session
            });
            if (director.avatar && director.avatar !== directorDoc.avatar && director.avatar !== 'no-photo.jpg') {
                const newPhoto = await File.findOne({name: director.avatar});
                if (newPhoto) {
                    newPhoto.inuse = true;
                    await newPhoto.save({session});
                }
                const oldFile = await File.findOne({name: directorDoc.avatar});
                if (oldFile) {
                    oldFile.inuse = false;
                    await oldFile.save({session});
                }
            } else if (director.avatar === null) {
                newGenDirector.avatar = 'no-photo.jpg'
                await newGenDirector.save()
            }
        }
        await session.commitTransaction();

        const restaurantWithDirector = await Restaurant.findById(updatedRestaurant._id).populate('director');

        res.status(200).json(restaurantWithDirector);
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
    const restaurant = await Restaurant.findById(req.params.id).populate('director');

    if (!restaurant) {
        return next(new ErrorResponse(`Restaurant not found with id of ${req.params.id}`, 404));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await ActiveOrder.deleteMany({restaurant: req.params.id}, {session});
        await ArchiveOrder.deleteMany({restaurant: req.params.id}, {session});
        await Order.deleteMany({restaurant: req.params.id}, {session});
        await Table.deleteMany({restaurant: req.params.id}, {session});
        await Waiter.deleteMany({restaurant: req.params.id}, {session});
        await Category.deleteMany({restaurant: req.params.id}, {session});
        await TypeOfTable.deleteMany({restaurant: req.params.id}, {session});
        await Product.deleteMany({restaurant: req.params.id}, {session});
        await Director.deleteOne({restaurant: req.params.id}, {session});
        const photo = await File.findOne({name: restaurant.photo});
        if (photo) {
            photo.inuse = false;
            await photo.save({session});
        }
        const directorPhoto = await File.findOne({name: restaurant.director.avatar});
        if (directorPhoto) {
            directorPhoto.inuse = false;
            await directorPhoto.save({session});
        }
        await Restaurant.deleteOne({_id: req.params.id}, {session});

        await session.commitTransaction();

        res.status(200).json({});
    } catch (error) {
        await session.abortTransaction();
        return next(new ErrorResponse(error, 500));
    } finally {
        await session.endSession();
    }

    res.status(200).json({});
});