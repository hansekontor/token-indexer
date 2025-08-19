// Main router entry point, sets up all route modules

const express = require('express')
const router = express.Router()

const { getV1Router } = require('./v1Router');

module.exports = function initRouter(indexer) {
    router.use('/v1', getV1Router(indexer));
    return router;
}