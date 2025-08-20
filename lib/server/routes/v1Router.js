// All v1 routes

const express = require('express');
const router = express.Router();

const { 
    getTokenTx, 
    getTokenTxsByAddress,
    getCoinsByAddress,
} = require('../controllers/v1Controller');

module.exports = {
    getV1Router(indexer) {
        router.get('/tx/:hash', getTokenTx(indexer));
        router.get('/tx/address/:address', getTokenTxsByAddress(indexer));
        router.get('/coin/address/:address', getCoinsByAddress(indexer));

        return router;
    }
}