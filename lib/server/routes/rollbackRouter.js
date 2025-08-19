// Rollback route

const express = require('express');
const router = express.Router();

const { 
    rollbackIndexer
} = require('../controllers/rollbackController');

module.exports = {
    getV1Router(indexer) {
        router.get('/rollback/:hash', rollbackIndexer(indexer));

        return router;
    }
}