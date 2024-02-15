const mongoose = require('mongoose');

const WaiterSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
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
    role: {
        type: String,
        enum: ['waiter'],
        default: 'waiter'
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

// Encrypt password using bcrypt
WaiterSchema.pre('save', async function (next) {
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
WaiterSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({
        id: this._id,
        role: this.role,
        restaurant: this.restaurant
    }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};

// Match user entered password to hashed password in database
WaiterSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Reverse populate with virtuals
WaiterSchema.virtual('tables', {
    ref: 'Table',
    localField: '_id',
    foreignField: 'waiter',
    justOne: false
});

WaiterSchema.virtual('orders', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'waiter',
    justOne: false
});

WaiterSchema.virtual('archiveOrders', {
    ref: 'ArchiveOrder',
    localField: '_id',
    foreignField: 'waiter',
    justOne: false
});

module.exports = mongoose.model('Waiter', WaiterSchema);