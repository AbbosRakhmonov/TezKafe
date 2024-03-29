const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Waiter = require('../models/Waiter');
const Order = require('../models/Order');
const ArchiveOrder = require('../models/ArchiveOrder');
const ActiveOrder = require('../models/ActiveOrder');
const Table = require('../models/Table');
const Director = require('../models/Director');
const File = require('../models/File')
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
    let newWaiter = await Waiter.create(req.body)
    if (req.body.avatar && req.body.avatar !== 'no-photo.jpg') {
        const newPhoto = await File.findOne({name: req.body.avatar});
        if (newPhoto) {
            newPhoto.inuse = true;
            await newPhoto.save()
        }
    } else {
        newWaiter.avatar = 'no-photo.jpg'
        await newWaiter.save()
    }
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

    const {password, ...body} = req.body;

    let newWaiter = await waiter.updateOne(body, {
        new: true,
        runValidators: true
    });

    if (password) {
        waiter.password = password;
        await waiter.save();
    }

    if (req.body.avatar && req.body.avatar !== waiter.avatar && req.body.avatar !== 'no-photo.jpg') {
        const newPhoto = await File.findOne({name: req.body.avatar})
        if (newPhoto) {
            newPhoto.inuse = true
            await newPhoto.save()
        }
        const oldPhoto = await File.findOne({name: waiter.avatar});
        if (oldPhoto) {
            oldPhoto.inuse = false
            await oldPhoto.save()
        }
    } else if (req.body.avatar === null) {
        newWaiter.photo = 'no-photo.jpg'
        await newWaiter.save()
    }

    res.status(200).json(newWaiter);
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

    const tables = await Table.find({waiter: req.params.id});

    if (tables.length > 0) {
        return next(new ErrorResponse('Waiter has tables', 400));
    }

    // transactions
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const photo = await File.findOne({name: waiter.photo});

        if (photo) {
            photo.inuse = false
            await photo.save({session})
        }

        //     remove orders
        await Order.deleteMany({waiter: req.params.id}).session(session);
        //     remove active orders
        await ActiveOrder.deleteMany({waiter: req.params.id}).session(session);
        //     remove archive orders
        await ArchiveOrder.deleteMany({waiter: req.params.id}).session(session);
        //     remove waiter
        await Waiter.findByIdAndDelete(req.params.id).session(session);

        await session.commitTransaction();
    } catch (e) {
        await session.abortTransaction();
        return next(new ErrorResponse(e, 500));
    } finally {
        await session.endSession();
    }

    res.status(200).json({});
});

// @desc      Get waiter's tables
// @route     GET /api/v1/waiter/tables?type=type
// @access    Private
exports.getWaiterTables = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;
    const {type} = req.query;

    let filter = {
        restaurant,
        waiter: id,
        occupied: true
    }

    if (type) {
        filter.typeOfTable = type
    }

    let tables = await Table.find(filter)
        .populate('typeOfTable')

    res.status(200).json(tables);
});

// @desc      Get waiter's orders
// @route     GET /api/v1/waiter/orders?table=table
// @access    Private
exports.getWaiterOrders = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;
    const {table} = req.query;

    if (!table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }

    let orders = await Order.find({
        restaurant,
        table,
        waiter: id
    }).populate('products.product')

    let activeOrders = await ActiveOrder.find({
        restaurant,
        table,
        waiter: id
    }).populate('products.product')

    let data = {}

    if (orders.length > 0) {
        data.totalOrders = orders[0]
    }

    if (activeOrders.length > 0) {
        data.activeOrders = activeOrders[0]
    }

    res.status(200).json(data);
});

// @desc      Occupy table
// @route     PUT /api/v1/waiter/tables
// @access    Private
exports.occupyTable = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user;

    if (!req.body.table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }

    let table = await Table.findOne({
        restaurant,
        _id: req.body.table
    })

    if (!table) {
        return next(new ErrorResponse('Table not found with id of ' + req.body.table, 404));
    }


    if (table.waiter && table.waiter.toString() !== id.toString()) {
        return next(new ErrorResponse('Table is already occupied', 400));
    }

    if (table.call === 'accepted' && table.callId.toString() !== id.toString()) {
        return next(new ErrorResponse('Table is already accepted by another waiter', 400));
    }

    table.waiter = id;
    table.call = 'none'
    table.callId = id
    table.occupied = true

    await Table.findByIdAndUpdate(table._id, table, {
        new: true,
        runValidators: true
    });

    emitEventTo(`table-${table._id}`, 'tableOccupied', {
        id: table._id,
        waiter: id
    });
    emitEventTo(`waiters-${restaurant}`, 'tableOccupied', {
        id: table._id,
        waiter: id
    });
    emitEventTo(`directors-${restaurant}`, 'tableOccupied', {
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
    })

    if (!table) {
        return next(new ErrorResponse('Table not found', 404));
    }

    if (table.callId && table.callId.toString() !== id.toString()) {
        return next(new ErrorResponse('Table is already accepted by another waiter', 400));
    }

    table.call = 'accepted'

    if (!table.callId) {
        table.callId = id
    }

    // table.callTime = new Date()

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
    emitEventTo(`waiters-${table.restaurant}`, 'callAccepted', {
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
            {call: 'accepted', callId: id},
            {call: 'calling', callId: null}
        ]
    });

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
    table.callTime = null

    if (!table.waiter) {
        table.callId = null
    }

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


