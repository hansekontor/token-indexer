// Main router entry point, sets up all route modules

const express = require('express')
const router = express.Router()

const { getTxRouter } = require('./txRouter');

module.exports = function initRouter(indexer) {
    router.use('/tx', getTxRouter(indexer));
    return router;
}