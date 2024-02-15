const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const TypeOfTable = require('../models/TypeOfTable');
const Table = require('../models/Table');
const Order = require('../models/Order');
const ArchiveOrder = require('../models/ArchiveOrder');
const {emitEventTo} = require('../listeners/socketManager');

// @desc      Get all typeOfTables
// @route     GET /api/v1/tables/type
// @access    Public
exports.getTypeOfTables = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user
    const typeOfTables = await TypeOfTable.find({
        restaurant
    }).populate('tables');

    if (!typeOfTables) {
        return next(new ErrorResponse(`Type of tables not found with id of ${restaurant._id}`, 404));
    }

    res.status(200).json(typeOfTables);
});

// @desc      Get single typeOfTable
// @route     GET /api/v1/tables/type/:id
// @access    Public
exports.getTypeOfTable = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user
    const typeOfTable = await TypeOfTable.findOne({
        _id: req.params.id,
        restaurant
    }).populate('tables');

    if (!typeOfTable) {
        return next(new ErrorResponse(`Type of table not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json(typeOfTable);
});

// @desc      Create new typeOfTable
// @route     POST /api/v1/tables/type
// @access    Private
exports.createTypeOfTable = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user
    const typeOfTable = await TypeOfTable.create({
        ...req.body,
        restaurant
    });

    emitEventTo(`waiters-${restaurant}`, 'newTypeOfTable', typeOfTable);

    res.status(201).json(typeOfTable);
});

// @desc      Update typeOfTable
// @route     PUT /api/v1/tables/type/:id
// @access    Private
exports.updateTypeOfTable = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user
    const typeOfTable = await TypeOfTable.findByIdAndUpdate(req.params.id, {
        ...req.body,
        restaurant
    }, {
        new: true,
        runValidators: true
    })

    if (!typeOfTable) {
        return next(new ErrorResponse(`Type of table not found with id of ${req.params.id}`, 404));
    }

    emitEventTo(`waiters-${restaurant}`, 'updateTypeOfTable', typeOfTable);

    res.status(200).json(typeOfTable);
});

// @desc      Delete typeOfTable
// @route     DELETE /api/v1/tables/type/:id
// @access    Private
exports.deleteTypeOfTable = asyncHandler(async (req, res, next) => {
    const {restaurant} = req.user
    const typeOfTable = await TypeOfTable.findById(req.params.id)

    if (!typeOfTable) {
        return next(new ErrorResponse(`Type of table not found with id of ${req.params.id}`, 404));
    }

    const tables = await Table.find({
        typeOfTable: typeOfTable._id,
        restaurant
    });
    const tablesIds = tables.map(table => table._id);

    await Promise.all([
        Table.deleteMany({
            _id: {$in: tablesIds},
            restaurant
        }),
        ArchiveOrder.deleteMany({
            table: {$in: tablesIds},
            restaurant
        }),
        Order.deleteMany({
            table: {$in: tablesIds},
            restaurant
        }),
        await TypeOfTable.deleteOne(typeOfTable)
    ])

    emitEventTo(`waiters-${restaurant}`, 'deleteTypeOfTable', {
        _id: req.params.id
    });

    res.status(200).json({});
});

