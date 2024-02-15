const mongoose = require('mongoose');

const TypeOfTableSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    }
});

// Virtuals
TypeOfTableSchema.virtual('tables', {
    ref: 'Table',
    localField: '_id',
    foreignField: 'typeOfTable'
});

module.exports = mongoose.model('TypeOfTable', TypeOfTableSchema);