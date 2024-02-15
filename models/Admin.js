const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, 'Please add a full name'],
            trim: true,
        },
        login: {
            type: String,
            required: [true, 'Please add a login'],
            unique: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Please add a password'],
            select: false,
        },
        role: {
            type: String,
            enum: ['admin'],
            default: 'admin',
        }
    },
    {
        timestamps: true,
    },
);

AdminSchema.pre('save', async function (next) {
    if (this.isModified('role')) {
        this.role = 'admin';
    }
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
AdminSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({
        id: this._id,
        role: this.role
    }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};

// Match user entered password to hashed password in database
AdminSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Admin', AdminSchema);
