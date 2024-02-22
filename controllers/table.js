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

        table = table[0];

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

    let table = await Table.aggregate(
        [
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.params.id),
                    restaurant: new mongoose.Types.ObjectId(restaurant)
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

    table = table[0];

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


    // aggregate tables with activePrice, totalPrice,

    // activeOrders array has product field to be populated and stay other fields
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
        }
        if (table.totalOrders.length !== 0) {
            table.totalOrders = table.totalOrders[0];
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
        typeOfTable: typeOfTable || table.typeOfTable,
        name: name || table.name,
        waiter,
        setWaiterByAdmin: !!waiter,
        call: 'none',
        callTime: null
    }, {
        new: true,
        runValidators: true
    })

    updatedTable = await Table.aggregate(
        [
            {
                $match: {
                    _id: updatedTable._id,
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

    updatedTable = updatedTable[0];

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

    await Order.deleteMany({table: table._id});
    await ActiveOrder.deleteMany({table: table._id});
    await ArchiveOrder.deleteMany({table: table._id});
    await Basket.deleteOne({table: table._id});
    let imagePath = path.join(__dirname, `../uploads/${table.qrCode}`);
    await Table.deleteOne({_id: table._id});
    // delete image
    try {
        fs.unlinkSync(imagePath);
    } catch (err) {
        return next(new ErrorResponse(err, 500));
    }

    emitEventTo(`waiters-${restaurant}`, 'deletedTable', {
        id: req.params.id
    });

    res.status(200).json({});
});

// @desc      Set passcode to table
// @route     PUT /api/v1/tables/code/:id
// @access    Private
exports.setCodeToTable = asyncHandler(async (req, res, next) => {
    const {code} = req.body;
    const {id} = req.params;
    let table = await Table.findOne({
        _id: id
    }).select('+code')

    if (!table) {
        return next(new ErrorResponse(`Table not found with id of ${id}`, 404));
    }

    if (table.occupied) {
        return next(new ErrorResponse(`You are not allowed to set a code to an occupied table`, 401));
    }

    table.code = code;
    table.occupied = true;

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

    table = table[0];

    res.status(200).json(table);
});

// @desc      Login to table
// @route     POST /api/v1/tables/code/:id
// @access    Private
exports.loginToTable = asyncHandler(async (req, res, next) => {
    const {code} = req.body;
    const {id} = req.params;

    let table = await Table.findOne({
        _id: id,
        code,
    }).select('+code')

    if (!table) {
        return next(new ErrorResponse(`Table not found with id of ${id}`, 404));
    }

    if (!table.occupied) {
        return next(new ErrorResponse(`You are not allowed to login to an unoccupied table`, 401));
    }

    table = await Table.aggregate(
        [
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.params.id),
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

    table = table[0];

    res.status(200).json(table);
})

// @desc      Call waiter
// @route     POST /api/v1/tables/call/:restaurant/:id
// @access    Private
exports.callWaiter = asyncHandler(async (req, res, next) => {
    const {code} = req.body;
    const {id} = req.params;
    let table = await Table.findOne({
        _id: id,
        code
    }).select('+code')

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

    if (table.waiter) {
        emitEventTo(table.waiter, 'callWaiter', table);
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
    const {restaurant} = req.user
    const {id} = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let table = await Table.aggregate([
            {$match: {_id: new mongoose.Types.ObjectId(id), restaurant: new mongoose.Types.ObjectId(restaurant)}},
            {
                $lookup: {
                    from: 'waiters',
                    localField: 'waiter',
                    foreignField: '_id',
                    as: 'waiter'
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
                    from: 'activeorders',
                    localField: '_id',
                    foreignField: 'table',
                    as: 'activeOrders'
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
                $addFields: {
                    activePrice: {$sum: "$activeOrders.totalPrice"},
                    activeItems: {$sum: "$activeOrders.totalItems"},
                    totalPrice: {$sum: "$totalOrders.totalPrice"},
                    totalItems: {$sum: "$totalOrders.totalItems"}
                }
            },
            {
                $unwind: {
                    path: "$waiter",
                    preserveNullAndEmptyArrays: true
                }
            }
        ]).session(session);

        if (!table || table.length === 0) {
            throw new ErrorResponse('Table not found with id of ' + id, 404);
        }

        table = table[0]; // As aggregate returns an array, we need to get the first element

        if (table.activePrice > 0) {
            throw new ErrorResponse('Table has active orders', 400);
        }

        let waiter = table.waiter;
        if (!table.setWaiterByAdmin) {
            table.waiter = null
            waiter = null
            table.callId = null
        }

        if (table.activePrice !== 0 && table.totalPrice !== 0) {
            await ArchiveOrder.create({
                table: table._id,
                waiter: table.waiter,
                totalOrders: table.totalOrders,
                totalPrice: table.totalPrice,
                totalItems: table.totalItems,
                restaurant,
            }, {session});

            await ActiveOrder.deleteMany({table: table._id}).session(session);
            await Order.deleteMany({table: table._id}).session(session);
            const basket = await Basket.findOne({table: table._id}).session(session);
            basket.products = [];
            await basket.save({session});
        }

        table.occupied = false
        table.call = 'none'
        table.callTime = null
        table.code = '0000'
        table.hasActiveOrder = false
        await Table.findByIdAndUpdate(table._id, table, {session});

        await session.commitTransaction();


        if (waiter) {
            emitEventTo(waiter, 'closeTable', table);
        } else {
            emitEventTo('waiters-' + restaurant, 'closedTable', table);
        }

        res.status(200).json(table);
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        await session.endSession();
    }
});
