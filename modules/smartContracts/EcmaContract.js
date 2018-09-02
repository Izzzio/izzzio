/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const VM = require('./VM');
const TransactionalKeyValue = require('./TransactionalKeyValue');
const KeyValueInstancer = require('./KeyValueInstancer');
const storj = require('../instanceStorage');
const logger = new (require('../logger'))('ECMAContract');
const random = require('../random');
const EventsDB = require('./EventsDB');

const BlockHandler = require('../blockHandler');
const EcmaContractDeployBlock = require('./EcmaContractDeployBlock');
const EcmaContractCallBlock = require('./EcmaContractCallBlock');
const uglifyJs = require("uglify-es");


/**
 * EcmaScript Smart contracts handler
 */
class EcmaContract {
    constructor() {
        let that = this;

        this.db = new TransactionalKeyValue('EcmaContracts');
        this.contracts = this.db.db;
        this.config = storj.get('config');
        //this.blockchain = storj.get('blockchainObject');
        this._contractInstanceCache = {};
        this._contractInstanceCacheLifetime = typeof this.config.ecmaContract === 'undefined' || typeof this.config.ecmaContract.contractInstanceCacheLifetime === 'undefined' ? 60000 : this.config.ecmaContract.contractInstanceCacheLifetime;

        this._dbInstances = [];

        /**
         * Events indenxing
         */
        this.events = new EventsDB();
        this.events.initialize(function () {
            /*that.events.event('123','Hello', ["0.0000000000000000000000000100000000000000000000000000000000000000000001"], {index:3, timestamp:101010, hash:'hash'}, function (err) {
                console.log('Inserted', err);
                process.exit();
            })*/
        });

        /**
         * @var {BlockHandler} this.blockHandler
         */
        this.blockHandler = storj.get('blockHandler');

        this.blockHandler.registerBlockHandler(EcmaContractDeployBlock.blockType, function (blockData, block, callback) {
            that.events.handleBlockReplay(block.index, function () {
                that.handleBlock(blockData, block, callback);
            });
        });

        this.blockHandler.registerBlockHandler(EcmaContractCallBlock.blockType, function (blockData, block, callback) {
            that.events.handleBlockReplay(block.index, function () {
                that.handleBlock(blockData, block, callback);
            });
        });

        /*this.blockHandler.registerBlockHandler('Document', function (blockData, block, callback) {
            that.handleBlock(blockData, block, callback)
        });*/


        logger.info('Initialized');


        let code = 'new ' + function () {
            class SimpleToken extends TokenContract {

                /**
                 * Token contract values
                 * @return {{type: string, name: string, ticker: string, site: string, icon: string, decimals: number, owner: boolean}}
                 */
                get contract() {
                    return {
                        type: 'token',
                        name: 'SimpleToken',
                        ticker: 'ST',
                        site: 'http://izzz.io',
                        icon: 'http://izzz.io/simpleToken.png',
                        decimals: 70,
                        owner: 'c0116b4f723e01a44d933c5fa9fef9586a532d5547eee0a76a7c1a62d5bc32ed',
                    };
                }

                /**
                 * Initialize emission
                 */
                init() {
                    super.init('1000.0000000000000000000000000100000000000000000000000000000000000000000001');
                }

                test() {
                    this.assertOwnership();
                    this.transfer(state.from, '1000');

                    console.log(this.totalSupply().toFixed(this.contract.decimals));
                    console.log(this.balanceOf(state.from));

                    /* this.burn('1000');
                     console.log(this.balanceOf('321').toFixed(this.contract.decimals));
                     console.log(this.totalSupply().toFixed(this.contract.decimals));*/
                }

            }

            global.registerContract(SimpleToken);
        };


        setTimeout(function () {
            that.deployContract(code, function (deployedContract) {
                setTimeout(function () {
                    /*that.callContractMethodRollback(generatedBLock.index, 'contract.test', function (err, val) {
                        console.log("RESULT", val);
                        process.exit();

                    });*/

                    that.deployContractMethod(deployedContract.address, 'test', [], {}, function (generatedBlock) {
                        that.events.getContractEventSum(deployedContract.address, 'Transfer', '3', {}, function (err, val) {
                            console.log(err, val);
                            process.exit();
                        });

                    });
                }, 1000);
            });
        }, 5000);
    }

    /**
     * Get blockchain object
     * @return {blockchain}
     */
    get blockchain() {
        return storj.get('blockchainObject')
    }

    /**
     * Create contract instance by code
     * @param address
     * @param code
     * @param state
     * @param cb Initalized callback
     * @return {{vm: VM, db: KeyValueInstancer}}
     */
    createContractInstance(address, code, state, cb) {
        let vm = new VM({ramLimit: this.config.ecmaContract.ramLimit});
        let db = new TransactionalKeyValue(this.config.workDir + '/contractsRuntime/' + address);//new KeyValueInstancer(this.db, address);
        try {
            vm.setTimingLimits(10000);
            vm.compileScript(code, state);
            vm.setObjectGlobal('state', state);
            this._setupVmFunctions(vm, db);
            vm.execute();
            vm.runContextMethodAsync('contract.init', function (err) {
                if(err) {
                    throw 'Contract initialization error ' + err;
                }
                if(typeof cb === 'function') {
                    cb(vm);
                }
            });
        } catch (e) {
            vm.destroy();
            logger.error('Contract ' + address + ' deployed with error. ' + e);
            throw e;
        }

        let contractInfo = {};
        try {
            contractInfo = vm.getContextProperty('contract.contract')
        } catch (e) {
        }


        return {vm: vm, db: db, info: contractInfo};
    }

    /**
     * SetUp Virtual Machine functions
     * @param {VM} vm
     * @param {KeyValueInstancer} db
     * @private
     */
    _setupVmFunctions(vm, db) {
        let that = this;

        /**
         * Return async result to sync VM
         */
        function vmSync() {
            vm.setObjectGlobal('_execResult', {status: 0});
            return {
                return: function (result) {
                    vm.setObjectGlobal('_execResult', {status: 1, result: result});
                }
            };
        }

        vm.injectScript('new ' + function () {
            /**
             * Wait for async operation ends
             * @return {*}
             */
            global.waitForReturn = function waitForReturn() {
                while (true) {

                    if(global._execResult.status !== 0) {
                        global._execResult.status = 0;
                        return global._execResult.result
                    } else {
                        system.processMessages();
                    }
                }
            };
        });

        /**
         * Assertions
         */
        vm.setObjectGlobal('assert', {
            assert: function (assertion, message) {
                if(!assertion) {
                    if(typeof message !== 'undefined') {
                        throw message;
                    }
                    throw 'Assertion fails'
                }
            },
            defined: function (assertion, message) {
                if(!assertion) {
                    if(typeof message !== 'undefined') {
                        throw message;
                    }
                    throw 'Assertion not defined'
                }
            },
            gt: function (a, b, message) {
                this.assert(a > b, message);
            },
            lt: function (a, b, message) {
                this.assert(a < b, message);
            },
            true: function (assertion, msg) {
                this.assert(assertion, msg);
            },
            false: function (assertion, msg) {
                this.true(!assertion, msg);
            }
        });

        /**
         * Contract Key-Value DB
         */
        vm.setObjectGlobal('_db', {
            create: function (dbName) {
                let newDb = new KeyValueInstancer(db, dbName);
                return that._dbInstances.push(newDb) - 1;
            },
            getName: function (handleId) {
                return that._dbInstances[handleId].namespace;
            },
            _get: function (handleId, key) {
                let sync = vmSync();
                that._dbInstances[handleId].get(key, function (err, val) {
                    if(!err) {
                        sync.return(val);
                    } else {
                        sync.return(false);
                    }
                });

                return true;
            },
            _put: function (handleId, key, value) {
                let sync = vmSync();
                that._dbInstances[handleId].put(key, value, function (err) {
                    sync.return(err);
                });
                return true;
            }
        });
        //Inject DB module
        vm.injectScript('new ' + function () {
            let waitForReturn = global.waitForReturn;
            let _db = global._db;
            global._db = undefined;
            global.KeyValue = function (dbName) {
                let that = this;

                this.handler = _db.create(dbName);
                this.dbName = dbName;
                this.get = function (key) {
                    _db._get(that.handler, key);
                    return waitForReturn();
                };
                this.put = function (key, value) {
                    _db._put(that.handler, key, value);
                    return waitForReturn();
                };
                return this;
            };

        });

        /**
         * Contract events
         */
        vm.setObjectGlobal('_events', {
            /**
             *
             * @param event
             * @param args
             * @param {Block} block
             * @private
             */
            _emit: function (event, args, block, address) {
                let sync = vmSync();
                that.events.event(address, event, args, block, function (err) {
                    if(err) {
                        sync.return(false);
                        throw 'Event handling error ' + err;
                    }

                    sync.return(true);
                });
            }
        });
        vm.injectScript('new ' + function () {
            let waitForReturn = global.waitForReturn;
            let _events = global._events;
            global._events = undefined;
            global.Events = {
                emit: function (event, args) {
                    assert.true(Array.isArray(args), 'Event arguments must be an array');
                    assert.true(args.length <= 10, 'Event can take 10 arguments maximum');
                    assert.true(typeof  event === 'string', 'Event name must be a string');
                    _events._emit(event, args, state.block, state.contractAddress);
                    return waitForReturn();
                }
            };

        });


        vm.injectSource(__dirname + '/modules/BigNumber.js');
        vm.injectSource(__dirname + '/modules/TokensRegister.js');
        vm.injectSource(__dirname + '/modules/Contract.js');
        vm.injectSource(__dirname + '/modules/TokenContract.js');
        vm.injectSource(__dirname + '/modules/Event.js');
    }

    /**
     * Call contract method without deploying. (Useful for testing and get contract information)
     * @param {string} address
     * @param {string} method
     * @param {Object} state
     * @param {Function} cb
     * @param args
     */
    callContractMethodRollback(address, method, state, cb, ...args) {
        /* if(method.indexOf('contract._') !== -1) {
             throw 'Calling private contract method not allowed';
         }*/

        this.getContractInstanceByAddress(address, function (err, instance) {
            if(err) {
                cb(err);
            } else {
                try {
                    instance.vm.setObjectGlobal('state', state);
                    instance.vm.runContextMethodAsync('contract.' + method, function (err, result) {
                        if(err) {
                            logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                            cb(err);
                            return;
                        }
                        instance.db.rollback(function () {
                            cb(null, result);
                        });

                    }, ...args);

                } catch (err) {
                    logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                    cb(err);
                }
            }
        });
    }

    /**
     * Call contract method with deploying new state
     * @param address
     * @param method
     * @param state
     * @param cb
     * @param args
     */
    callContractMethodDeploy(address, method, state, cb, ...args) {
        if(method.indexOf('contract._') !== -1) {
            throw 'Calling private contract method in deploy method not allowed';
        }

        this.getContractInstanceByAddress(address, function (err, instance) {
            if(err) {
                cb(err);
            } else {
                try {
                    instance.vm.setObjectGlobal('state', state);
                    instance.vm.runContextMethodAsync('contract.' + method, function (err, result) {
                        if(err) {
                            logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                            cb(err);
                            return;
                        }
                        instance.db.deploy(function () {
                            cb(null, result);
                        });

                    }, ...args);

                } catch (err) {
                    logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                    cb(err);
                }
            }
        });
    }

    /**
     * Get contract property by address
     * @param address
     * @param property
     * @param cb
     */
    getContractProperty(address, property, cb) {
        this.getContractInstanceByAddress(address, function (err, instance) {
            if(err) {
                cb(err);
            } else {
                try {
                    cb(null, instance.vm.getContextProperty(property));
                } catch (e) {
                    cb(e);
                }
            }
        });
    }

    /**
     * Get instance by address
     * @param {string} address
     * @param {Function} cb
     */
    getContractInstanceByAddress(address, cb) {
        let that = this;
        if(typeof this._contractInstanceCache[address] !== 'undefined') {
            cb(null, this._contractInstanceCache[address].instance);
        } else {
            this.contracts.get(address, function (err, contract) {
                if(err) {
                    cb(false);
                } else {
                    contract = JSON.parse(contract);
                    let instance = that.getOrCreateContractInstance(address, contract.code, contract.state, function () {
                        cb(null, instance);
                    });

                }
            })
        }

    }

    /**
     * Deploy contract with current wallet
     * @param {string} code
     * @param {Function} cb
     */
    deployContract(code, cb) {
        let that = this;
        code = uglifyJs.minify(code).code;
        let deployBlock = new EcmaContractDeployBlock(code, {
            randomSeed: random.int(0, 10000),
            from: this.blockchain.wallet.id
        });
        deployBlock = this.blockchain.wallet.signBlock(deployBlock);

        this.blockchain.generateNextBlockAuto(deployBlock, function (generatedBlock) {
            that.blockchain.addBlock(generatedBlock, function () {
                that.blockchain.broadcastLastBlock();
                cb({block: generatedBlock, address: generatedBlock.index});
            })
        });

    }

    /**
     * Deploy call contract method
     * @param {string} address
     * @param {string} method
     * @param {Object} args
     * @param {Object} state
     * @param {Function} cb
     */
    deployContractMethod(address, method, args, state, cb) {
        let that = this;
        state.from = this.blockchain.wallet.id;
        state.contractAddress = address;

        let callBlock = new EcmaContractCallBlock(address, method, args, state);
        callBlock = this.blockchain.wallet.signBlock(callBlock);
        this.blockchain.generateNextBlockAuto(callBlock, function (generatedBlock) {
            that.blockchain.addBlock(generatedBlock, function () {
                that.blockchain.broadcastLastBlock();
                cb(generatedBlock);
            })
        });
    }

    /**
     * Creates or return cached contract instance
     * @param address
     * @param code
     * @param state
     * @param cb Initialized callback
     * @return {*}
     */
    getOrCreateContractInstance(address, code, state, cb) {
        let that = this;
        if(typeof this._contractInstanceCache[address] === 'undefined') {
            let instance = {instance: this.createContractInstance(address, code, state, cb)};
            instance.timer = setTimeout(function () {
                if(!that._contractInstanceCache[address]) {
                    return;
                }
                that._contractInstanceCache[address].instance.vm.destroy();
                that._contractInstanceCache[address].instance.db.close();
                that._contractInstanceCache[address] = undefined;
                delete that._contractInstanceCache[address];
            }, this._contractInstanceCacheLifetime);
            this._contractInstanceCache[address] = instance;
            return instance.instance;

        } else {
            clearTimeout(this._contractInstanceCache[address].timer);
            this._contractInstanceCache[address].timer = setTimeout(function () {
                if(!that._contractInstanceCache[address]) {
                    return;
                }
                that._contractInstanceCache[address].instance.vm.destroy();
                that._contractInstanceCache[address].instance.db.close();
                that._contractInstanceCache[address] = undefined;
                delete that._contractInstanceCache[address];
            }, this._contractInstanceCacheLifetime);

            return this._contractInstanceCache[address].instance;
        }
    }

    /**
     * Destroy instance
     * @param instance
     * @param cb
     */
    destroyContractInstance(instance, cb) {
        instance.vm.destroy();
        instance.db.clear(function () {
            instance.db.close(function () {
                instance = undefined;
                cb();
            });

        });
    }

    destroyContractByAddress(addr, cb) {
        let db = {};
        if(typeof this._contractInstanceCache[addr] !== 'undefined') {
            this.destroyContractInstance(this._contractInstanceCache[addr].instance, cb);
            return;
        } else {
            db = new TransactionalKeyValue('contractsRuntime/' + addr);
        }
        db.clear(function () {
            db.close(function () {
                //console.log('Cleared DB');
                //process.exit();
                cb();
            });
        })
    }


    /**
     *  Handling contract deploy
     * @param {string} address
     * @param {string} code
     * @param {Object} state
     * @param {Object} block
     * @param {Function} callback
     * @private
     */
    _handleContractDeploy(address, code, state, block, callback) {
        let that = this;

        function addNewContract() {
            state.block = block;
            state.contractAddress = address;
            let contract = {code: code, state: state};
            that.contracts.put(address, JSON.stringify(contract), function (err) {
                if(err) {
                    logger.error('Contract deploy handling error');
                    callback(true);
                }
                let contractInstance = {};
                try {
                    contractInstance = that.getOrCreateContractInstance(address, code, state, function () {
                        callback(null, contractInstance);
                    });
                } catch (e) {
                    logger.error('Contract deploy handling error ' + e);
                    callback(true);
                    return;
                }

            })

        }

        this.contracts.get(address, function (err, contract) {
            if(err) {
                addNewContract();
            } else {
                let oldContract = JSON.parse(contract);
                //console.log(oldContract);
                that.destroyContractByAddress(address, function () {
                    addNewContract();
                });

                /* that.destroyContractInstance(that.getOrCreateContractInstance(address, oldContract.code, oldContract.state), function () {
                     //Handle contract deploying
                     addNewContract();
                 });*/

            }
        });

    }

    /**
     * Handling contract call method
     * @param {string} address
     * @param {string} method
     * @param {Object} args
     * @param {Object} state
     * @param {Block} block
     * @param {Function} callback
     * @private
     */
    _handleContractCall(address, method, args, state, block, callback) {
        let that = this;

        state.block = block;
        state.randomSeed = block.index;
        state.contractAddress = address;

        let callstack = [];
        callstack.push(address);
        callstack.push(method);
        callstack.push(state);
        callstack.push(function (err, result) {
            callback(true);
        });
        for (let a in args) {
            if(args.hasOwnProperty(a)) {
                callstack.push(args[a]);
            }
        }
        this.callContractMethodDeploy.apply(this, callstack);

    }

    /**
     * Handle Ecma blocks
     * @param {EcmaContractDeployBlock} blockData
     * @param {Block} block
     * @param {Function} callback
     */
    handleBlock(blockData, block, callback) {
        let that = this;

        let verifyBlock = {};

        switch (blockData.type) {
            case EcmaContractDeployBlock.blockType:
                verifyBlock = new EcmaContractDeployBlock(blockData.ecmaCode, blockData.state);

                if(verifyBlock.data !== blockData.data) {
                    logger.error('Contract invalid data in block ' + block.index);
                    callback(true);
                    return
                }

                if(!this.blockchain.wallet.verifyData(blockData.data, blockData.sign, blockData.pubkey)) {
                    logger.error('Contract invalid sign in block ' + block.index);
                    callback(true);
                    return
                }

                this._handleContractDeploy(block.index, blockData.ecmaCode, blockData.state, block, callback);
                break;
            case EcmaContractCallBlock.blockType:
                verifyBlock = new EcmaContractCallBlock(blockData.address, blockData.method, blockData.args, blockData.state);
                if(verifyBlock.data !== blockData.data) {
                    logger.error('Contract invalid data in block ' + block.index);
                    callback(true);
                    return
                }

                if(!this.blockchain.wallet.verifyData(blockData.data, blockData.sign, blockData.pubkey)) {
                    logger.error('Contract invalid sign in block ' + block.index);
                    callback(true);
                    return
                }

                this._handleContractCall(blockData.address, blockData.method, blockData.args, blockData.state, block, callback);

                break;
            default:
                logger.error('Unexpected block type ' + block.index);
                callback();
        }
    }
}

module.exports = EcmaContract;