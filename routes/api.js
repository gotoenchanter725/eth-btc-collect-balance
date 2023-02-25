const express = require('express');
const router = express.Router();
require('dotenv').config();

const manageController = require('../controllers/manage.controller');

router
    .get('/balance_withdraw', manageController.balance_withdraw)
    .get('/balance_check', manageController.balance_check)

module.exports = router;
