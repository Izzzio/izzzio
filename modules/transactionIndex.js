/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const sqlite3 = require('sqlite3').verbose();
const logger = new (require('./logger'))();
const storj = require('./instanceStorage');
const utils = require('./utils');
const fs = require('fs-extra');

const MessagesDispatcher = require('./messagesDispatcher');

/**
 * Transaction Indexer
 */
class TransactionIndex {
    constructor(config) {
        this.config = config;
        this.dbPath = config.transactionIndexDB;
        this.isFast = true;
        this.perfPath = '';
        this.blocksIndex = [];

        this.indexDisabled = !this.config.transactionIndexEnable;

        if(this.indexDisabled) {
            return;
        }


        if(!this.dbPath) {
            this.dbPath = ':memory:';
            this.perfPath = 'transactionIndex.json';
        } else {
            this.isFast = false;
            this.perfPath = this.dbPath + '_TI.json';
            this.dbPath = this.config.workDir + '/' + this.dbPath;
            logger.warning('Building transactions index structure on drive may take lot of time');
        }


        if(this.config.transactionIndexPerf) {
            logger.warning('Performance preIndex mode enabled');

            if(this.dbPath !== ':memory:') {
                try {
                    this.blocksIndex = JSON.parse(fs.readFileSync(this.config.workDir + '/' + this.perfPath));
                } catch (e) {
                }
            }

        }


    }

    initialize(cb) {
        if(this.indexDisabled) {
            if(typeof cb !== 'undefined') {
                cb();
            }
            return;
        }

        let that = this;
        logger.info('Transactions index initialize...');
        this.db = new sqlite3.Database(this.dbPath);

        that.db.serialize(function () {
            /* that.db.run("CREATE TABLE IF NOT EXISTS `wallets` (\n" +
                 "  `id` INT NOT NULL AUTO_INCREMENT,\n" +
                 "  `block` INT NOT NULL,\n" +
                 "  `address` VARCHAR(255) NOT NULL,\n" +
                 "  PRIMARY KEY (`id`),\n" +
                 "  UNIQUE INDEX `address_UNIQUE` (`address` ASC),\n" +
                 "  UNIQUE INDEX `block_UNIQUE` (`block` ASC));\n");*/
            that.db.run("CREATE TABLE IF NOT EXISTS  `wallets` (\n" +
                "\t`id`\tINTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,\n" +
                "\t`block`\tINTEGER NOT NULL UNIQUE,\n" +
                "\t`address`\tTEXT NOT NULL UNIQUE\n" +
                ");");

            that.db.run("CREATE UNIQUE INDEX IF NOT EXISTS  `wallets_block` ON `wallets` ( `address` )");
            that.db.run("CREATE UNIQUE INDEX IF NOT EXISTS  `wallets_address` ON `wallets` ( `address` )");
            that.db.run("CREATE TABLE IF NOT EXISTS  `transactions` (\n" +
                "\t`id`\tINTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,\n" +
                //  "\t`transaction_id`\tINTEGER NOT NULL,\n" +
                "\t`block`\tINTEGER NOT NULL,\n" +
                "\t`from_id`\tINTEGER NOT NULL,\n" +
                "\t`to_id`\tINTEGER NOT NULL,\n" +
                "\t`from_address`\tTEXT NOT NULL,\n" +
                "\t`to_address`\tTEXT NOT NULL,\n" +
                "\t`amount`\tNUMERIC NOT NULL,\n" +
                "\t`timestamp`\tTEXT NOT NULL,\n" +
                "\t`from_timestamp`\tTEXT NOT NULL,\n" +
                "\t`transaction_hash`\tTEXT NOT NULL\n" +
                ");");

            that.db.run("CREATE TABLE IF NOT EXISTS `blockIndex` (\n" +
                "\t`id`\tINTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,\n" +
                "\t`type`\tTEXT NOT NULL,\n" +
                "\t`hash`\tTEXT NOT NULL,\n" +
                "\t`index`\tINTEGER NOT NULL UNIQUE\n" +
                ");");

            /*that.db.run("CREATE TABLE IF NOT EXISTS `transactions` (\n" +
                "  `id` INT NOT NULL AUTO_INCREMENT,\n" +
                "  `transaction_id` INT NOT NULL,\n" +
                "  `block` INT NOT NULL,\n" +
                "  `from_id` INT NOT NULL,\n" +
                "  `to_id` INT NOT NULL,\n" +
                "  `from_address` VARCHAR(255) NOT NULL,\n" +
                "  `to_address` VARCHAR(255) NOT NULL,\n" +
                "  `amount` DECIMAL(20,10) NOT NULL,\n" +
                "  `timestamp` DATE NOT NULL,\n" +
                "  `from_timestamp` DATE NOT NULL,\n" +
                "  `transaction_hash` VARCHAR(255) NOT NULL,\n" +
                "  PRIMARY KEY (`id`),\n" +
                "  UNIQUE INDEX `transaction_hash_UNIQUE` (`transaction_hash` ASC),\n" +
                "  INDEX `from` (`from_address` ASC),\n" +
                "  INDEX `to` (`to_address` ASC),\n" +
                "  INDEX `from_id` (`from_id` ASC),\n" +
                "  INDEX `to_id` (`to_id` ASC),\n" +
                "  INDEX `block` (`block` ASC),\n" +
                "  INDEX `transaction_id` (`transaction_id` ASC),\n" +
                "  INDEX `from_timestamp` (`from_timestamp` ASC),\n" +
                "  INDEX `from_address_to_address` (`from_address` ASC, `to_address` ASC));\n");*/


            utils.waitForSync(function () {
                that.registerRPCMethods();
                that.registerMessagesHandlers();
            });

            logger.info('Transactions index ready');
            if(typeof cb !== 'undefined') {
                cb();
            }
        });
    }


    /**
     * Проверка блоков на изменения, режим экономии ОЗУ
     * @param {Block} block
     * @param {String} blockType
     * @param cb
     */
    checkBlockChangeSQL(block, blockType, cb) {
        let that = this;
        that.db.get("SELECT * FROM blockIndex WHERE `index` = " + block.index, function (err, row) {
            if(err) {
                if(typeof cb !== 'undefined') {
                    cb();
                }
                return;
            }

            if(row) {
                //Block was changed
                if(row.hash !== block.hash) {
                    that.db.serialize(function () {
                        if(blockType === 'Transaction') {
                            that.db.run("DELETE FROM transactions WHERE block = " + block.index);
                        }

                        if(blockType === 'WalletRegister') {
                            that.db.run("DELETE FROM wallets WHERE block = " + block.index);
                        }

                        that.db.run("UPDATE blockIndex SET type='" + blockType + "', hash='" + block.hash + "' WHERE `index` = " + block.index);


                        if(typeof cb !== 'undefined') {
                            cb();
                        }

                    });

                } else {
                    if(typeof cb !== 'undefined') {
                        cb();
                    }
                }
            } else {
                that.db.run("INSERT INTO blockIndex (`type`, `hash`, `index`) VALUES ('" + blockType + "', '" + block.hash + "', " + block.index + ');', function (err) {
                    if(typeof cb !== 'undefined') {
                        cb();
                    }
                });

            }
        });

    }

    /**
     * Проверка блоков на изменения, быстрый режим
     * @param {Block} block
     * @param {String} blockType
     * @param cb
     */
    checkBlockChangePerf(block, blockType, cb) {
        let that = this;
        let index = block.index;

        if(typeof that.blocksIndex[index] === 'undefined') {
            that.blocksIndex[index] = {index: index, blockType: blockType, hash: block.hash};
            if(typeof cb !== 'undefined') {
                cb();
            }
        } else {
            if(that.blocksIndex[index].hash !== block.hash) {
                let query = false;
                if(blockType === 'Transaction') {
                    query = ("DELETE FROM transactions WHERE block = " + block.index);
                }

                if(blockType === 'WalletRegister') {
                    query = ("DELETE FROM wallets WHERE block = " + block.index);
                }

                if(query) {
                    that.db.run(query, function () {
                        that.blocksIndex[index].hash = block.hash;
                        if(typeof cb !== 'undefined') {
                            cb();
                        }
                    });
                } else {
                    if(typeof cb !== 'undefined') {
                        cb();
                    }
                }
            } else {
                if(typeof cb !== 'undefined') {
                    cb();
                }
            }
        }
    }


    /**
     * Проверка блоков на изменения (выбор режима)
     * @param block
     * @param blockType
     * @param cb
     */
    checkBlockChange(block, blockType, cb) {

        if(this.indexDisabled) {
            if(typeof cb !== 'undefined') {
                cb();
            }
            return;
        }

        if(!this.isFast) {
            if(block.index % 10000 === 0) {
                let maxBlock = storj.get('maxBlock');
                if(maxBlock) {
                    logger.info('Transactions index building.  ' + block.index + ' / ' + maxBlock + ' - ' + Math.round((block.index / maxBlock) * 100) + '%');
                }
            }
        }

        if(this.config.transactionIndexPerf) {
            this.checkBlockChangePerf(block, blockType, cb);
        } else {
            this.checkBlockChangeSQL(block, blockType, cb)
        }
    }

    /**
     * Handle new wallet
     * @param {Block} block
     * @param {Wallet} blockData
     * @param cb
     */
    handleWalletRegister(block, blockData, cb) {

        if(this.indexDisabled) {
            if(typeof cb !== 'undefined') {
                cb();
            }
            return;
        }

        let that = this;
        that.db.get("SELECT * FROM wallets WHERE block = " + block.index, function (err, row) {
            if(!row) {
                that.db.run("INSERT INTO wallets (`block`, `address`) VALUES (" + block.index + ", '" + blockData.id + "')", function (err) {
                    if(typeof cb !== 'undefined') {
                        cb();
                    }

                });
            } else {
                if(typeof cb !== 'undefined') {
                    cb();
                }

            }
        });
    }

    /**
     *
     * @param {Block} block
     * @param {string} transactionHash
     * @param {Transaction} blockData
     * @param cb
     */
    handleTransaction(block, transactionHash, blockData, cb) {

        if(this.indexDisabled) {
            if(typeof cb !== 'undefined') {
                cb();
            }
            return;
        }

        let that = this;
        let from_id = null;
        let to_id = null;


        /**
         * Handle checked transaction
         */
        function handle() {
            that.db.get("SELECT * FROM transactions WHERE transaction_hash = '" + transactionHash + "'", function (err, row) {
                if(!row) {
                    that.db.run("INSERT INTO transactions (`block`, `from_id`, `to_id`, `from_address`, `to_address`, `timestamp`, `from_timestamp`, `transaction_hash`, `amount`) VALUES " +
                        `(${block.index}, ${from_id}, ${to_id}, '${blockData.from}', '${blockData.to}', ${blockData.timestamp}, ${blockData.fromTimestamp},'${transactionHash}','${blockData.amount}' )`, function (err) {
                        if(typeof cb !== 'undefined') {
                            cb();
                        }

                    });
                } else {
                    if(typeof cb !== 'undefined') {
                        cb();
                    }

                }
            });
        }

        that.db.get("SELECT * FROM wallets WHERE address = '" + blockData.from + "'", function (err, row) {
            if(!row) {
                logger.error('Sender wallet ' + blockData.from + ' not found in index. Index may be corrupted.');
                if(typeof cb !== 'undefined') {
                    cb();
                }
            } else {
                from_id = row.id;
                that.db.get("SELECT * FROM wallets WHERE address = '" + blockData.to + "'", function (err, row) {
                    if(!row) {
                        logger.error('Recipient wallet ' + blockData.to + ' not found in index. Index may be corrupted.');
                        if(typeof cb !== 'undefined') {
                            cb();
                        }
                    } else {
                        to_id = row.id;
                        handle();
                    }
                });
            }
        });


    }

    /**
     * Register RPC methods for index
     * @param {Express} app
     * @return
     */
    registerRPCMethods() {

        if(this.indexDisabled) {
            if(typeof cb !== 'undefined') {
                cb();
            }
            return;
        }
        let app = storj.get('httpServer');
        let that = this;
        if(!app) {
            logger.error("Can't register RPC methods for index");
            return;
        }

        app.get('/indexState', function (req, res) {
            utils.waitForSync(function () {
                res.send({
                    isPerfMode: that.config.transactionIndexPerf
                });
            });
        });

        app.get('/getWalletTransactions/:wallet', function (req, res) {
            utils.waitForSync(function () {
                that.getWalletTransactions(req.params.wallet, function (err, txs) {
                    if(!err) {
                        res.send(txs);
                    } else {
                        res.send();
                    }
                })
            });
        });

        app.get('/getTransactionByHash/:hash', function (req, res) {
            utils.waitForSync(function () {
                that.getTransactionByHash(req.params.hash, function (err, tx) {
                    if(!err) {
                        res.send(tx);
                    } else {
                        res.send();
                    }
                });
            });
        });

        app.get('/getTransactionsByBlockIndex/:index', function (req, res) {
            utils.waitForSync(function () {
                that.getTransactionsByBlockIndex(req.params.index, function (err, txs) {
                    if(!err) {
                        res.send(txs);
                    } else {
                        res.send();
                    }
                })
            });
        });
    }


    registerMessagesHandlers() {
        if(this.indexDisabled) {
            if(typeof cb !== 'undefined') {
                cb();
            }
            return;
        }

        let that = this;

        utils.waitForSync(function () {
            /**
             * @var {MessagesDispatcher} dispatcher
             */
            const dispatcher = storj.get('messagesDispatcher');
            dispatcher.registerMessageHandler('getWalletTransactions', function (message) {
                that.getWalletTransactions(message.data.id, function (err, txs) {
                    dispatcher.broadcastMessage({
                        txs: txs,
                        wallet: message.data.id,
                        mutex: message.mutex
                    }, 'getWalletTransactions' + dispatcher.RESPONSE_SUFFIX, message.recepient);
                });
            });

            dispatcher.registerMessageHandler('getTransactionByHash', function (message) {
                that.getTransactionByHash(message.data.id, function (err, tx) {
                    dispatcher.broadcastMessage({
                        txs: tx,
                        hash: message.data.id,
                        mutex: message.mutex
                    }, 'getTransactionByHash' + dispatcher.RESPONSE_SUFFIX, message.recepient);
                });
            });


            dispatcher.registerMessageHandler('getTransactionsByBlockIndex', function (message) {
                that.getTransactionsByBlockIndex(message.data.id, function (err, txs) {
                    dispatcher.broadcastMessage({
                        txs: txs,
                        wallet: message.data.id,
                        mutex: message.mutex
                    }, 'getTransactionsByBlockIndex' + dispatcher.RESPONSE_SUFFIX, message.recepient);
                });
            });

        });
    }

    /**
     *
     * @param {string} wallet
     * @param cb
     */
    getWalletTransactions(wallet, cb) {
        let that = this;
        that.db.all(`SELECT * FROM transactions WHERE from_address = '${wallet}'`, function (err, from) {
            that.db.all(`SELECT * FROM transactions WHERE to_address = '${wallet}'`, function (err, to) {
                cb(err, {income: to, outcome: from});
            });
        });
    }

    /**
     * Get transaction by hash
     * @param {string} hash
     * @param cb
     */
    getTransactionByHash(hash, cb) {
        let that = this;
        that.db.get(`SELECT * FROM transactions WHERE transaction_hash = '${hash}'`, function (err, transaction) {
            cb(err, transaction);
        });
    }

    /**
     * Get transactions in block
     * @param index
     * @param cb
     */
    getTransactionsByBlockIndex(index, cb) {
        let that = this;
        that.db.all(`SELECT * FROM transactions WHERE block = '${index}'`, function (err, txs) {
            cb(err, txs);
        });
    }


    /**
     * Saving databases and close it
     * @param cb
     */
    terminate(cb) {
        if(this.indexDisabled) {
            if(typeof cb !== 'undefined') {
                cb();
            }
            return;
        }
        this.db.close();
        if(this.config.transactionIndexPerf && this.dbPath !== ':memory:') {
            fs.writeFileSync(this.config.workDir + '/' + this.perfPath, JSON.stringify(this.blocksIndex));
            this.blocksIndex = [];
            if(typeof cb !== 'undefined') {
                cb();
            }
        } else {
            if(typeof cb !== 'undefined') {
                cb();
            }
        }
    }
}

module.exports = TransactionIndex;