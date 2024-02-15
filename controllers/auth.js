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

    if (role === 'director') {
        user = await Director.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        })
    } else {
        user = await Waiter.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        })
    }

    if (!user) {
        return next(new ErrorResponse('User not found', 404));
    }

    if (req.body.avatar && req.body.avatar !== user.avatar) {
        const file = await File.findOneAndUpdate({name: req.body.avatar}, {inuse: true});
        if (!file) {
            return next(new ErrorResponse('File not found', 404));
        }
        const oldFile = await File.findOne({name: user.avatar});
        if (oldFile) {
            oldFile.inuse = false;
            await oldFile.save();
        }
    } else if (req.body.avatar === null) {
        user.avatar = 'no-photo.jpg'
        await user.save()
    }

    res.status(200).json(user);
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

    // const salt = await bcrypt.genSalt(10);
    // user.password = await bcrypt.hash(req.body.newPassword, salt);

    await user.save();

    let token = user.getSignedJwtToken();
    sendWithCookie(res, token);
});