const mongoose = require('mongoose');

const Product = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
        unique: true
    },
    description: {
        type: String,
        default: ''
    },
    photo: {
        type: String,
        default: 'no-photo.jpg'
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
    oldPrice: {
        type: Number,
        default: 0
    },
    sale: {
        type: Boolean,
        default: false
    },
    available: {
        type: Boolean,
        default: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    unit: {
        type: String,
        required: [true, 'Please add a unit']
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    }
}, {
    timestamps: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
});

module.exports = mongoose.model('Product', Product);