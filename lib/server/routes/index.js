// Main router entry point, sets up all route modules

const express = require('express')
const router = express.Router()

const { getTxRouter } = require('./txRouter');
const { getCoinRouter } require('./coinRouter');

module.exports = function initRouter(indexer) {
    router.use('/tx', getTxRouter(indexer));
    router.use('/coins', getCoinRouter(indexer));
    return router;
}