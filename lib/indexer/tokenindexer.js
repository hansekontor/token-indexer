/*!
 * indexer.js - token indexer for bcoin
 * Copyright (c) 2025, Olav (MIT License).
 */

'use strict';

const bdb = require('bdb');
const bcash = require('bcash');
const {
	Indexer,
    BlockMeta, 
	Block, 
	CoinView, 
	Address,
	Coin,
	TXMeta,
	MTX,
} = bcash;
const { U64 } = require('n64');
const assert = require('assert');

const layout = require('./layout');
const { 
	Count, 
	BlockRecord 
} = require('./records');

/**
 * Tx
 *  t[hash] -> hash index (to check if it is an token indexed tx)
 * 	T[hash index] -> hash ?
 * 	B[height] -> block record ?
 * 
 * Address
 *  A[addr-prefix][addr-hash][height][index] -> dummy
 *  C[height][index] -> hash
 * 	c[hash] -> height + index
 */

// add tokenindex layout 
Object.assign(layout, {
	A: bdb.key('M', ['uint8', 'hash', 'uint32', 'uint32']),
	C: bdb.key('C', ['uint32', 'uint32']),
	c: bdb.key('c', ['hash256']),
	T: bdb.key('D', ['uint32']),
	t: bdb.key('d', ['hash256']),
	B: bdb.key('I', ['uint32']),
  });

/**
 * Increment 32-bit big endian
 * @param {Buffer} hashIndBuf
 * @returns {Buffer}
 */
function incrementUInt32BE (hashIndBuf) {
	// console.log("incrementUINT32BE with hashIndBuf", hashIndBuf);
	assert(hashIndBuf.length == 4, 'Buffer length must be 4 bytes')

	const newNumData = Buffer.alloc(4);
	// console.log("newNumData", newNumData);
	const hashIndNum = U64.readBE(hashIndBuf, -4).addn(1);
	// console.log("hashIndNum", hashIndNum);
	assert(hashIndNum.lte(U64.UINT32_MAX), 'Increment limit reached for UInt32')

	hashIndNum.writeBE(newNumData, -4);
	// console.log("hashIndNum", hashIndNum);
	// console.log("returning newNumData", newNumData);
	return newNumData
}

/**
 * 32-bit big endian to Number (int)
 * @param {Buffer} hashIndBuf
 * @returns {Number}
 */
function uInt32BEToInt (hashIndBuf) {
	// console.log("uInt32ToInt with hashIndBuf", hashIndBuf);
	assert(hashIndBuf.length == 4, 'Buffer length must be 4 bytes');
  
	const hashIndInt = U64.readBE(hashIndBuf, -4).toInt();
	assert(typeof hashIndInt == 'number');
  
	return hashIndInt;
  }



/**
 * TokenIndexer
 * @alias module:indexer.TokenIndexer
 * @extends Indexer
 */

class TokenIndexer extends Indexer {
    /**
     * Create a indexer
     * @constructor
     * @param {Object} options
     */
  
    constructor(options) {
		super('token', options);

		this.db = bdb.create(this.options);
		this.txindex = options.txindex;
		this.slpindex = options.slpindex;
		this.mempool = options.mempool;
		this.chain = options.chain;
		this.maxTxs = 100;
    }
  
    /**
     * Index token txs.
     * @private
     * @param {BlockMeta} meta
     * @param {Block} block
     * @param {CoinView} view
    */
    async indexBlock(meta, block, view) {
		assert(block.hasRaw(), 'Expected raw data for block.');

		// skip blocks prior to first issue tx
		const height = meta.height;		
		if (height < 866600) {
			return;
		}

		const bblock = block.txs[0]._block ? block : Block.fromRaw(block.toRaw());
		const lastHashIndex = await this.getLastHashIndex(meta.height);
		let brecord = new BlockRecord({
			start: lastHashIndex,
			last: lastHashIndex
		});

		// iterate through block's txs
        for (let i = 0; i < bblock.txs.length; i++) {
            const tx = bblock.txs[i];

			// check if this tx has the relevant token
			const hasRelevantToken = await validateTokenTx(tx);

			if (hasRelevantToken) {
				// increase brecord.last
				const hash = tx.hash();
				const hashIndex = await this.getHashIndex(hash, brecord);
				const hashIndexInt = uInt32BEToInt(hashIndex);
				const lastHashIndexInt = uInt32BEToInt(brecord.last);
				if (hashIndexInt > lastHashIndexInt) {
					brecord.last = hashIndex;
				}
				
				// put tx to database
				await this.db.put(layout.T.encode(hashIndexInt), hash);
				await this.db.put(layout.t.encode(hash), hashIndexInt);

				// if yes index the address
				const count = new Count(height, i);
				let hasAddress = false;
				for (const address of addresses) {
					const prefix = addr.getPrefix(this.network.type);
					if (prefix < 0)
						continue;
			
					const addrHash = addr.getHash();
					this.db.put(layout.A.encode(prefix, addrHash, height, i), null);
					
					hasAddress = true;
				}

				if (hasAddress) {
					await this.db.put(layout.C.encode(height, i), hash);
					await this.db.put(layout.c.encode(hash), count.toRaw());
				}
			} 
		}
		
		// index brecord
		this.db.put(layout.B.encode(meta.height), brecord.toRaw());
	}
  
    /**
     * Remove addresses from index.
     * @private
     * @param {BlockMeta} meta
     * @param {Block} block
     * @param {CoinView} view
     */
    async unindexBlock(meta, block, view) {
		// issue txs can simply be deleted
		const height = meta.height;
		const rawBrecord = await this.db.get(layout.B.encode(height));
		if (rawBrecord) {
			const brecord = BlockRecord.fromRaw(rawBrecord);

			// iterate through hash indexes in block record
			const start = 1 + uInt32BEToInt(brecord.start);
			const end = uInt32BEToInt(brecord.last);
			for (let i = start; i <= end; i++) {

				// delete hash index <-> hash entries
				const hashIndexInt = i;
				const hash = await this.db.get(layout.T.encode(hashIndexInt));
				
				await this.db.del(layout.t.encode(hash));
				await this.db.del(layout.T.encode(hashIndexInt));

				// delete address entries
				const meta = await this.txindex.getMeta(hash);
				const tx = MTX.fromOptions(meta.tx);
				const addresses = tx.getAddresses(view);

				let hasAddress = false;

				for (const addr of addresses) {
					const prefix = addr.getPrefix(this.network);

					if (prefix < 0)
						continue;

					const addrHash = addr.getHash();

					this.del(layout.A.encode(prefix, addrHash, height, i));

					hasAddress = true;
				}

				if (hasAddress) {
					this.del(layout.C.encode(height, i));
					this.del(layout.c.encode(hash));
				}
			}

			// delete block record
			this.db.del(layout.B.encode(meta.height));
		}
    }

	/**
	 * Get tx for relevant tokens
	 * @param {Buffer} hash 
	 * @returns 
	 */
	async getTx(hash) {
		// todo: check mempool

		// tx is relevant token tx if hash index exists for it
		const hashIndex = await this.db.get(layout.t.encode(hash));
		if (!hashIndex) {
			return;
		}

		const meta = await this.txindex.getMeta(hash);
		meta.tx = await this.addSlpInfoToTx(meta.tx);
		const metaJson = this.getMetaJson(meta);

		return metaJson;
	}

	/**
	 * Gets relevant token txs by address
	 * @param {Address | string} addr 
	 * @returns 
	 */
	async getTxsByAddress(addr) {
		if (typeof addr === "string")
			addr = new Address(addr);

		const limit = this.maxTxs;
		const metas = await this.getMetaByAddress(addr, limit);
		
		let metasJson = [];
		for (const meta of metas) {
			const metaJson = this.getMetaJson(meta);
			metasJson.push(metaJson);
		}

		return metasJson;
	}

	async validateTokenTx(tx, bmeta) {
		// get tx json with slp data
		const meta = TXMeta.fromTX(tx);
    	meta.height = bmeta.height;
    	meta.block = bmeta.block;
    	meta.time = bmeta.time;
    	meta.index = bmeta.index;
		meta.tx = await this.addSlpInfoToTx(meta.tx);
		const metaJson = this.getMetaJson(meta);
		
		const relevantTokens = ["0dbbeca4adccfbf4820c0a748ea5921204bed98e319bbd0879f7010d4297ed31"];
		const hasRelevantToken = relevantTokens.includes(metaJson.slpToken?.tokenId);

		return hasRelevantToken;
	}

	/**
	 * Gets tx metas by address from db and mempool
	 * @param {Address} addr 
	 * @param {number} limit 
	 * @returns 
	 */
	async getMetaByAddress(addr, limit = 100) {
		const reverse = false;
		const after = false;
		//   const {reverse, after} = options;
		//   let {limit} = options;
	  
		let metas = [];
	
		const getConfirmedMetas = async () => {
			const hashes = await this.getHashesByAddress(addr, limit);
	
			for (const hash of hashes) {
				const mtx = await this.txindex.getMeta(hash);
				assert(mtx);
				metas.push(mtx);
			}
		};
	  
		const getUnconfirmedMetas = () => {
			const mempool = this.mempool.getMetaByAddress(
				addr, {limit, reverse, after});	
	
			metas = metas.concat(mempool);
		};
	  
		if (reverse)
			getUnconfirmedMetas();
		else
			await getConfirmedMetas();
	  
		if (limit && metas.length > 0)
			limit -= metas.length;
	  
		// If more transactions can still be added
		if (!limit || limit > 0) {
			if (reverse)
			  	await getConfirmedMetas();
			else
			  	getUnconfirmedMetas();
		}
	  
		// add slp info
		for (let i = 0; i < metas.length; i++) {
			metas[i].tx = await this.addSlpInfoToTx(metas[i].tx)
		}
	  
		return metas;
	}	

	/**
	 * Get tx hashes by address in requested order
	 * @param {Address} addr 
	 * @param {number} limit 
	 * @returns 
	 */
	async getHashesByAddress(addr, limit) {
		const after = false;
		const reverse = true;
		// const {after, reverse} = options;
		// let {limit} = options;
	
		if (!limit)
		  limit = this.maxTxs;
	
		if (limit > this.maxTxs)
		  throw new Error(`Limit above max of ${this.maxTxs}.`);
	
		const hash = Address.getHash(addr);
		const prefix = addr.getPrefix(this.network.type);

		let opts = {
			limit, 
			reverse,
			parse: (key) => {
				const [,, height, index] = layout.A.decode(key);
				return [height, index];
			}
		};

		// Determine if the hash -> height + index mapping exists.
		const hasAfter = (after && await this.db.has(layout.c.encode(after)));
	
		// Check to see if results should be skipped because
		// the after hash is expected to be within a following
		// mempool query.
		const skip = (after && !hasAfter && !reverse);
		if (skip)
		  	return [];
	
		if (after && hasAfter) {
			// Give results starting from after
			// the tx hash for the address.
			const raw = await this.db.get(layout.c.encode(after));
			const count = Count.fromRaw(raw);
			const {height, index} = count;
		
			if (!reverse) {
				opts.gt = layout.A.min(prefix, hash, height, index);
				opts.lte = layout.A.max(prefix, hash);
			} else {
				opts.gte = layout.A.min(prefix, hash);
				opts.lt = layout.A.max(prefix, hash, height, index);
			}
		} else {
			// Give earliest or latest results
			// for the address.
			opts.gte = layout.A.min(prefix, hash);
			opts.lte = layout.A.max(prefix, hash);
		}
	
		const txs = await this.db.keys(opts);
		const hashes = [];
	
		for (const [height, index] of txs)
		  	hashes.push(await this.db.get(layout.C.encode(height, index)));


		return hashes;
	}
	
	/**
   * Get last transaction hash index used in the most recently indexed block
   * @param {Number} currentHeight height of current block being indexed
   * @param {String} type - either "issue" or "redeem" type to access relevant db
   * @returns {Promise} - Returns UInt32 buffer representing last hash index
   */
	async getLastHashIndex(height, type) {
		assert(type == 'issue' || type == 'redeem', "type must be either 'issue' or 'redeem'");

		const prevHeight = height && height > 0 ? height - 1 : 0;
		let prevBlockDb;

		if (type === 'issue') 
			prevBlockDb = await this.db.get(layout.I.encode(prevHeight));
		else 
			prevBlockDb = await this.db.get(layout.P.encode(prevHeight));

		console.log("prevBlockDb", prevBlockDb);

		if (!prevBlockDb)
		  return Buffer.alloc(4, 0x00);
	
		const prevBlockRecord = BlockRecord.fromRaw(prevBlockDb);
		console.log("prevBlockRecord", prevBlockRecord);
		
		return prevBlockRecord.last
	}

	/**
	 * Retrieve a SLP info from the mempool or chain database
	 * and add it to tx
	 * @param {Tx} tx the tx to use 
	 * @returns {Promise} - Returns {@link TX}
	 */
	async addSlpInfoToTx(tx) {
		if (!tx)
			return tx;
		  
		  const hash = tx.hash();
		  const records = await this.getSlpCoinRecords(hash);
		  
		  // Add slp records to outputs and token info to tx
		  if (records.length > 0) {
			// Ignore unsupported SLP types (ie. NFT1)
			if (!records[0].tokenId)
			  return tx;
			  
			const tokenIdHash = Buffer.from(records[0].tokenId).reverse();
			const tokenRecord = await this.getSlpTokenRecord(tokenIdHash);
			tx.slpToken = tokenRecord;
	  
			for (let i = 0; i < tx.outputs.length; i++) {
			  const recordForIndex = records.find(r => i == r.vout);
			  if (recordForIndex)
				tx.outputs[i].slp = recordForIndex;
			}
		  }
	  
		  return tx;
	}

  	/**
	 * Retrieve a SLP info for a transaction from the mempool or chain database.
	 * @param {Hash} hash
	 * @returns {Promise} - Returns {@link TokenRecord | SLPCoinRecord}[]
	 */
	async getSlpCoinRecords(hash) {
		if (this.slpindex) {
			const memRecords = this.mempool.getSlp(hash);
			if (memRecords)
				  return memRecords;
	  
			const dbRecords = await this.slpindex.getSlpCoinRecords(hash);
			if (dbRecords)
				  return dbRecords;
		  }
	  
		  return [];
	}

	/**
	 * Retrieve a SLP Token info from the mempool or chain database.
	 * @param {Hash} hash the token ID for the token 
	 * @returns {Promise} - Returns {@link TokenRecord}
	 */
	async getSlpTokenRecord(hash) {

		if (this.slpindex) {
			// const memRecords = this.mempool.getSlp(hash);
			// if(memRecords && memRecords.length > 0) {
			//   const memRecord = memRecords.find(r => r.decimals != undefined);
			//   // console.log('memRecord', memRecord)
			//   if (memRecord)
			// 	return memRecord;
			// }
	  
			const dbRecord = await this.slpindex.getTokenRecord(hash);
			// console.log('dbRecord', dbRecord)
			if (dbRecord)
			  return dbRecord;
		  }
	  
		  return null;
	}

	/**
	 * Return a tx json with slp details ready to send as response
	 * @param {TXMeta} meta
	 * @returns {JSON} - tx json 	
	 **/
	async getMetaJson(meta) {
		const view = await this.getMetaView(meta);
        const metaJson = meta.getJSON(this.network.type, view, this.chain.height);
		for (let i = 0; i < metaJson.inputs.length; i++) {
			metaJson.inputs[i].coin.hash = metaJson.inputs[i].prevout.hash;
			metaJson.inputs[i].coin.index = metaJson.inputs[i].prevout.index;
			const coin = Coin.fromJSON(metaJson.inputs[i].coin);
			const slpCoin = await this.addSlpInfoToCoin(coin);
			metaJson.inputs[i].coin = slpCoin.toJSON();
		}

		return metaJson;
	}

	/**
	 * Retrieve a spent coin viewpoint from mempool or chain database.
	 * @param {TXMeta} meta
	 * @returns {Promise} - Returns {@link CoinView}.
	 */
	async getMetaView(meta) {
		// if (meta.height === -1)
		// 	return this.mempool.getSpentView(meta.tx);
	  
		const spentView = await this.txindex.getSpentView(meta.tx);

		return spentView;
	}
	
	/**
	 * Retrieve a SLP info from the mempool or chain database
	 * and add it to coin
	 * @param {Coin} coin the coin to use
	 * @returns {Promise} - Returns {@link TX}
	 */
	async addSlpInfoToCoin(coin) {
		if (!coin) 
			return coin;
		  
		  const records = await this.getSlpCoinRecords(coin.hash);
		  // Add slp records to coin
		  if (records.length > 0)
			coin.slp = records.find(r => coin.index == r.vout);
	  
		  return coin;
	}


}
  
  module.exports = TokenIndexer;
