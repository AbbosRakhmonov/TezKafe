const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        unique: true,
        trim: true,
    },
    address: {
        type: String,
        required: [true, 'Please add an address']
    },
    location: {
        type: String,
        required: [true, 'Please add a location']
    },
    photo: {
        type: String,
        default: 'no-photo.jpg'
    },
}, {
    timestamps: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
});

RestaurantSchema.virtual('director', {
    ref: 'Manager',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: true
});

RestaurantSchema.virtual('waiters', {
    ref: 'Waiter',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

RestaurantSchema.virtual('tables', {
    ref: 'Table',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

RestaurantSchema.virtual('orders', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

RestaurantSchema.virtual('categories', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

RestaurantSchema.virtual('typeOfTables', {
    ref: 'TypeOfTable',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

RestaurantSchema.virtual('archiveOrders', {
    ref: 'ArchiveOrder',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

RestaurantSchema.virtual('products', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

module.exports = mongoose.model('Restaurant', RestaurantSchema);
