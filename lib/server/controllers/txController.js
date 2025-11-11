require('dotenv').config();
const bcash = require('bcash');
const {
    Address
} = bcash;
const Validator = require('bval');
const { setCache, getCache } = require("../lib/redis");

function validateHeader(req) {
        return true;
}

module.exports = {
    getTokenTx(indexer) {
        return async function(req, res) {
            // validate header
            const isValidHeader = await validateHeader(req);
            if (!isValidHeader) {
                res.status(400);
                return res.send("Invalid Header");
            }

            // validate hash input
            const valid = Validator.fromRequest(req);
            const brhash = valid.brhash('hash');
            if (!brhash) {
                res.status(400);
                return res.send("Invalid hash");

            }
            const key = brhash.toString('hex');

            // get cache if available
            try {
                const result = await getCache(key);
                const cachedResult = JSON.parse(result);
                if (cachedResult)
                    return res.json(cachedResult);
            } catch(err) {
                console.error(err);
            }

            // get tx data
            const tx = await indexer.getTx(brhash);
            if (!tx) {
                res.status(400);
                return res.send("No tx found");  
            }

            // set tx data to cache
            try {
                const value = JSON.stringify(tx);
                const ttl = 60
                await setCache(key, value, ttl);
            } catch(err) {
                console.error(err);
            }

            return res.json(tx);
        }
    },
    getTokenTxsByAddress(indexer) {
        return async function(req, res) {
            // validate header
            const isValidHeader = await validateHeader(req);
            if (!isValidHeader) {
                res.status(400);
                return res.send("Invalid Header");
            }

            // validate address input
            const valid = Validator.fromRequest(req);
            const addrString = valid.str('address');
            const address = new Address(addrString);
            if (!address) {
                res.status(400);
                return res.send("Invalid Address");
            }
            const key = addrString;

            // get cache if available
            try {
                const result = await getCache(key);
                const cachedResult = JSON.parse(result);
                if (cachedResult) {
                    return res.json(cachedResult);
                }
            } catch(err) {
                console.error(err);
            }

            // get txs by address
            const txs = await indexer.getTxsByAddress(address);

            // set address txs to cache
            try {
                const value = JSON.stringify(txs);
                const ttl = 30;
                await setCache(key, value, ttl);
            } catch(err) {
                console.error(err);
            }

            return res.json(txs);
        }
    },
}