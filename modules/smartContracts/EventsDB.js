/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const sqlite3 = require('sqlite3').verbose();
const logger = new (require('../logger'))('ContractEvents');
const storj = require('../instanceStorage');
const utils = require('../utils');
const BigNumber = require('bignumber.js');

class EventsDB {
    constructor() {
        this.config = storj.get('config');
        this.path = this.config.workDir + '/contractsRuntime/EventsDB.db';
        this.db = null;
        this._eventHandler = {};
        storj.put('ContractEvents', this);
    }

    /**
     * Initialize DB
     * @param cb
     */
    initialize(cb) {
        let that = this;

        this.db = new sqlite3.Database(this.path, function () {
            /**
             * BigNumber sum
             */
            (function () {
                let sum = new BigNumber(0);
                that.db.registerAggregateFunction('bsum', function (value) {
                    if(!value) {
                        let returnVal = sum.toFixed();
                        sum = new BigNumber(0);
                        return returnVal;
                    }

                    value = new BigNumber(value);
                    if(!value.isNaN()) {
                        sum = sum.plus(value);
                    }
                });
            })();

            //Create events table
            that.db.exec("CREATE TABLE IF NOT EXISTS `events` (\n" +
                "\t`id`\tINTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,\n" +
                "\t`event`\tTEXT NOT NULL,\n" +
                "\t`contract`\tTEXT NOT NULL,\n" +
                "\t`timestamp`\tTEXT,\n" +
                "\t`block`\tINTEGER,\n" +
                "\t`hash`\tTEXT,\n" +
                "\t`v1`\tTEXT,\n" +
                "\t`v2`\tTEXT,\n" +
                "\t`v3`\tTEXT,\n" +
                "\t`v4`\tTEXT,\n" +
                "\t`v5`\tTEXT,\n" +
                "\t`v6`\tTEXT,\n" +
                "\t`v7`\tTEXT,\n" +
                "\t`v8`\tTEXT,\n" +
                "\t`v9`\tTEXT,\n" +
                "\t`v10`\tTEXT\n" +
                ");", function (err) {
                cb(err);
            });
        });

    }

    /**
     * Handle block replayed
     * @param blockIndex
     * @param cb
     */
    handleBlockReplay(blockIndex, cb) {
        this.db.run('DELETE FROM `events` WHERE block = ' + blockIndex, function (err) {
            cb(err);
        });
    }

    /**
     * Handle event emit
     * @param contract
     * @param event
     * @param {array} params
     * @param block
     * @param cb
     */
    event(contract, event, params, block, cb) {
        let that = this;
        this.insertEvent(contract, event, params, block, function (err) {
            that.handleEvent(contract, event, params, function () {
                cb(err);
            })
        });
    }

    /**
     * Insert event to index
     * @param contract
     * @param event
     * @param params
     * @param block
     * @param cb
     */
    insertEvent(contract, event, params, block, cb) {
        for (let i = params.length + 1; i <= 10; i++) {
            params.push(null);
        }
        params.push(event);
        params.push(contract);
        params.push(block.timestamp);
        params.push(block.index);
        params.push(block.hash);

        let statement = this.db.prepare("INSERT INTO `events` (`v1`,`v2`,`v3`,`v4`,`v5`,`v6`,`v7`,`v8`,`v9`,`v10`,`event`,`contract`, `timestamp`, `block`, `hash`) " +
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", params, function (err) {
            if(err) {
                cb(err);
                return;
            }
            statement.run([], function (err) {
                cb(err);
            })

        });

    }

    /**
     * Get contract events
     * @param contract
     * @param event
     * @param options
     * @param cb
     */
    getContractEvents(contract, event, options = {}, cb) {
        options.fromBlock = !options.fromBlock ? 0 : options.fromBlock;
        options.toBlock = !options.toBlock ? 0xFFFFFFFFFF : options.toBlock;

        let statement = this.db.prepare("SELECT * FROM `events` WHERE block <= ? AND block >= ? AND event = ? AND contract = ?", [options.toBlock, options.fromBlock, event, contract], function () {
            statement.run([], function (err, values) {
                cb(err, values);
            })
        });
    }

    /**
     * Get contract events field sum
     * @param contract
     * @param event
     * @param fieldNo
     * @param options
     * @param cb
     */
    getContractEventSum(contract, event, fieldNo, options = {}, cb) {
        options.fromBlock = !options.fromBlock ? 0 : options.fromBlock;
        options.toBlock = !options.toBlock ? 0xFFFFFFFFFF : options.toBlock;

        let statement = this.db.prepare(`SELECT bsum(v${fieldNo}) FROM \`events\` WHERE block <= ? AND block >= ? AND event = ? AND contract = ?`, [options.toBlock, options.fromBlock, event, contract], function () {
            statement.run([], function (err, values) {
                cb(err, values);
            })
        });
    }

    /**
     * Call contract event handlers
     * @param contract
     * @param event
     * @param args
     * @param cb
     */
    handleEvent(contract, event, args, cb) {
        let that = this;
        let handle = contract + '_' + event;
        if(typeof this._eventHandler[handle] === 'undefined') {
            cb();
        }

        (async function () {
            for (let a in that._eventHandler[handle]) {
                await (function () {
                    return new Promise(function (resolve) {
                        try {
                            that._eventHandler[handle][a].handle(contract, event, args, function () {
                                resolve();
                            });
                        } catch (e) {
                            logger.error('Contract event handler failed: ' + contract + ' ' + event + ' ' + e);
                            resolve();
                        }
                    });
                })();

                cb();
            }
        })();

    }

    /**
     * Register event handler
     * @param contract
     * @param event
     * @param handler
     * @return {string}
     */
    registerEventHandler(contract, event, handler) {
        let handle = contract + '_' + event;
        if(typeof this._eventHandler[handle] === 'undefined') {
            this._eventHandler[handle] = [];
        }
        this._eventHandler[handle].push({handle: handle, handler: handler});

        return handle;
    }
}

module.exports = EventsDB;