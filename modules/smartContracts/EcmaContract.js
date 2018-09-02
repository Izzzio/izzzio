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
         * Waiting for deploy instances
         * @type {Array}
         * @private
         */
        this._instanceCallstack = [];

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

        this.events.registerEventHandler('11', 'TEST', function (contract, event, args, cb) {
            console.log(contract, event, args);
            cb();
        });

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
                    Events.emit('TEST', []);
                    this.assertOwnership();
                    /* this.transfer(state.from, '1000');
                     this.transfer(state.from, '0.0000001');

                     console.log(this.totalSupply().toFixed(this.contract.decimals));
                     console.log(this.balanceOf(state.from));*/
                    console.log('External Call', contracts.callMethodDeploy('12', 'test3', [3, 4]));

                    /* this.burn('1000');
                     console.log(this.balanceOf('321').toFixed(this.contract.decimals));
                     console.log(this.totalSupply().toFixed(this.contract.decimals));*/
                }

                test2(a, b) {
                    if(contracts.isChild()) {
                        console.log('I AM CALLED FROM ', contracts.caller(), contracts.callingIndex());
                    }

                    Events.emit('TEST', []);
                    //assert.true(false);
                    /* console.log('Test2 emitted', a, b);
                     console.log('A+B', a + b);*/
                    return 'hello';
                }

                test3(a, b) {
                    if(contracts.isChild()) {
                        console.log('I AM CALLED FROM ', contracts.caller(), contracts.callingIndex());
                    }

                    Events.emit('TEST', []);
                    console.log('External Call', contracts.callMethodDeploy('11', 'test2', [3, 4]));
                    return 'world';
                }

            }

            global.registerContract(SimpleToken);
        };


        setTimeout(function () {
            that.deployContract(code, function (deployedContract) {
                setTimeout(function () {
                    that.deployContract(code, function (deployedContract2) {
                        that.deployContract(code, function (deployedContract3) {
                            /*that.callContractMethodRollback(generatedBLock.index, 'contract.test', function (err, val) {
                                console.log("RESULT", val);
                                process.exit();

                            });*/

                            that.deployContractMethod(deployedContract3.address, 'test', [], {}, function (generatedBlock) {
                                process.exit();
                            });
                        });
                    });
                }, 5000);
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
            vm.waitingForResponse = true;
            vm.setObjectGlobal('_execResult', {status: 0});
            return {
                return: function (result) {
                    vm.setObjectGlobal('_execResult', {status: 1, result: result});
                    vm.waitingForResponse = false;
                },
                fails: function () {
                    vm.setObjectGlobal('_execResult', {status: 2});
                    vm.waitingForResponse = false;
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
                        if(global._execResult.status === 2) {
                            global._execResult.status = 0;
                            return null;
                        }
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

        vm.setObjectGlobal('_contracts', {
            /**
             * Calls method from another contract with data deploying
             * @param contract
             * @param method
             * @param args
             * @param state
             * @private
             */
            _callMethodDeploy: function (contract, method, args, state) {
                let sync = vmSync();
                state.calledFrom = state.contractAddress;
                state.contractAddress = contract;
                that.callContractMethodDeployWait(contract, method, state, function (err, result) {
                    if(err) {
                        that.rollbackAndClearContractsChain(state, function () {
                            sync.fails();
                            throw 'Contracts calling chain fails with error: ' + err;
                        });
                    } else {
                        if(!result) {
                            sync.return(false);
                        } else {
                            sync.return(result);
                        }

                    }
                }, ...args);
            },
            /**
             * Calling another deployed contract method without deploy
             * @param contract
             * @param method
             * @param args
             * @param state
             * @private
             */
            _callMethodRollback: function (contract, method, args, state) {
                let sync = vmSync();
                state.calledFrom = state.contractAddress;
                state.contractAddress = contract;
                that.callContractMethodRollback(contract, method, state, function (err, result) {
                    if(err) {
                        sync.return(err);
                    } else {
                        if(!result) {
                            sync.return(false);
                        } else {
                            sync.return(result);
                        }

                    }
                }, ...args);
            }
        });

        vm.injectScript('new ' + function () {
            let waitForReturn = global.waitForReturn;
            let _contracts = global._contracts;
            global._contracts = undefined;
            global.contracts = {
                /**
                 * Call another contract method with deploy
                 * @param contract
                 * @param method
                 * @param args
                 * @return {*}
                 */
                callMethodDeploy: function (contract, method, args) {
                    if(contract === state.contractAddress) {
                        throw 'You can\'t call method from himself';
                    }
                    if(typeof state.callingIndex === 'undefined') {
                        state.callingIndex = 0;
                    } else {
                        state.callingIndex++;
                    }
                    _contracts._callMethodDeploy(contract, method, args, state);
                    let result = waitForReturn();
                    if(result === null) {
                        throw 'External call failed';
                    }
                    return result;
                },

                /**
                 * Call another contract method with rollback
                 * @param contract
                 * @param method
                 * @param args
                 * @return {*}
                 */
                callMethodRollback: function (contract, method, args) {
                    if(contract === state.contractAddress) {
                        throw 'You can\'t call method from himself';
                    }
                    _contracts._callMethodRollback(contract, method, args, state);
                    return waitForReturn();
                },
                /**
                 * Get called address
                 * @return {*}
                 */
                caller: function () {
                    if(typeof state.calledFrom !== 'undefined') {
                        return state.calledFrom;
                    }

                    return false;
                },
                /**
                 * Is called from another contract?
                 * @return {boolean}
                 */
                isChild: function () {
                    return !!this.caller();


                },
                /**
                 * Is deploying now or method call
                 * @return {boolean}
                 */
                isDeploy() {
                    return typeof state !== 'undefined' && state;
                },
                /**
                 * Get index of contract calling chain
                 * @return {number}
                 */
                callingIndex() {
                    if(typeof state.callingIndex === 'undefined') {
                        return 0
                    } else {
                        return state.callingIndex;
                    }
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
     * Метод вызова функции из контракта с записью после окончания выполнения всей цепочки вызовов
     * @param address
     * @param method
     * @param state
     * @param cb
     * @param args
     */
    callContractMethodDeployWait(address, method, state, cb, ...args) {
        let that = this;
        if(method.indexOf('contract._') !== -1) {
            throw 'Calling private contract method in deploy method not allowed';
        }

        this.getContractInstanceByAddress(address, function (err, instance) {
            if(err) {
                cb(err);
            } else {
                try {
                    that._instanceCallstack.push(instance);
                    instance.vm.setObjectGlobal('state', state);
                    instance.vm.runContextMethodAsync('contract.' + method, function (err, result) {
                        if(err) {
                            logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                            cb(err);
                            return;
                        }

                        cb(null, result);

                        /*instance.db.deploy(function () {
                            cb(null, result);
                        });*/

                    }, ...args);

                } catch (err) {
                    logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                    cb(err);
                }
            }
        });
    }

    /**
     * Откат всей цепочки вызовов (например в случае падения исходного контракта)
     * @param state
     * @param cb
     */
    rollbackAndClearContractsChain(state, cb) {

        let that = this;
        (async function () {
            for (let a in that._instanceCallstack) {
                if(that._instanceCallstack.hasOwnProperty(a)) {
                    await (function () {
                        return new Promise(function (resolve) {
                            // try { //If instance destroyed early
                            //console.log(that._instanceCallstack[a].vm.state);
                            that.events.rollback(that._instanceCallstack[a].vm.state.contractAddress, state.block.index, function () {
                                that._instanceCallstack[a].db.rollback(function () {
                                    resolve();
                                });
                            });

                            /* } catch (e) {
                                 resolve();
                             }*/
                        });
                    })()
                }
            }

            that._instanceCallstack = [];
            cb(null);
        })();

    }

    /**
     * Запись всей цепочки вызовов в случае удачного завершения
     * @param state
     * @param cb
     */
    deployAndClearContractsChain(state, cb) {

        let that = this;
        (async function () {
            for (let a in that._instanceCallstack) {
                if(that._instanceCallstack.hasOwnProperty(a)) {
                    await (function () {
                        return new Promise(function (resolve) {
                            that.events.deploy(that._instanceCallstack[a].vm.state.contractAddress, state.block.index, function () {
                                that._instanceCallstack[a].db.deploy(function () {
                                    resolve();
                                });
                            });

                        });
                    })()
                }
            }

            that._instanceCallstack = [];
            cb(null);
        })();

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

        /**
         * Destroys instance after timeout
         * @param instance
         */
        let destroyInstanceTimer = function (instance) {
            if(!that._contractInstanceCache[address]) {
                return;
            }

            //Can't destroy contract form callstack
            if(that._instanceCallstack.indexOf(instance) !== -1 || instance.vm.busy || instance.vm.waitingForResponse) {
                instance.timer = setTimeout(function () {
                    destroyInstanceTimer(instance);
                }, that._contractInstanceCacheLifetime);
                return;
            }

            that._contractInstanceCache[address].instance.vm.destroy();
            that._contractInstanceCache[address].instance.db.close();
            that._contractInstanceCache[address] = undefined;
            delete that._contractInstanceCache[address];
        };

        if(typeof this._contractInstanceCache[address] === 'undefined') {
            let instance = {instance: this.createContractInstance(address, code, state, cb)};


            instance.timer = setTimeout(function () {
                destroyInstanceTimer(instance.instance);
            }, this._contractInstanceCacheLifetime);
            this._contractInstanceCache[address] = instance;
            return instance.instance;

        } else {
            clearTimeout(this._contractInstanceCache[address].timer);
            this._contractInstanceCache[address].timer = setTimeout(function () {
                destroyInstanceTimer(that._contractInstanceCache[address].instance);
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
            state.deploy = true;
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
            if(err) {
                that.rollbackAndClearContractsChain(state, function () {
                    //throw 'Contracts calling chain falls with error: ' + err;
                    logger.error('Contracts calling chain falls with error: ' + err);
                    callback(err);
                });
            } else {
                that.deployAndClearContractsChain(state, function () {
                    callback(true);
                });
            }

        });
        for (let a in args) {
            if(args.hasOwnProperty(a)) {
                callstack.push(args[a]);
            }
        }
        this.callContractMethodDeployWait.apply(this, callstack);

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