const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Waiter = require('../models/Waiter');
const Order = require('../models/Order');
const ArchiveOrder = require('../models/ArchiveOrder');
const Table = require('../models/Table');
const Director = require('../models/Director');
const {emitEventTo} = require('../listeners/socketManager');
const mongoose = require("mongoose");

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
    const {phone} = req.body;
    if (!phone) {
        return next(new ErrorResponse('Please provide phone', 400))
    }
    const directorWithPhone = await Director.findOne({phone});
    if (directorWithPhone) {
        return next(new ErrorResponse('The phone number is already in use', 400))
    }
    req.body.restaurant = req.user.restaurant
    await Waiter.create(req.body)
    const waiter = await Waiter.findOne({phone});

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

    let matchStage = {
        $match: {
            restaurant: new mongoose.Types.ObjectId(restaurant), // Ensure restaurant field is an ObjectId
            waiter: new mongoose.Types.ObjectId(id), // Ensure waiter field is an ObjectId
            typeOfTable: new mongoose.Types.ObjectId(type) // Ensure typeOfTable field is an ObjectId
        }
    };

    const tables = await Table.aggregate([
        matchStage,
        {
            $lookup: {
                from: 'activeorders',
                localField: '_id',
                foreignField: 'table',
                as: 'activeOrders'
            }
        },
        {
            $lookup: {
                from: 'archiveorders',
                localField: '_id',
                foreignField: 'table',
                as: 'archiveOrders'
            }
        },
        {
            $lookup: {
                from: 'orders',
                localField: '_id',
                foreignField: 'table',
                as: 'totalOrders'
            }
        },
        {
            $project: {
                name: 1,
                createdAt: 1,
                totalPrice: {
                    $sum: '$totalOrders.totalPrice'
                },
                totalItems: {
                    $sum: '$totalOrders.totalItems'
                }
            }
        }
    ]);



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
// @route     PUT /api/v1/waiter/tables
// @access    Private
exports.occupyTable = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;

    if (!req.body.table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }

    let table = await Table.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.body.table),
                restaurant: new mongoose.Types.ObjectId(restaurant)
            }
        },
        {$addFields: {waiter: "$waiter", call: "$call", callId: "$callId"}}
    ]);

    if (!table || table.length === 0) {
        return next(new ErrorResponse('Table not found with id of ' + req.body.table, 404));
    }

    table = table[0]; // As aggregate returns an array, we need to get the first element

    if (table.waiter) {
        return next(new ErrorResponse('Table is already occupied', 400));
    }

    if (table.call === 'accepted' && table.callId !== id) {
        return next(new ErrorResponse('Table is already accepted by another waiter', 400));
    }

    table.waiter = id;
    table.call = 'none'
    table.callId = null

    await Table.findByIdAndUpdate(table._id, table);

    emitEventTo(`table-${table._id}`, 'tableOccupied', {
        id: table._id,
        waiter: id
    });
    emitEventTo(`waiters-${restaurant}`, 'tableOccupied', {
        id: table._id,
        waiter: id
    });

    res.status(200).json(table);
});

// @desc      I am going to the table
// @route     PUT /api/v1/waiter/tables/:id/callback
// @access    Private
exports.goToTable = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;

    let table = await Table.findOne({
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

    table = await Table.aggregate(
        [
            {
                $match: {
                    _id: table._id
                }
            },
            {
                $lookup: {
                    from: 'activeorders',
                    localField: '_id',
                    foreignField: 'table',
                    as: 'activeOrders'
                }
            },
            {
                $lookup: {
                    from: 'archiveorders',
                    localField: '_id',
                    foreignField: 'table',
                    as: 'archiveOrders'
                }
            },
            {
                $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'table',
                    as: 'totalOrders'
                }
            },
            {
                $project: {
                    typeOfTable: 1,
                    name: 1,
                    waiter: 1,
                    archiveOrders: 1,
                    activeOrders: 1,
                    totalOrders: 1,
                    activePrice: {
                        $sum: '$activeOrders.totalPrice'
                    },
                    activeItems: {
                        $sum: '$activeOrders.totalItems'
                    },
                    totalPrice: {
                        $sum: 'orders.totalPrice'
                    },
                    totalItems: {
                        $sum: 'orders.totalItems'
                    }
                }
            }
        ]
    )
    table = table[0]

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

    let table = await Table.findOne({
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

    table = await Table.aggregate(
        [
            {
                $match: {
                    _id: table._id
                }
            },
            {
                $lookup: {
                    from: 'activeorders',
                    localField: '_id',
                    foreignField: 'table',
                    as: 'activeOrders'
                }
            },
            {
                $lookup: {
                    from: 'archiveorders',
                    localField: '_id',
                    foreignField: 'table',
                    as: 'archiveOrders'
                }
            },
            {
                $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'table',
                    as: 'totalOrders'
                }
            },
            {
                $project: {
                    typeOfTable: 1,
                    name: 1,
                    waiter: 1,
                    archiveOrders: 1,
                    activeOrders: 1,
                    totalOrders: 1,
                    activePrice: {
                        $sum: '$activeOrders.totalPrice'
                    },
                    activeItems: {
                        $sum: '$activeOrders.totalItems'
                    },
                    totalPrice: {
                        $sum: 'orders.totalPrice'
                    },
                    totalItems: {
                        $sum: 'orders.totalItems'
                    }
                }
            }
        ]
    )

    table = table[0]

    emitEventTo(`table-${table._id}`, 'callDeclined', {
        _id: table._id,
    });

    res.status(200).json(table);
});


