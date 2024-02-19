const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DirectorSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
    },
    avatar: {
        type: String,
        default: 'no-photo.jpg'
    },
    phone: {
        type: String,
        required: [true, 'Phone is required'],
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        trim: true,
        select: false
    },
    restaurant: {
        type: mongoose.Schema.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    role: {
        type: String,
        enum: ['director'],
        default: 'director'
    }
}, {
    timestamps: true,
});

DirectorSchema.pre('save', async function (next) {
    if (this.isModified('role')) {
        this.role = 'director';
    }

    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
DirectorSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({
        id: this._id,
        role: this.role,
        restaurant: this.restaurant
    }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};

// Match user entered password to hashed password in database
DirectorSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Director', DirectorSchema);