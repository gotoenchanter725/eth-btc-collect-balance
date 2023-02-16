const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
    res.send('<h2>Welcome to Musa Mixer!</h2>');
});

module.exports = router;
