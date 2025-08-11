'use strict';

const TokenIndexer = require('./indexer/tokenindexer');

module.exports = class IndexerPlugin {
    constructor(options) {
		this.tokenIndexer = new TokenIndexer(options);
    }
}
