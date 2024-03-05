const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Director = require('../models/Director');
const Waiter = require('../models/Waiter');
const File = require('../models/File');

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

// @desc      Login Everyone
// @route     POST /api/v1/auth/login
// @access    Private
exports.login = asyncHandler(async (req, res, next) => {
    const {phone, password} = req.body;

    // Validate email & password
    if (!phone || !password) {
        return next(new ErrorResponse('Please provide an phone and password', 400));
    }

    // Check for admin
    let user = await Director.findOne({phone}).select('+password');
    if (!user) {
        let waiter = await Waiter.findOne({phone}).select('+password');
        if (!waiter) {
            return next(new ErrorResponse('No user found', 401));
        }
        user = waiter;
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        return next(new ErrorResponse('Phone or Password is wrong', 401));
    }

    let token = user.getSignedJwtToken();
    sendWithCookie(res, token);
});

// @desc      Logout Everyone
// @route     GET /api/v1/auth/logout
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

// @desc      Get current logged in user
// @route     GET /api/v1/auth/me
// @access    Private
exports.getMe = asyncHandler(async (req, res, next) => {
    let user = await Director.findById(req.user.id)
    if (!user) {
        user = await Waiter.findById(req.user.id)
    }
    res.status(200).json(user);
});

// @desc      Update user details
// @route     PUT /api/v1/auth/me
// @access    Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
    const {id, role} = req.user
    let user;
    let newUser;

    const {password, ...body} = req.body;

    if (role === 'director') {
        user = await Director.findOne({id})
        newUser = await Director.findOneAndUpdate({id}, body, {
            new: true,
            runValidators: true
        })
    } else {
        user = await Waiter.findOne({id})
        newUser = await Waiter.findOneAndUpdate({id}, body, {
            new: true,
            runValidators: true
        })
    }

    if (!user) {
        return next(new ErrorResponse('User not found', 404));
    }


    if (body.avatar && body.avatar !== user.avatar && body.avatar !== 'no-photo.jpg') {
        const newPhoto = await File.findOne({name: body.avatar})
        if (newPhoto) {
            newPhoto.inuse = true
            await newPhoto.save()
        }
        const oldPhoto = await File.findOne({name: user.avatar})
        if (oldPhoto) {
            oldPhoto.inuse = false
            await oldPhoto.save()
        }
    } else if (body.avatar === null) {
        newUser.avatar = 'no-photo.jpg'
        await newUser.save()
    }

    res.status(200).json(newUser);
});

// @desc      Update password
// @route     PUT /api/v1/auth/password
// @access    Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
    let user = await Director.findById(req.user.id) || await Waiter.findById(req.user.id);

    if (!user) {
        return next(new ErrorResponse('User not found', 404));
    }

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
        return next(new ErrorResponse('Password is incorrect', 400));
    }

    user.password = req.body.newPassword

    await user.save();

    let token = user.getSignedJwtToken();
    sendWithCookie(res, token);
});