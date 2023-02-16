const mongoose = require('mongoose');

const monitorOrderSchema = new mongoose.Schema({
    "orderid": {
        type: String,
    },
    "type": {
        type: String
    },
    "step": {
        type: Number,
        default: 0
    },
});

module.exports = mongoose.model('MonitorOrder', monitorOrderSchema);