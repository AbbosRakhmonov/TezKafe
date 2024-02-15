const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Waiter = require('../models/Waiter');
const Order = require('../models/Order');
const ArchiveOrder = require('../models/ArchiveOrder');
const Table = require('../models/Table');
const {emitEventTo} = require('../listeners/socketManager');

// @desc      Get all waiters
// @route     GET /api/v1/waiters
// @access    Public
exports.getWaiters = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user
    const waiters = await Waiter.find({restaurant});

    res.status(200).json(waiters);
});

// @desc      Get single waiter
// @route     GET /api/v1/waiters/:id
// @access    Public
exports.getWaiter = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user
    const waiter = await Waiter.findOne({_id: req.params.id, restaurant});

    if (!waiter) {
        return next(
            new ErrorResponse(`Waiter not found with id of ${req.params.id}`, 404)
        );
    }

    res.status(200).json(waiter);
});

// @desc      Create new waiter
// @route     POST /api/v1/waiters
// @access    Private
exports.createWaiter = asyncHandler(async (req, res, next) => {
    req.body.restaurant = req.user.restaurant
    const waiter = await Waiter.create(req.body);

    res.status(201).json(waiter);
});

// @desc      Update waiter
// @route     PUT /api/v1/waiters/:id
// @access    Private
exports.updateWaiter = asyncHandler(async (req, res, next) => {
    let waiter = await Waiter.findOne({_id: req.params.id, restaurant: req.user.restaurant});

    if (!waiter) {
        return next(
            new ErrorResponse(`Waiter not found with id of ${req.params.id}`, 404)
        );
    }

    await waiter.updateOne(req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json(waiter);
});

// @desc      Delete waiter
// @route     DELETE /api/v1/waiters/:id
// @access    Private
exports.deleteWaiter = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user
    const waiter = await Waiter.findOne({_id: req.params.id, restaurant});

    if (!waiter) {
        return next(
            new ErrorResponse(`Waiter not found with id of ${req.params.id}`, 404)
        );
    }
    try {
        await Promise.all([
            Order.deleteMany({waiter: req.params.id, restaurant}),
            ArchiveOrder.deleteMany({waiter: req.params.id, restaurant}),
            Table.deleteMany({waiter: req.params.id, restaurant}),
            Waiter.deleteOne({_id: req.params.id, restaurant})
        ]);
    } catch (e) {
        return next(new ErrorResponse(e, 500));
    }

    res.status(200).json({});
});

// @desc      Get waiter's tables
// @route     GET /api/v1/waiter/tables?type=type
// @access    Private
exports.getWaiterTables = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;
    const {type} = req.query;

    if (!type) {
        return next(new ErrorResponse('Please provide a type of table', 400));
    }

    let filter = {
        restaurant,
        typeOfTable: type,
        waiter: id
    }

    const tables = await Table.find(filter)
        .select('name createdAt totalPrice totalItems')

    res.status(200).json(tables);
});

// @desc      Get waiter's orders
// @route     GET /api/v1/waiter/orders?table=table
// @access    Private
exports.getWaiterOrders = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;
    const {table} = req.query;

    const waiterTable = await Table.findOne({
        restaurant,
        waiter: id,
        _id: table
    })
        .populate({
            path: 'totalOrders',
            populate: {
                path: 'items.product',
            }
        })
        .select('totalOrders');

    if (!waiterTable) {
        return res.status(200).json([]);
    }

    res.status(200).json(waiterTable.totalOrders);
});

// @desc      Occupy table
// @route     PUT /api/v1/waiter/tables/:id
// @access    Private
exports.occupyTable = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;

    const table = await Table.findOne({
        restaurant,
        _id: req.params.id
    }).populate('waiter archiveOrders activeOrders totalOrders activePrice activeItems totalPrice totalItems')


    if (!table) {
        return next(new ErrorResponse('Table not found', 404));
    }

    if (table.waiter) {
        return next(new ErrorResponse('Table is already occupied', 400));
    }

    if (table.call === 'accepted' && table.callId !== id) {
        return next(new ErrorResponse('Call is already accepted', 400));
    }

    table.waiter = id;
    table.call = 'none'
    table.callId = null

    await table.save();

    emitEventTo(`table-${table._id}`, 'tableOccupied', {
        _id: table._id,
    });
    emitEventTo(`waiters-${restaurant}`, 'tableOccupied', {
        _id: table._id,
    });

    res.status(200).json(table);
});

// @desc      I am going to the table
// @route     PUT /api/v1/waiter/tables/:id/callback
// @access    Private
exports.goToTable = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;

    const table = await Table.findOne({
        restaurant,
        _id: req.params.id,
        waiter: id
    })

    if (!table) {
        return next(new ErrorResponse('Table not found', 404));
    }

    table.call = 'accepted'

    if (!table.callId) {
        table.callId = id
    }

    table.callTime = new Date()

    await table.save();

    emitEventTo(`table-${table._id}`, 'callAccepted', {
        _id: table._id,
    });
    emitEventTo(`directors-${restaurant}`, 'callAccepted', table);

    res.status(200).json(table);
});

// @desc      Get all waiter's calls
// @route     GET /api/v1/waiter/calls
// @access    Private
exports.getCalls = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;

    // get all calls belongs to the waiter and calls that waiter can accept and calls that without waiter or callId

    const calls = await Table.find({
        restaurant,
        $or: [
            {waiter: id},
            {call: 'accepted', callId: id},
            {call: 'calling', callId: null}
        ]
    }).select('name');

    res.status(200).json(calls);
});

// @desc      Decline call
// @route     DELETE /api/v1/waiter/tables/:id/callback
// @access    Private
exports.declineCall = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;

    const table = await Table.findOne({
        restaurant,
        _id: req.params.id,
        callId: id
    })

    if (!table) {
        return next(new ErrorResponse('Table not found', 404));
    }

    table.call = 'none'
    table.callId = null
    table.callTime = null

    await table.save();

    res.status(200).json(table);
});


