const mongoose = require('mongoose');

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
                    required: [true, 'Please add a name'],
                    trim: true,
                    unique: true
                },
                price: {
                    type: Number,
                    required: [true, 'Please add a price'],
                    validate: {
                        validator: function (v) {
                            return v > 0;
                        },
                        message: props => `${props.value} is not a valid price!`
                    }
                },
                unit: {
                    type: String,
                    required: [true, 'Please add a unit']
                },
            },
            quantity: {
                type: Number,
                required: true
            },
            price: {
                type: Number,
                required: true
            }
        },
    ],
    totalPrice: {
        type: Number,
        required: true
    },
    totalItems: {
        type: Number,
        default: 0
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('ArchiveOrder', ArchiveOrderSchema);