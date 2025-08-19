const path = require('path');
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB } = require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const Redis = require('ioredis')
const rconf = {
    'host': REDIS_HOST,
    'port': REDIS_PORT,
    'password': REDIS_PASSWORD,
    'db': REDIS_DB,
}

const redis = new Redis(rconf);

/**
 * Redis key-value pairs
 * address -> txs for this address
 * hash -> tx for this hash
 */

module.exports.setCache = async (key, value, expiry) => {
    return redis.set(key, value, "EX", expiry)
}

module.exports.getCache = async (key) => {
    return redis.get(key)
}