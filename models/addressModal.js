const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    'type': {
        type: String,
        required: true,
    },
    "public": {
        type: String,
        required: true,
    },
    "private": {
        type: String,
        required: true,
    }, 
    "state": {
        type: Number, 
        default: 0
    }
});

module.exports = mongoose.model('Addresss', addressSchema);
