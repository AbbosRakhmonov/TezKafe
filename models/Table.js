const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    typeOfTable: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TypeOfTable',
        required: true
    },
    occupied: {
        type: Boolean,
        default: false
    },
    setWaiterByAdmin: {
        type: Boolean,
        default: false
    },
    waiter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Waiter',
        default: null,
    },
    code: {
        type: String,
        required: true,
        default: '0000',
        minlength: [4, 'Code must be 4 characters long'],
        maxlength: [4, 'Code must be 4 characters long'],
        select: false
    },
    call: {
        type: String,
        enum: ['calling', 'accepted', 'none'],
        default: 'none'
    },
    callId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Waiter',
        default: null,
    },
    callTime: {
        type: Date,
        default: null
    },
    hasActiveOrder: {
        type: Boolean,
        default: false
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    qrCode: {
        type: String,
    }
}, {
    timestamps: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
});

// Reverse populate with virtuals
TableSchema.virtual('archiveOrders', {
    ref: 'ArchiveOrder',
    localField: '_id',
    foreignField: 'table',
    justOne: false
});

TableSchema.virtual('activeOrders', {
    ref: 'ActiveOrder',
    localField: '_id',
    foreignField: 'table',
    justOne: false
});

TableSchema.virtual('totalOrders', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'table',
    justOne: false
});

// Create a virtual property `activePrice` that is the sum of all the prices of the active orders
TableSchema.virtual('activePrice').get(function () {
    let activePrice = 0;
    if (this.activeOrders && this.activeOrders.length > 0) {
        this.activeOrders.forEach(order => {
            activePrice += order.totalPrice;
        })
    }
    return activePrice;
});

// Create a virtual property `activeItems` that is the sum of all the items of the active orders
TableSchema.virtual('activeItems').get(function () {
    let activeItems = 0;
    if (this.activeOrders && this.activeOrders.length > 0) {
        this.activeOrders.forEach(order => {
            activeItems += order.totalItems;
        })
    }
    return activeItems;
});

// Create a virtual property `totalPrice` that is the sum of all the prices of the total orders
TableSchema.virtual('totalPrice').get(function () {
    let totalPrice = 0;
    if (this.totalOrders && this.totalOrders.length > 0) {
        this.totalOrders.forEach(order => {
            totalPrice += order.totalPrice;
        })
    }
    return totalPrice;
});

// Create a virtual property `totalItems` that is the sum of all the items of the total orders
TableSchema.virtual('totalItems').get(function () {
    let totalItems = 0;
    if (this.totalOrders && this.totalOrders.length > 0) {
        this.totalOrders.forEach(order => {
            totalItems += order.totalItems;
        })
    }
    return totalItems;
});

module.exports = mongoose.model('Table', TableSchema);