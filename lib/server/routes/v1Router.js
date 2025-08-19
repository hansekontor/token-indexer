// All v1 routes

const express = require('express');
const router = express.Router();

const { 
    getTokenTx, 
    getTokenTxsByAddress,
    getCoinsByAddress,
} = require('../controllers/txController');

module.exports = {
    getV1Router(indexer) {
        router.get('/tx/:hash', getTokenTx(indexer));
        router.get('/tx/address/:address', getTokenTxsByAddress(indexer));
        router.get('/coins/address/:address', getCoinsByAddress(indexer));

        return router;
    }
}