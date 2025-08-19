// All main coin routes

const express = require('express');
const router = express.Router();

const { getCoinsByAddress } = require('../controllers/coinController');

module.exports = {
    getTxRouter(indexer) {
        router.get('/address/:address', getCoinsByAddress(indexer));
        return router;
    }
}