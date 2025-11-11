# Token Indexer for bcash node

This indexer is built as a plugin for the [bcash node](https://github.com/badger-cash/bcash). It indexes specified token transactions by hash and address. 

## Installation
Prerequisite is an installation of [Redis](https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/install-redis-on-linux/).


Clone this repository on an instance where this [bcash node](https://github.com/hansekontor/bcash) is installed. 

```
git clone https://github.com/hansekontor/token-indexer
```

Then install the module with 

```
cd token-indexer
npm install
```

Create a `.env` file and modify its properties according to your needs.

```
cp sample_env .env
nano .env
```

If you do not make any changes to the `.env`file, the token-indexer will later be running on `localhost:8000`.

If both, bcash and the token-indexer are available in the same path, the plugin can be attached to bcash with this command: 

```
${PWD}/bcash/bin/bcash --index-tx=true --index-address=true --index-slp=true --plugins=${PWD}/token-indexer/lib/plugin
```

## Endpoints
| Method | Endpoint                  | Description                                                                                        |
|--------|---------------------------|----------------------------------------------------------------------------------------------------|
| GET    | /tx/{hash}                | Returns transaction with slp data if it contains the token specified in `env`                      |
| GET    | /tx/address/{address}     | Returns all token transactions in which an address was involved                                    |
| GET    | /coin/address/{address}   | Returns all utxos for an address                                                                   |
| GET    | /rollback/{height} | Initiates `token-indexer` rollback to the specified height, endpoint can be restricted via API key |