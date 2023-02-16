const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    'orderid': {
        type: String,
        required: true,
    },
    "created": {
        type: Number,
    },
    "from_addr": {
        type: String,
    },
    "final_address": {
        type: String,
    },
    "to_address": {
        type: String,
    },
    "from_currency": {
        type: String,
    },
    "to_currency": {
        type: String,
    },
    "max_input": {
        type: String,
    },
    "min_input": {
        type: String,
    },
    "network_fee": {
        type: String,
    },
    "svc_fee": {
        type: String,
    },
    "rate": {
        type: String,
    },
    "rate_mode": {
        type: String,
    },
    "state": {
        type: String,
    },
    "from_amount_received": {
        type: String,
    },
    "to_amount": {
        type: String,
    },
    "transaction_id_received": {
        type: String,
    },
    "transaction_id_sent": {
        type: String,
    },
    "double": {
        type: Boolean
    },
    "address1": {
        type: String,
    },
    "address2": {
        type: String,
    },
    "temp_address1": {
        type: String,
    },
    "temp_address2": {
        type: String,
    },
    "second_order": {
        type: String,
    },
    "step": {
        type: Number,
        default: 1
    },
    "createAt": {
        type: Date,
    },
    "requestAmount": {
        type: Number
    }, 
    "completeAt": {
        type: Date
    }
});

module.exports = mongoose.model('Transactions', transactionSchema);
