const mongoose = require('mongoose');
const moment = require('moment-timezone');

const ArchiveOrderSchema = new mongoose.Schema({
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
    totalOrders: [
        {
            product: {
                name: {
                    type: String,
                    trim: true,
                },
                price: {
                    type: Number,
                },
                unit: {
                    type: String,
                },
            },
            quantity: {
                type: Number,
            },
            price: {
                type: Number,
            }
        },
    ],
    totalPrice: {
        type: Number,
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    createdAt: {
        type: Date,
        default: moment().tz('Asia/Tashkent').format()
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ArchiveOrder', ArchiveOrderSchema);