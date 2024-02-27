const {promisify, log} = require("util");
const jwt = require("jsonwebtoken");
const asyncHandler = require("./async");
const ErrorResponse = require("../utils/errorResponse");
const Waiter = require("../models/Waiter");
const mongoose = require("mongoose");

const validateToken = async (token) => {
    if (!token) {
        throw new ErrorResponse("Token not found!", 401);
    }

    try {
        return await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    } catch (e) {
        throw new ErrorResponse("Token not valid!", 401);
    }
}

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
    const token = req.cookies.tezkafe_token || req.headers.authorization?.split(' ')[1];
    try {
        req.user = await validateToken(token)
        next();
    } catch (err) {
        return next(err);
    }
});
// optional protect
exports.optionalProtect = asyncHandler(async (req, res, next) => {
    const token = req.cookies.tezkafe_token || req.headers.authorization.split(' ')[1];
    try {
        req.user = await validateToken(token)
    } catch (err) {
        req.user = null
    }
    next();
});
// Restrict access to certain roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (roles.includes(req.user.role)) {
            return next(
                new ErrorResponse(
                    `User role ${req.user.role} is not authorized to access this route`,
                    403,
                ),
            );
        }
        next();
    };
};
// Check if the authenticated user is the director of the restaurant
exports.isDirectorAtRestaurant = asyncHandler(async (req, res, next) => {
    if (req.user.role !== 'admin') {
        const {restaurant: restaurantId} = req.user
        if (!restaurantId) {
            return next(
                new ErrorResponse(`Please provide a restaurant id`, 400),
            );
        }
        const restaurant = await Restaurant.findById(restaurantId).populate('director');
        if (!restaurant) {
            return next(
                new ErrorResponse(`Restaurant not found with id of ${restaurantId}`, 404),
            );
        }
        if (!restaurant.director._id.equals(req.user.id)) {
            return next(
                new ErrorResponse(
                    `User ${req.user.id} is not authorized to access this route`,
                    403,
                ),
            );
        }
    } else {
        const {restaurant: restaurantId} = req.query
        if (!restaurantId) {
            return next(
                new ErrorResponse(`Please provide a restaurant id`, 400),
            );
        }
        const restaurant = await Restaurant.findById(restaurantId)
        if (!restaurant) {
            return next(
                new ErrorResponse(`Restaurant not found with id of ${restaurantId}`, 404),
            );
        }
        req.user.restaurant = restaurantId
    }

    next();
});
// Check if the authenticated user is the waiter of the restaurant
exports.isWaiterAtRestaurant = asyncHandler(async (req, res, next) => {
    if (req.user.role !== 'admin') {
        const {restaurant} = req.user
        if (!restaurant) {
            return next(
                new ErrorResponse(`Please provide a restaurant id`, 400),
            );
        }
        const waiter = await Waiter.findOne({
            _id: new mongoose.Types.ObjectId(req.user.id),
            restaurant: new mongoose.Types.ObjectId(restaurant)
        });
        if (!waiter) {
            return next(
                new ErrorResponse(
                    `User ${req.user.id} is not authorized to access this route`,
                    403,
                ),
            );
        }
    } else {
        const {restaurant: restaurantId} = req.query
        if (!restaurantId) {
            return next(
                new ErrorResponse(`Please provide a restaurant id`, 400),
            );
        }
        const restaurant = await Restaurant.findById(restaurantId)
        if (!restaurant) {
            return next(
                new ErrorResponse(`Restaurant not found with id of ${restaurantId}`, 404),
            );
        }
        req.user.restaurant = restaurantId
    }

    next();
})
;
// Check if the authenticated user is the director or a waiter of the restaurant
exports.isDirectorOrWaiterAtRestaurant = asyncHandler(async (req, res, next) => {
    if (req.user.role !== 'admin') {
        const {restaurant: restaurantId} = req.user
        if (!restaurantId) {
            return next(
                new ErrorResponse(`Please provide a restaurant id`, 400),
            );
        }
        const restaurant = await Restaurant.findById(restaurantId)
            .populate('waiters director');
        if (!restaurant) {
            return next(
                new ErrorResponse(`Restaurant not found with id of ${restaurantId}`, 404),
            );
        }
        const isUserDirector = restaurant.director._id.equals(req.user.id);
        const isUserWaiter = restaurant.waiters.some(waiter => waiter._id.equals(req.user.id));
        if (!isUserDirector && !isUserWaiter) {
            return next(
                new ErrorResponse(
                    `User ${req.user.id} is not authorized to access this route`,
                    403,
                ),
            );
        }
    } else {
        const {restaurant: restaurantId} = req.query
        if (!restaurantId) {
            return next(
                new ErrorResponse(`Please provide a restaurant id`, 400),
            );
        }
        const restaurant = await Restaurant.findById(restaurantId)
        if (!restaurant) {
            return next(
                new ErrorResponse(`Restaurant not found with id of ${restaurantId}`, 404),
            );
        }
        req.user.restaurant = restaurantId
    }
    next();
});
// Socket middleware
exports.socketMiddleware = async (socket, next) => {
    // check cors origin
    let token = socket.handshake.query.token;
    let restaurant = socket.handshake.query.restaurant;
    let table = socket.handshake.query.table;
    if (token) {
        try {
            socket.user = await promisify(jwt.verify)(
                token,
                process.env.JWT_SECRET,
            );
        } catch (err) {
            console.log(err);
        }
    }
    if (restaurant && table) {
        socket.restaurant = restaurant
        socket.table = table
        next();
    }
    next(new ErrorResponse("Stranger", 401));
};
