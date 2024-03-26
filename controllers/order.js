const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Order = require('../models/Order');
const Table = require('../models/Table');
const ActiveOrder = require('../models/ActiveOrder');
const {emitEventTo} = require('../listeners/socketManager');
const mongoose = require('mongoose');

// @desc      Get all orders
// @route     GET /api/v1/orders?table=tableId
// @access    Private
exports.getOrders = asyncHandler(async (req, res, next) => {
    const {role, id, restaurant} = req.user
    const {table} = req.query;
    if (!table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }
    let orders;
    if (role === 'waiter') {
        orders = await ActiveOrder.findOne({
            waiter: id,
            table,
            restaurant
        }).populate('products.product');
    } else {
        orders = await ActiveOrder.findOne({
            restaurant,
            table
        }).populate('products.product');
    }
    res.status(200).json(orders);
});

// @desc      Create order (add product to active orders)
// @route     POST /api/v1/orders
// @access    Private
exports.createOrder = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user
    const {table, product, quantity} = req.body;

    if (!restaurant) {
        return next(new ErrorResponse('Please provide a restaurant', 400));
    }
    if (!table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }
    console.log(restaurant, table, id)

    const existTable = await Table.findOne({
        _id: new mongoose.Types.ObjectId(table),
        restaurant: new mongoose.Types.ObjectId(restaurant),
        waiter: new mongoose.Types.ObjectId(id)
    })

    if (!existTable) {
        return next(new ErrorResponse(`Table not found with id of ${table}`, 404));
    }

    let activeOrder = await ActiveOrder.findOne({
        table: new mongoose.Types.ObjectId(table),
        restaurant: new mongoose.Types.ObjectId(restaurant),
        waiter: new mongoose.Types.ObjectId(id)
    });

    if (!activeOrder) {
        activeOrder = await ActiveOrder.create({
            table: new mongoose.Types.ObjectId(table),
            restaurant: new mongoose.Types.ObjectId(restaurant),
            waiter: new mongoose.Types.ObjectId(id),
            totalPrice: 0
        });
    }

    activeOrder.products.push({
        product,
        quantity,
        price: 0
    })
    await activeOrder.save();

    activeOrder = await ActiveOrder.findOne({
        table: new mongoose.Types.ObjectId(table),
        restaurant: new mongoose.Types.ObjectId(restaurant),
        waiter: new mongoose.Types.ObjectId(id)
    }).populate({
        path: 'products.product',
    })

    if (!existTable.hasActiveOrder) {
        emitEventTo(id.toString(), 'newActiveOrder', activeOrder);
        emitEventTo(`directors-${restaurant}`, 'newActiveOrder', activeOrder);
    }
    existTable.hasActiveOrder = true;
    await existTable.save();

    res.status(201).json(activeOrder);
});

// @desc      Update Order
// @route     PUT /api/v1/orders/:id
// @access    Private
exports.updateOrder = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user
    const {table, product, quantity} = req.body;

    if (!restaurant) {
        return next(new ErrorResponse('Please provide a restaurant', 400));
    }
    if (!table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }

    const existTable = await Table.findOne({
        _id: table,
        restaurant,
        waiter: id
    })

    if (!existTable) {
        return next(new ErrorResponse(`Table not found with id of ${table}`, 404));
    }

    let activeOrder = await ActiveOrder.findOne({
        table,
        restaurant,
        waiter: id,
    });

    if (!activeOrder) {
        return next(new ErrorResponse(`Active Order not found with table id of ${table}`, 404));
    }

    if (quantity <= 0) {
        activeOrder.products = activeOrder.products.filter(p => p.product !== product);
    } else {
        activeOrder.products = activeOrder.products.map(p => {
            if (p.product.toString() === product.toString()) {
                p.quantity = quantity;
            }
            return p;
        })
    }

    await activeOrder.save();

    if (activeOrder.products.length === 0) {
        activeOrder.hasActiveOrder = false;
        await activeOrder.save();
        emitEventTo(id.toString(), 'noActiveOrder', activeOrder);
        emitEventTo(`directors-${restaurant}`, 'noActiveOrder', activeOrder);
    }

    res.status(200).json(activeOrder);
});

// @desc      Delete Order
// @route     DELETE /api/v1/orders/:id
// @access    Private
exports.deleteOrder = asyncHandler(async (req, res, next) => {
    const {restaurant, id} = req.user
    const {table, product} = req.body;

    if (!restaurant) {
        return next(new ErrorResponse('Please provide a restaurant', 400));
    }
    if (!table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }

    const existTable = await Table.findOne({
        _id: table,
        restaurant,
        waiter: id
    })

    if (!existTable) {
        return next(new ErrorResponse(`Table not found with id of ${table}`, 404));
    }

    let activeOrder = await ActiveOrder.findOne({
        table,
        restaurant,
        waiter: id
    });

    if (!activeOrder) {
        return next(new ErrorResponse(`Active Order not found with table id of ${table}`, 404));
    }

    activeOrder.products = activeOrder.products.filter(p => p.product.toString() !== product.toString());
    await activeOrder.save();

    if (activeOrder.products.length === 0) {
        activeOrder.hasActiveOrder = false;
        await activeOrder.save();
        emitEventTo(id.toString(), 'noActiveOrder', activeOrder);
        emitEventTo(`directors-${restaurant}`, 'noActiveOrder', activeOrder);
    }

    res.status(200).json(activeOrder);
});

// @desc      Approve Order
// @route     POST /api/v1/orders/:id
// @access    Private
exports.approveOrder = asyncHandler(async (req, res, next) => {
    const {restaurant, id: waiter} = req.user
    const {table} = req.body;
    const {id} = req.params

    if (!id) {
        return next(new ErrorResponse('Please provide an active order id', 400));
    }

    if (!table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }

    // check if the table is available
    const existTable = await Table.findOne({
        _id: table,
        restaurant,
        waiter
    })

    if (!existTable) {
        return next(new ErrorResponse(`Table not found with id of ${table}`, 404));
    }

    let activeOrder = await ActiveOrder.findOne({
        _id: id,
        table,
        restaurant,
        waiter
    });

    if (!activeOrder) {
        return next(new ErrorResponse(`Active Order not found with table id of ${table}`, 404));
    }

    if (activeOrder.products.length === 0) {
        return next(new ErrorResponse(`Active Order is empty`, 400));
    }

//     check order exist or not
    let order = await Order.findOne({
        table,
        restaurant,
        waiter
    });

    if (order) {
        order.products = activeOrder.products;
    } else {
        order = await Order.create({
            table,
            products: activeOrder.products,
            restaurant,
            waiter,
            totalPrice: 0
        });
    }

    await order.save();

    activeOrder.hasActiveOrder = false;
    activeOrder.products = [];
    activeOrder.totalPrice = 0;
    await activeOrder.save();

    res.status(200).json(order);
});

// @desc      Get Approved Order
// @route     GET /api/v1/approved/orders
// @access    Private
exports.getApprovedOrder = asyncHandler(async (req, res, next) => {
    const {role, id, restaurant} = req.user
    const {table} = req.query;
    if (!table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }
    let orders
    if (role === 'waiter') {
        orders = await Order.findOne({
            waiter: id,
            table,
            restaurant
        }).populate('products.product');
    } else {
        orders = await Order.findOne({
            restaurant,
            table
        }).populate('products.product');
    }
    res.status(200).json(orders);
});

// @desc      Update Approved Order
// @route     PUT /api/v1/approved/orders/:id
// @access    Private
exports.updateApprovedOrder = asyncHandler(async (req, res, next) => {
    const {restaurant, id: waiter} = req.user
    const {table, product, quantity} = req.body;
    const {id} = req.params

    if (!id) {
        return next(new ErrorResponse('Please provide an order id', 400));
    }

    if (!table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }

    // check if the table is available
    const existTable = await Table.findOne({
        _id: table,
        restaurant,
        waiter
    })

    if (!existTable) {
        return next(new ErrorResponse(`Table not found with id of ${table}`, 404));
    }

    let order = await Order.findOne({
        _id: id,
        restaurant,
        waiter,
        table
    });

    if (!order) {
        return next(new ErrorResponse(`Order not found with id of ${id}`, 404));
    }

    if (quantity <= 0) {
        order.products = order.products.filter(p => p.product !== product);
    } else {
        order.products = order.products.map(p => {
            if (p.product.toString() === product.toString()) {
                p.quantity = quantity;
            }
            return p;
        })
    }

    await order.save();

    res.status(200).json(order);
});

// @desc      Delete Approved Order
// @route     DELETE /api/v1/approved/orders/:id
// @access    Private
exports.deleteApprovedOrder = asyncHandler(async (req, res, next) => {
    const {restaurant, id: waiter} = req.user
    const {table, product} = req.body;
    const {id} = req.params

    if (!id) {
        return next(new ErrorResponse('Please provide an order id', 400));
    }

    if (!table) {
        return next(new ErrorResponse('Please provide a table', 400));
    }

    // check if the table is available
    const existTable = await Table.findOne({
        _id: table,
        restaurant,
        waiter
    })

    if (!existTable) {
        return next(new ErrorResponse(`Table not found with id of ${table}`, 404));
    }

    let order = await Order.findOne({
        _id: id,
        restaurant,
        waiter,
        table
    });

    if (!order) {
        return next(new ErrorResponse(`Order not found with id of ${id}`, 404));
    }

    order.products = order.products.filter(p => p.product.toString() !== product.toString());
    await order.save();

    res.status(200).json(order);
});

