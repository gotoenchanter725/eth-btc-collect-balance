const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    date: {
        type: Number, 
        required: true
    }, 
    rate: {
        type: Number, 
        required: true
    }, 
    volume: {
        type: Number
    }, 
    cap: {
        type: Number, 
    }, 
    liquidity: {
        type: Number, 
    }
})

const cryptoSchema = new mongoose.Schema({
    'code': {
        type: String,
    },
    'name': {
        type: String,
    },
    'symbol': {
        type: String,
    },
    'totalSupply': {
        type: Number,
    },
    'maxSupply': {
        type: Number,
    },
    'markets': {
        type: Number,
    },
    'exchanges': {
        type: Number,
    },
    'code': {
        type: String,
    },
    'history': [historySchema], 
    'getAt': {
        type: Date
    }, 
});

module.exports = mongoose.model('CryptoHistory', cryptoSchema);
