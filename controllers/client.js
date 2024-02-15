const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Order = require('../models/Order');
const Table = require('../models/Table');
const ActiveOrder = require('../models/ActiveOrder');
const Basket = require('../models/Basket');
const {emitEventTo} = require('../listeners/socketManager');

// @desc      Get client orders
// @route     GET /api/v1/client/orders?restaurant=restaurant&table=table&code=code
// @access    Private
exports.getClientOrders = asyncHandler(async (req, res, next) => {
    const {restaurant, table, code} = req.query;
    if (!restaurant)
        return next(new ErrorResponse('Please provide restaurant', 400));

    if (!table)
        return next(new ErrorResponse('Please provide table', 400));

    if (!code)
        return next(new ErrorResponse('Please provide code', 400));

    const tableData = await Table.findOne({
        restaurant,
        _id: table,
        code
    })

    if (!tableData)
        return next(new ErrorResponse('Table not found', 404));

    const activeOrders = await ActiveOrder.findOne({
        restaurant,
        table,
        waiter: tableData.waiter,
    })
        .populate('products.product')
        .sort({createdAt: -1});

    const orders = await Order.findOne({
        restaurant,
        table,
        waiter: tableData.waiter,
    })
        .populate('products.product')
        .sort({createdAt: -1});

    let data = {
        activeOrder: [],
        order: orders
    }

    if (tableData.hasActiveOrder) {
        data.activeOrder = activeOrders;
    }

    res.status(200).json(data);
});

// @desc      Make order
// @route     POST /api/v1/client/orders
// @access    Private
exports.makeOrder = asyncHandler(async (req, res, next) => {
    const {restaurant, table, code} = req.body;
    if (!restaurant)
        return next(new ErrorResponse('Please provide restaurant', 400));

    if (!table)
        return next(new ErrorResponse('Please provide table', 400));

    if (!code)
        return next(new ErrorResponse('Please provide code', 400));

    const tableData = await Table.findOne({
        restaurant,
        _id: table,
        code
    })
    if (!tableData)
        return next(new ErrorResponse('Table not found', 404));

    const basket = await Basket.findOne({
        table: tableData._id,
        restaurant
    })

    let activeOrder = await ActiveOrder.findOne({
        restaurant,
        table,
        waiter: tableData.waiter,
    });

    if (!activeOrder) {
        activeOrder = await ActiveOrder.create({
            restaurant,
            table,
            waiter: tableData.waiter,
            products: basket.products
        });
    }

    activeOrder.products = activeOrder.products.concat(basket.products);
    await activeOrder.save();

    basket.products = [];
    await basket.save();

    if (!tableData.hasActiveOrder) {
        emitEventTo(tableData.waiter, 'newActiveOrder', activeOrder);
        emitEventTo(`directors-${restaurant}`, 'newActiveOrder', activeOrder);
    }

    tableData.hasActiveOrder = true;
    await tableData.save();

    const data = await ActiveOrder.findOne(activeOrder).populate('products.product');

    res.status(200).json(data);
});

// @desc      Add product to Basket
// @route     POST /api/v1/client/basket
// @access    Private
exports.addProductToBasket = asyncHandler(async (req, res, next) => {
    const {restaurant, table, code} = req.body;
    if (!restaurant)
        return next(new ErrorResponse('Please provide restaurant', 400));

    if (!table)
        return next(new ErrorResponse('Please provide table', 400));

    if (!code)
        return next(new ErrorResponse('Please provide code', 400));

    const tableData = await Table.findOne({
        restaurant,
        _id: table,
        code
    })

    if (!tableData)
        return next(new ErrorResponse('Table not found', 404));

    const basket = await Basket.findOne({
        restaurant,
        table,
    });

    if (!basket)
        return next(new ErrorResponse('Basket not found', 404));

    const {product, quantity} = req.body;

    basket.products.push({
        product,
        quantity
    });

    await basket.save();

    const data = await Basket.findOne(basket).populate('products.product');

    res.status(200).json(data);
});

// @desc    Update product in Basket
// @route   PUT /api/v1/client/basket/:id
// @access  Private
exports.updateProductInBasket = asyncHandler(async (req, res, next) => {
    const {restaurant, table, code, basketId} = req.body;
    if (!restaurant)
        return next(new ErrorResponse('Please provide restaurant', 400));

    if (!table)
        return next(new ErrorResponse('Please provide table', 400));

    if (!code)
        return next(new ErrorResponse('Please provide code', 400));

    const tableData = await Table.findOne({
        restaurant,
        _id: table,
        code
    })

    if (!tableData)
        return next(new ErrorResponse('Table not found', 404));

    const basket = await Basket.findOne({
        restaurant,
        table,
        _id: basketId
    });

    if (!basket)
        return next(new ErrorResponse('Basket not found', 404));

    const {quantity} = req.body;

    if (quantity <= 0) {
        basket.products = basket.products.filter(p => p.product !== product);
    } else {
        basket.products = basket.products.map(p => {
            if (p.product.toString() === product.toString()) {
                p.quantity = quantity;
            }
            return p;
        })
    }

    await basket.save();

    const data = await Basket.findOne(basket).populate('products.product');

    res.status(200).json(data);
});

// @desc      Remove product from Basket
// @route     DELETE /api/v1/client/basket/:id?restaurant=restaurant&table=table&code=code
// @access    Private
exports.removeProductFromBasket = asyncHandler(async (req, res, next) => {
    const {restaurant, table, code} = req.body;
    if (!restaurant)
        return next(new ErrorResponse('Please provide restaurant', 400));

    if (!table)
        return next(new ErrorResponse('Please provide table', 400));

    if (!code)
        return next(new ErrorResponse('Please provide code', 400));

    const tableData = await Table.findOne({
        restaurant,
        _id: table,
        code
    })

    if (!tableData)
        return next(new ErrorResponse('Table not found', 404));

    const basket = await Basket.findOne({
        restaurant,
        table,
    });

    if (!basket)
        return next(new ErrorResponse('Basket not found', 404));

    const productIndex = basket.products.findIndex(product => product._id.toString() === req.params.id);

    if (productIndex === -1)
        return next(new ErrorResponse('Product not found', 404));

    basket.products.splice(productIndex, 1);

    await basket.save();

    const data = await Basket.findOne(basket).populate('products.product');

    res.status(200).json(data);
});

// @desc      Clear Basket
// @route     DELETE /api/v1/client/basket/clear
// @access    Private
exports.clearBasket = asyncHandler(async (req, res, next) => {
    const {restaurant, table, code, basketId} = req.body;
    if (!restaurant)
        return next(new ErrorResponse('Please provide restaurant', 400));

    if (!table)
        return next(new ErrorResponse('Please provide table', 400));

    if (!code)
        return next(new ErrorResponse('Please provide code', 400));

    const tableData = await Table.findOne({
        restaurant,
        _id: table,
        code
    })

    if (!tableData)
        return next(new ErrorResponse('Table not found', 404));

    const basket = await Basket.findOneAndUpdate({
        restaurant,
        table,
        _id: basketId
    }, {
        products: [],
        totalPrice: 0
    }, {
        new: true,
        runValidators: true
    });

    res.status(200).json(basket);
});
