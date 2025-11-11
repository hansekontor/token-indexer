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
    getCoinsByAddress(indexer) {
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
            const key = `${addrString}-c`;
            
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

            const utxos = await indexer.getUtxosByAddress(addrString);
            
            try {
                await setCache(addrString, JSON.stringify(utxos), 9);
            } catch(err) {
                console.error(err);
            }

            return res.json(utxos);
        }
    },
}