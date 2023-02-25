const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
    res.send('<h2>Welcome to Balance Withdrawer!</h2>');
});

module.exports = router;