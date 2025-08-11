// All main tx routes

const express = require('express');
const router = express.Router();

const { getTokenTx, getTokenTxsByAddress } = require('../controllers/txController');

module.exports = {
    getTxRouter(indexer) {
        router.get('/:hash', getTokenTx(indexer));
        router.get('/address/:address', getTokenTxsByAddress(indexer));
        return router;
    }
}