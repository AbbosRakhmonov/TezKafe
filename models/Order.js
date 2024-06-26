const mongoose = require('mongoose');
const Product = require('./Product');
const ErrorResponse = require('../utils/errorResponse');
const moment = require('moment-timezone');

const OrderSchema = new mongoose.Schema({
    table: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table',
        required: true
    },
    waiter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Waiter',
        required: true
    },
    products: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            createdAt: {
                type: Date,
                default: moment().tz('Asia/Tashkent').format()
            }
        }
    ],
    totalPrice: {
        type: Number,
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    createdAt: {
        type: Date,
        default: moment().tz('Asia/Tashkent').format()
    },
    updatedAt: {
        type: Date,
        default: moment().tz('Asia/Tashkent').format()
    }
}, {
    timestamps: true
});

OrderSchema.pre('save', async function (next) {
    let totalPrice = 0;
    if (!this.products || this.products.length === 0) {
        this.totalPrice = totalPrice;
        return next();
    }

    // combine double products and update quantity and price
    const newProducts = [];
    this.products.forEach(product => {
        const existProduct = newProducts.find(p => p.product.toString() === product.product.toString());
        if  (existProduct) {
            existProduct.quantity += product.quantity;
            existProduct.createdAt = moment().tz('Asia/Tashkent').format();
        } else {
            newProducts.push(product);
        }
    });

    await Promise.all(newProducts.map(async product => {
        const existProduct = await Product.findOne({
            _id: product.product,
            restaurant: this.restaurant,
            available: true
        })
        if (!existProduct) {
            return next(new ErrorResponse(`The product with id ${product.product} is not available`, 400));
        }
        product.price = existProduct.price * product.quantity;
        totalPrice += product.price
    }))

    this.totalPrice = totalPrice;
    this.products = newProducts;

    next();
});

module.exports = mongoose.model('Order', OrderSchema);