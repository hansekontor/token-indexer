const { setCache, getCache } = require("../lib/redis");

function validateHeader(req) {
        return true;
}

module.exports = {
    rollbackIndexer(indexer) {
        return async function(req, res) {
            const isValidHeader = validateHeader(req);
            if (!isValidHeader) {
                return res.send("Invalid Header");
            }

            const height = req.params.height;
            indexer.syncing = true;
            await indexer._rollback(height);
            indexer.syncing = false;
            indexer.sync();

            return res.send(`token-indexer rolled back to height ${height}`);            
        }
    }
}