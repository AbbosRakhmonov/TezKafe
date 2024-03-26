const cron = require('node-cron');
const Table = require('../models/Table');
const {emitEventTo} = require('../listeners/socketManager');

const declineCall = async () => {
    // find the table callTime is more than or equal to 3 minutes ago
    const tables = await Table.find({
        $or: [
            {callTime: {$lte: new Date(Date.now() - 1 * 60 * 1000)}, call: 'calling'},
            {callTime: null, call: 'calling'}
        ]
    });
    if (tables.length > 0) {
        for (let table of tables) {
            // Update the table here as needed
            // For example, let's set the call to 'none'
            table.call = 'none';
            if (table.waiter) {
                //     emit event and stop
                emitEventTo(table.waiter, 'activeCall', {
                    _id: table._id,
                });
                emitEventTo(`directors-${table.restaurant}`, 'activeCall', {
                    _id: table._id,
                });
                break;
            }
            table.callId = null;
            table.callTime = null;
            await table.save();

            // Emit an event to notify that the table has been updated
            emitEventTo(`table-${table._id}`, 'callDeclined', {
                _id: table._id,
            });
            emitEventTo(`waiters-${table.restaurant}`, 'callDeclined', {
                _id: table._id,
            });
        }
    }
}

// Schedule the task to run every 3 minutes
cron.schedule('*/1 * * * *', declineCall);

module.exports = declineCall;