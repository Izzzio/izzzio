/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const sqlite3 = require('sqlite3').verbose();
const logger = new (require('../logger'))('ContractEvents');
const utils = require('../utils');
const BigNumber = require('bignumber.js');

/**
 * @deprecated
 * @type {{get: function(string): *, put: function(string, *): void}}
 */
const storj = require('../instanceStorage');


/**
 * Events index database
 */
class EventsDB {
    constructor(path, config) {
        this.config = config;

        //Assign named storage
        this.namedStorage = new (require('../NamedInstanceStorage'))(config.instanceId);

        if (path === '' || path === ':memory:') {
            this.path = path;
        } else {
            this.path = this.config.workDir + path; // '/contractsRuntime/EventsDB.db';
        }

        this.db = null;
        this._eventHandler = {};
        this._transactions = {};

        storj.put('ContractEvents', this);
        this.namedStorage.put('ContractEvents', this);
    }

    /**
     * Initialize DB
     * @param cb
     */
    initialize(cb) {
        let that = this;

        this.db = new sqlite3.Database(''/*this.path*/, function () {
            /**
             * BigNumber sum
             */
            (function () {
                let sum = new BigNumber(0);
                try {
                    that.db.registerAggregateFunction('bsum', function (value) {
                        if (!value) {
                            let returnVal = sum.toFixed();
                            sum = new BigNumber(0);
                            return returnVal;
                        }

                        value = new BigNumber(value);
                        if (!value.isNaN()) {
                            sum = sum.plus(value);
                        }
                    });
                } catch (e) {
                    logger.warning('Aggregate functions unsupported for current SQLite3 module')
                }
            })();

            function contiune() {
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
            }

            that.db.exec(`ATTACH DATABASE "${that.path}" AS flush_db; DROP TABLE IF EXISTS main.\`events\`; CREATE TABLE main.\`events\` AS SELECT * FROM flush_db.\`events\`; DETACH DATABASE flush_db;`, function (err) {

                //If database loaded with error, DEATACH IT
                if (err) {
                    that.db.exec("DETACH DATABASE flush_db;", function (err) {
                        contiune();
                    });
                } else {
                    contiune();
                }
            });
        });

    }

    /**
     * Flush DB to disk
     * @param {Function} cb
     */
    flush(cb) {
        if (this.path === '' || this.path === ':memory:') {
            cb(null);
            return;
        }
        let that = this;
        this.db.exec(`ATTACH DATABASE "${this.path}" AS flush_db; DROP TABLE IF EXISTS flush_db.\`events\`; CREATE TABLE flush_db.\`events\` AS SELECT * FROM main.\`events\`; DETACH DATABASE flush_db;`, function (err) {
            //If database loaded with error, DEATACH IT
            if (err) {
                that.db.exec("DETACH DATABASE flush_db;", function (err2) {
                    cb(err);
                });
            } else {
                cb(err);
            }
        });
    }

    /**
     * Handle block replayed
     * @param blockIndex
     * @param cb
     * @private
     */
    _handleBlockReplay(blockIndex, cb) {
        this.db.run('DELETE FROM `events` WHERE block >= ' + blockIndex, function (err) {
            cb(err);
        });
    }

    /**
     * Handle event emit
     * TODO: Change to transactional variant
     * @param contract
     * @param event
     * @param {array} params
     * @param block
     * @param cb
     */
    event(contract, event, params, block, cb) {
        let that = this;
        this._insertEvent(contract, event, params, block, function (err) {
            /* that._handleEvent(contract, event, params, function () {
                 cb(err);
             })*/
            cb(err);
        });
    }

    /**
     * Rollback block contract Events
     * TODO: Change to transactional variant
     * @param contract
     * @param block
     * @param cb
     */
    rollback(contract, block, cb) {
        this.db.run('DELETE FROM `events` WHERE block = ' + block + ' AND contract = "' + contract + '"', function (err) {
            cb(err);
        });
    }

    /**
     * Deploy block contract Events
     * TODO: Change to transactional variant
     * @param contract
     * @param block
     * @param cb
     */
    async deploy(contract, block, cb) {
        let that = this;

        function dbRowToParamsArray(row) {
            let params = [];
            params.push(row.v1);
            params.push(row.v2);
            params.push(row.v3);
            params.push(row.v4);
            params.push(row.v5);
            params.push(row.v6);
            params.push(row.v7);
            params.push(row.v8);
            params.push(row.v9);
            params.push(row.v10);
            return params;
        }

        this.db.all('SELECT * FROM `events` WHERE block = ' + block + ' AND contract = "' + contract + '"', async function (err, values) {
            if (err) {
                cb(err);
            } else {
                for (let a in values) {
                    if (values.hasOwnProperty(a)) {
                        await (new Promise(function (resolve) {
                            that._handleEvent(contract, values[a].event, dbRowToParamsArray(values[a]), function () {
                                resolve();
                            })
                        }));
                    }

                }

                cb(null);
            }
        });
    }

    /**
     * Insert event to index
     * @param contract
     * @param event
     * @param params
     * @param block
     * @param cb
     * @private
     */
    _insertEvent(contract, event, params, block, cb) {
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
            if (err) {
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
        options.additionalStatement = !options.additionalStatement ? '' : options.additionalStatement;

        let statement = this.db.prepare("SELECT * FROM `events` WHERE block <= ? AND block >= ? AND event = ? AND contract = ? " + options.additionalStatement, [options.toBlock, options.fromBlock, event, contract], function () {
            statement.all([], function (err, values) {
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
        options.additionalStatement = !options.additionalStatement ? '' : options.additionalStatement;


        let statement = this.db.prepare(`SELECT bsum(v${fieldNo}) as sum FROM \`events\` WHERE block <= ? AND block >= ? AND event = ? AND contract = ? ` + options.additionalStatement, [options.toBlock, options.fromBlock, event, contract], function () {
            statement.all([], function (err, values) {
                cb(err, values);
            })
        });
    }

    /**
     * Executes RAW SQL query
     * @param {string} query
     * @param {array} bindParams
     * @param {function} cb
     */
    rawQuery(query, bindParams, cb) {
        let statement;

        if (bindParams) {
            statement = this.db.prepare(query, bindParams);
        } else {
            statement = this.db.prepare(query, []);
        }

        statement.all([], function (err, values) {
            cb(err, values);
        })
    }

    /**
     * Call contract event handlers
     * @param contract
     * @param event
     * @param args
     * @param cb
     * @private
     */
    _handleEvent(contract, event, args, cb) {
        let that = this;
        let handle = contract + '_' + event;
        if (typeof this._eventHandler[handle] === 'undefined') {
            cb();
        }

        (async function () {
            for (let a in that._eventHandler[handle]) {
                if (that._eventHandler[handle].hasOwnProperty(a)) {
                    await (function () {
                        return new Promise(function (resolve) {
                            try {
                                that._eventHandler[handle][a].handler(contract, event, args, function () {
                                    resolve();
                                });
                            } catch (e) {
                                logger.error('Contract event handler failed: ' + contract + ' ' + event + ' ' + e);
                                resolve();
                            }
                        });
                    })();
                }


            }
            cb();
        })();

    }

    /**
     * Register event handler
     * CALLBACK REQUIRED
     * @param {string} contract Contract address
     * @param {string} event    Event
     * @param {(function(string, string, array, Function))} handler Handler callback. Calling callback required
     * @return {string}
     */
    registerEventHandler(contract, event, handler) {
        let handle = contract + '_' + event;
        if (typeof this._eventHandler[handle] === 'undefined') {
            this._eventHandler[handle] = [];
        }
        this._eventHandler[handle].push({handle: handle, handler: handler});

        return handle;
    }
}

module.exports = EventsDB;