// All tx routes

const express = require('express');
const router = express.Router();

const { 
    getTokenTx, 
    getTokenTxsByAddress,
} = require('../controllers/txController');

module.exports = {
    getTxRouter(indexer) {
        router.get('/tx/:hash', getTokenTx(indexer));
        router.get('/tx/address/:address', getTokenTxsByAddress(indexer));

        return router;
    }
}