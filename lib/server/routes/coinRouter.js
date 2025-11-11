// All coin routes

const express = require('express');
const router = express.Router();

const { getCoinsByAddress } = require('../controllers/coinController');

module.exports = {
    getCoinRouter(indexer) {
        router.get('/address/:address', getCoinsByAddress(indexer));

        return router;
    }
}