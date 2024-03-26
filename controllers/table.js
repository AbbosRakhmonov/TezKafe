const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Table = require('../models/Table');
const Order = require('../models/Order');
const ArchiveOrder = require('../models/ArchiveOrder');
const ActiveOrder = require('../models/ActiveOrder');
const Basket = require('../models/Basket');
const {emitEventTo} = require('../listeners/socketManager');
const qr = require('qr-image');
const fs = require('fs');
const path = require('path');
const mongoose = require("mongoose");
const moment = require('moment-timezone');

// @desc      Create table
// @route     POST /api/v1/tables
// @access    Private
exports.createTable = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const {typeOfTable, name, waiter} = req.body
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        let table = await Table.create([{
            typeOfTable,
            name,
            waiter,
            setWaiterByAdmin: !!waiter,
            restaurant
        }], {session})

        table = table[0];

        let hostname = process.env.HOSTNAME
        const qr_svg = qr.imageSync(`${hostname}/connect/${table._id}`, {type: 'png'});
        let imagePath = path.join(__dirname, `../uploads/${table._id}.png`);
        fs.writeFileSync(imagePath, qr_svg);

        table.qrCode = `${table._id}.png`;
        await table.save();

        await Basket.create([{
            restaurant,
            table: table._id,
            products: [],
            totalPrice: 0
        }], {session});

        await session.commitTransaction();

        table = await Table.findOne({
            _id: table._id
        })
            .populate('waiter typeOfTable')

        table.activeOrders = null;
        table.totalOrders = null;

        if (waiter) {
            emitEventTo(waiter, 'newTable', table);
        } else {
            emitEventTo(`waiters-${restaurant}`, 'newTable', table);
        }
        res.status(201).json(table);
    } catch (error) {
        await session.abortTransaction();
        return next(new ErrorResponse(error, 500));
    } finally {
        await session.endSession();
    }
});

// @desc      Get table
// @route     GET /api/v1/tables/:id
// @access    Private
exports.getTable = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    if (!req.params.id) {
        return next(new ErrorResponse('Please provide a table id', 400));
    }

    const table = await Table.findOne({
        _id: new mongoose.Types.ObjectId(req.params.id),
        restaurant: new mongoose.Types.ObjectId(restaurant)
    })
        .populate('waiter typeOfTable')
        .populate({
            path: 'activeOrders',
            populate: {
                path: 'products.product',
                model: 'Product'
            }
        })
        .populate({
            path: 'totalOrders',
            populate: {
                path: 'products.product',
                model: 'Product'
            }
        })
        .lean()

    if (table) {
        if (table.activeOrders.length !== 0) {
            table.activeOrders = table.activeOrders[0];
        } else {
            table.activeOrders = null
        }
        if (table.totalOrders.length !== 0) {
            table.totalOrders = table.totalOrders[0];
        } else {
            table.totalOrders = null
        }
    }

    res.status(200).json(table);
});

// @desc      Get all tables
// @route     GET /api/v1/tables?type=type&occupied=occupied
// @access    Private
exports.getTables = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const {type, occupied} = req.query;
    let matchStage = {
        $match: {
            restaurant: new mongoose.Types.ObjectId(restaurant) // Ensure restaurant field is an ObjectId
        }
    };

    // Dynamically add query parameters to the match stage
    if (type) {
        matchStage.$match.typeOfTable = new mongoose.Types.ObjectId(type);
    }
    if (occupied !== undefined) {
        const isOccupied = JSON.parse(occupied);
        matchStage.$match.waiter = isOccupied ? {$ne: null} : null;
    }

    const tables = await Table.find(matchStage.$match)
        .populate('waiter typeOfTable')
        .populate({
            path: 'activeOrders',
            populate: {
                path: 'products.product',
                model: 'Product'
            }
        })
        .populate({
            path: 'totalOrders',
            populate: {
                path: 'products.product',
                model: 'Product'
            }
        })
        .lean()

    for (let table of tables) {
        if (table.activeOrders.length !== 0) {
            table.activeOrders = table.activeOrders[0];
        } else {
            table.activeOrders = null
        }
        if (table.totalOrders.length !== 0) {
            table.totalOrders = table.totalOrders[0];
        } else {
            table.totalOrders = null
        }
    }

    res.status(200).json(tables);
});

// @desc      Update table
// @route     PUT /api/v1/tables/:id
// @access    Private
exports.updateTable = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const table = await Table.findOne({
        restaurant,
        _id: new mongoose.Types.ObjectId(req.params.id)
    })
    if (!table) {
        return next(new ErrorResponse(`
    Table
    not
    found
    with id of ${req.params.id}`, 404));
    }
    if (table.occupied) {
        return next(new ErrorResponse(`
    You
    are
    not
    allowed
    to
    update
    an
    occupied
    table`, 400));
    }
    const {typeOfTable, name, waiter} = req.body

    let updatedTable = await Table.findByIdAndUpdate(req.params.id, {
        typeOfTable,
        name,
        waiter,
        setWaiterByAdmin: !!waiter,
        call: 'none',
        callTime: null
    }, {
        new: true,
        runValidators: true
    })
        .populate('waiter typeOfTable')
        .populate({
            path: 'activeOrders',
            populate: {
                path: 'products.product',
                model: 'Product'
            }
        })
        .populate({
            path: 'totalOrders',
            populate: {
                path: 'products.product',
                model: 'Product'
            }
        })

    if (updatedTable) {
        if (updatedTable.activeOrders.length !== 0) {
            updatedTable.activeOrders = updatedTable.activeOrders[0];
        } else {
            updatedTable.activeOrders = null
        }
        if (updatedTable.totalOrders.length !== 0) {
            updatedTable.totalOrders = updatedTable.totalOrders[0];
        } else {
            updatedTable.totalOrders = null
        }
    }

    if (waiter) {
        emitEventTo(waiter, 'updateTable', updatedTable);
    } else {
        emitEventTo(`waiters-${restaurant}`, 'updateTable', updatedTable);
    }

    res.status(200).json(updatedTable);
});

// @desc      Delete table
// @route     DELETE /api/v1/tables/:id
// @access    Private
exports.deleteTable = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user;
    const table = await Table.findOne({
        restaurant,
        _id: req.params.id
    })
    if (!table) {
        return next(new ErrorResponse(`
    Table
    not
    found
    with id of ${req.params.id}`, 404));
    }
    if (table.occupied) {
        return next(new ErrorResponse(`
    You
    are
    not
    allowed
    to
    delete an
    occupied
    table`, 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await Order.deleteMany({table: table._id}).session(session);
        await ActiveOrder.deleteMany({table: table._id}).session(session);
        await ArchiveOrder.deleteMany({table: table._id}).session(session);
        await Basket.deleteOne({table: table._id}).session(session);
        await Table.deleteOne({_id: table._id}).session(session);

        let imagePath = path.join(__dirname, `../uploads/${table.qrCode}`);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
        await session.commitTransaction();

        emitEventTo(`waiters-${restaurant}`, 'deletedTable', {
            id: req.params.id
        });
        emitEventTo(`directors-${restaurant}`, 'deletedTable', {
            id: req.params.id
        });

        res.status(200).json({});
    } catch (e) {
        await session.abortTransaction();
        return next(new ErrorResponse(e, 500));
    } finally {
        await session.endSession();
    }
});

// @desc      Set passcode to table
// @route     PUT /api/v1/tables/code/:id
// @access    Private
exports.setCodeToTable = asyncHandler(async (req, res, next) => {
    const {code} = req.body;
    const {id} = req.params;
    let table = await Table.findOne({
        _id: id
    })
        .select('+code')
        .populate('waiter typeOfTable')
        .populate({
            path: 'activeOrders',
            populate: {
                path: 'products.product',
                model: 'Product'
            }
        })
        .populate({
            path: 'totalOrders',
            populate: {
                path: 'products.product',
                model: 'Product'
            }
        })
        .populate({
            path: 'restaurant',
            select: 'name photo'
        })

    if (!table) {
        return next(new ErrorResponse(`Table not found with id of ${id}`, 404));
    }

    if (table.occupied) {
        if (table.code !== code) {
            return next(new ErrorResponse(`You entered the wrong code`, 400));
        }
    } else {
        table.code = code;
        table.occupied = true;
        await table.save();
    }

    if (table.activeOrders.length !== 0) {
        table.activeOrders = table.activeOrders[0];
    } else {
        table.activeOrders = null
    }

    if (table.totalOrders.length !== 0) {
        table.totalOrders = table.totalOrders[0];
    } else {
        table.totalOrders = null
    }

    res.status(200).json(table);
});

// @desc      Call waiter
// @route     POST /api/v1/tables/call/:restaurant/:id
// @access    Private
exports.callWaiter = asyncHandler(async (req, res, next) => {
    const {code} = req.body;
    const {id} = req.params;
    let table = await Table.findOne({
        _id: id,
        code
    })
        .select('+code')
    if (!table) {
        return next(new ErrorResponse(`
    Table
    not
    found
    with id of ${req.params.id}`, 404));
    }
    if (table.code !== code) {
        return next(new ErrorResponse(`
    You
    entered
    the
    wrong
    code`, 400));
    }

    table.call = 'calling'
    table.callTime = moment().tz('Asia/Tashkent').format()
    await table.save();

    if (table.waiter) {
        emitEventTo(table.waiter.toString(), 'callWaiter', table);
    } else {
        emitEventTo(`waiters-${table.restaurant}`, 'callWaiter', table);
    }
    emitEventTo(`directors-${table.restaurant}`, 'callWaiter', table);

    res.status(200).json({});
});

// @desc      Close table
// @route     POST /api/v1/tables/:id
// @access    Private
exports.closeTable = asyncHandler(async (req, res, next) => {
    const {restaurant, role} = req.user
    const {id} = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let table = await Table.findOne({
            _id: id,
            restaurant
        })
            .populate('waiter typeOfTable')
            .populate({
                path: 'activeOrders',
                populate: {
                    path: 'products.product',
                    model: 'Product'
                }
            })
            .populate({
                path: 'totalOrders',
                populate: {
                    path: 'products.product',
                    model: 'Product'
                }
            })
            .session(session)

        if (!table) {
            throw new ErrorResponse('Table not found', 404);
        }

        if (table.activeOrders.length !== 0) {
            table.activeOrders = table.activeOrders[0];
        } else {
            table.activeOrders = null
        }

        if (table.totalOrders.length !== 0) {
            table.totalOrders = table.totalOrders[0];
        } else {
            table.totalOrders = null
        }

        if (table.hasActiveOrder) {
            throw new ErrorResponse('Table has active orders', 400);
        }

        if (table.activeOrders?.totalPrice !== 0 && table.totalOrders?.totalPrice !== 0) {
            await ArchiveOrder.create([{
                table: table._id,
                waiter: table.waiter,
                totalOrders: table.totalOrders?.products || [],
                totalPrice: table.totalOrders?.totalPrice || 0,
                restaurant,
            }], {session})

            await ActiveOrder.deleteMany({table: table._id}).session(session);
            await Order.deleteMany({table: table._id}).session(session);
            const basket = await Basket.findOne({table: table._id}).session(session);
            basket.products = [];
            basket.totalPrice = 0;
            await basket.save({session});
        }

        let waiter = table.waiter;
        if (!table.setWaiterByAdmin) {
            table.waiter = null
            waiter = null
            table.callId = null
        }

        table.occupied = false
        table.call = 'none'
        table.callTime = null
        table.code = '0000'
        table.hasActiveOrder = false

        await table.save({session});

        await session.commitTransaction();

        if (waiter && role !== 'waiter') {
            emitEventTo(waiter, 'closedTable', table);
        } else {
            emitEventTo('directors-' + restaurant, 'closedTable', table);
        }

        emitEventTo('waiters-' + restaurant, 'closedTable', table);

        res.status(200).json(table);
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        await session.endSession();
    }
});
