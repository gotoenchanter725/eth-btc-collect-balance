const mongoose = require('mongoose');

const monitorAddressSchema = new mongoose.Schema({
    'address': {
        type: String,
        required: true,
    },
    'addressid': {
        type: String, 
    }, 
    "orderid": {
        type: String,
    }, 
    "type": {
        type: String, 
        default: 'default'
    }, 
    "step": {
        type: Number, 
        default: 0
    }, 
});

module.exports = mongoose.model('MonitorAddress', monitorAddressSchema);
