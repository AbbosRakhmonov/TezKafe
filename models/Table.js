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


module.exports = mongoose.model('Table', TableSchema);