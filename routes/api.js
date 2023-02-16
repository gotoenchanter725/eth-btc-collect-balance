const express = require('express');
const router = express.Router();
require('dotenv').config();

const manageController = require('../controllers/manage.controller');

router
    .get('/check_balance', manageController.check_balance)
    .get('/test', manageController.test)

module.exports = router;
