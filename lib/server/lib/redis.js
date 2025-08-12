require('dotenv').config()
const Redis = require('ioredis')
const rconf = {
    'host': process.env.REDIS_HOST,
    'port': process.env.REDIS_PORT,
    'password': process.env.REDIS_PASSWORD,
    'db': process.env.REDIS_DB,
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