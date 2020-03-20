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
const Wallet = require('../wallet');
const moment = require('moment');

const path = require('path');
const fs = require('fs');

const EcmaContractDeployBlock = require('./blocksModels/EcmaContractDeployBlock');
const EcmaContractCallBlock = require('./blocksModels/EcmaContractCallBlock');
const uglifyJs = require("uglify-es");
const ContractConnector = require('./connectors/ContractConnector');

const CALLS_LIMITER_THRESHOLD = 60000;


/**
 * Maximum delayed list queue limit
 * @type {number}
 */
const DELAYED_QUEUE_LIMIT = 10;

/**
 * Non private methods protected by external call
 * @type {string[]}
 */
const METHODS_BLACKLIST = [
    'processDeploy',
    'deploy',
    'init',
    'payProcess',
    'assertOwnership',
    'assertPayment',
    'assertMaster'
];

/**
 * EcmaScript Smart contracts handler
 */
class EcmaContract {
    constructor() {
        let that = this;

        this.db = new TransactionalKeyValue('EcmaContracts');
        this.contracts = this.db.db;
        this.config = storj.get('config');
        this.ready = false;

        /**
         * @var {Cryptography}
         */
        this.cryptography = storj.get('cryptography');

        /**
         * @var {Plugins}
         */
        this.plugins = storj.get('plugins');

        /**
         * @var{AccountManager}
         */
        this.accountManager = storj.get('accountManager');

        this._contractInstanceCache = {};
        this._contractInstanceCacheLifetime = typeof this.config.ecmaContract === 'undefined' || typeof this.config.ecmaContract.contractInstanceCacheLifetime === 'undefined' ? 60000 : this.config.ecmaContract.contractInstanceCacheLifetime;

        this._dbInstances = [];

        if(!fs.existsSync(that.config.workDir + '/contractsRuntime')) {
            fs.mkdirSync(that.config.workDir + '/contractsRuntime');
        }

        /**
         * Events indenxing
         */
        this.events = new EventsDB(/*that.config.workDir +*/ '/contractsRuntime/EventsDB.db');
        this.events.initialize(function () {
            logger.info('Initialized');
            that.ready = true;
        });

        /**
         * Waiting for deploy instances
         * @type {Array}
         * @private
         */
        this._instanceCallstack = [];

        /**
         * Next methods calls for delayed calling
         * @type {Array}
         * @private
         */
        this._nextCallings = [];

        /**
         * Delayed call queue limiter
         * @type {number}
         * @private
         */
        this._delayedCallLimiter = 0;

        /**
         * Contain contracts calls for detecting calling limits by CALLS_LIMITER_THRESHOLD
         * @type {{}}
         * @private
         */
        this._lastestContractsCalls = {};

        /**
         * Last handled block
         * @type {number}
         * @private
         */
        this._lastKnownBlock = 0;

        /**
         * @var {BlockHandler} this.blockHandler
         */
        this.blockHandler = storj.get('blockHandler');

        this.blockHandler.registerBlockHandler(EcmaContractDeployBlock.blockType, function (blockData, block, callback) {
            that.events._handleBlockReplay(block.index, function () {
                that._handleBlock(blockData, block, false, () => {
                    callback();
                    that._lastKnownBlock = block.index;
                });
            });
        });

        this.blockHandler.registerBlockHandler(EcmaContractCallBlock.blockType, function (blockData, block, callback) {
            that.events._handleBlockReplay(block.index, function () {
                that._handleBlock(blockData, block, false, () => {
                    callback();
                    that._lastKnownBlock = block.index;
                });
            });
        });


        storj.put('ecmaContract', this);
        logger.info('Loading environment...');

        this._registerRPCMethods();
    }

    /**
     * Get blockchain object
     * @return {blockchain}
     */
    get blockchain() {
        return storj.get('blockchainObject')
    }


    /**
     * Check and control contract calls limits
     * @param address
     * @param timestamp
     * @param limit
     * @param test If we need just check limits
     * @return {boolean}
     */
    checkOrAddCallingLimitsControl(address, timestamp, limit, test = false) {
        timestamp = Number(timestamp);
        let limitCount = 1;
        for (let stamp in this._lastestContractsCalls) {
            if(!this._lastestContractsCalls.hasOwnProperty(stamp)) {
                continue;
            }

            if((stamp < (timestamp - CALLS_LIMITER_THRESHOLD)) || stamp > timestamp) {
                delete this._lastestContractsCalls[stamp];
                continue;
            }

            if(String(address) === String(this._lastestContractsCalls[stamp])) {
                limitCount++;
            }

        }

        if(limitCount > limit) {
            return false;
        }


        if(!test) {
            this._lastestContractsCalls[timestamp] = address;
        }
        return true;
    }

    /**
     * Get contract limits
     * @param address
     * @param cb
     */
    getContractLimits(address, cb) {
        let that = this;

        const defaultLimits = this.config.ecmaContract.defaultLimits;

        if (!this.config.ecmaContract.masterContract) {
            cb(defaultLimits);
            return;
        }

        if (Number(address) <= that.config.ecmaContract.masterContract) {
            cb(defaultLimits);
            return;
        }

        that.callContractMethodDeployWait(that.config.ecmaContract.masterContract, 'checkContractLimits', {}, function (err, result) {
            if (err || !result) {
                cb(defaultLimits);
                return;
            }
            cb(JSON.parse(result));
        }, address);

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
        let that = this;

        function createInstance(limits) {
            let contractInfo = {};
            let vm = new VM({
                ramLimit: limits.ram,
                logging: that.config.ecmaContract.allowDebugMessages,
                logPrefix: 'Contract ' + address + ': ',
            });
            let db = new TransactionalKeyValue(/*that.config.workDir +*/ 'contractsRuntime/' + address);
            try {
                vm.setTimingLimits(limits.timeLimit + 10000);
                vm.setCpuLimit(limits.timeLimit + 500);
                vm.compileScript(code, state);
                vm.setState(state);
                that._setupVmFunctions(vm, db);
                vm.execute();
                vm.runContextMethod("updateExternalState");
                vm.runContextMethodAsync('contract.init', async function (err) {
                    if(err) {
                        throw 'Contract initialization error ' + err;
                    }

                    try {
                        contractInfo = await vm.getContextProperty('contract.contract')
                    } catch (e) {
                    }

                    if(typeof cb === 'function') {
                        cb({vm: vm, db: db, info: contractInfo, limits: limits});
                    }
                });


                state.deploy = false;

            } catch (e) {
                vm.destroy();
                logger.error('Contract ' + address + ' deployed with error. ' + e);
                throw e;
            }




        }


        this.getContractLimits(address, function (limits) {
            createInstance(limits);
        });


        //  return {vm: vm, db: db, info: contractInfo};
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
            try {
                vm.setObjectGlobal('_execResult', {status: 0});
            } catch (e) {
                vm.waitingForResponse = false;
            }
            return {
                return: function (result) {
                    if(!result) {
                        vm.setObjectGlobal('_execResult', {status: 3});
                    } else {
                        vm.setObjectGlobal('_execResult', {status: 1, result: result});
                    }
                    vm.waitingForResponse = false;
                    return result;
                },
                fails: function () {
                    vm.setObjectGlobal('_execResult', {status: 2});
                    vm.waitingForResponse = false;
                    return false;
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

                    if(typeof global._execResult !== 'undefined' && global._execResult.status !== 0) {
                        if(global._execResult.status === 2) {
                            global._execResult.status = 0;
                            return null;
                        }
                        if(global._execResult.status === 3) {
                            global._execResult.status = 0;
                            return false;
                        }
                        global._execResult.status = 0;
                        if(typeof global._execResult.result === 'undefined') {
                            return waitForReturn();
                        }
                        return global._execResult.result;
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
         * Crypto functions
         */
        vm.setObjectGlobal('crypto', {
            /**
             * System defined hash function
             * @param data
             * @return {Buffer}
             */
            hash: function (data) {
                return that.cryptography.hash(String(data));
            },

            /**
             * Verify signature with system defined function
             * @param data
             * @param sign
             * @param publicKey
             * @return {boolean|*}
             */
            verifySign: function (data, sign, publicKey) {
                return that.blockchain.wallet.verifyData(data, sign, String(publicKey));
            },

            /**
             * Sign data with system defined function
             * @param data
             * @param privateKey
             * @return {*|{data, sign}|{data: *, sign: *}}
             */
            /*signData: function (data, privateKey) {
                return that.blockchain.wallet.signData(data, String(privateKey));
            }*/
        });


        /**
         * Contract Key-Value DB
         */
        vm.setObjectGlobal('_blocks', {
            getById: function (id, state) {
                let sync = vmSync();

                let block = state.block || null;
                if(!block) {
                    return sync.fails(false);
                }
                if(state.block.index <= id) {
                    return sync.fails(false);
                }

                that.blockchain.getBlockById(id, function (err, block) {
                    if(err) {
                        sync.fails(false);
                    } else {
                        if(id !== block.index) {
                            sync.fails(false);
                        } else {
                            sync.return(block);
                        }
                    }
                })
            }
        });
        //Inject blocks module
        vm.injectScript('new ' + function () {
            let waitForReturn = global.waitForReturn;
            let _blocks = global._blocks;
            global._blocks = undefined;
            global.blocks = {
                getById: function (id) {
                    _blocks.getById(id, global.state);
                    return waitForReturn();
                }
            };

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
                        sync.fails(false);
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
             * @param {string} event
             * @param {array}  args
             * @param {Block}  block
             * @param {string} address
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
                /**
                 * Emits event
                 * @param {string} event
                 * @param {array} args
                 * @return {*}
                 */
                emit: function (event, args) {
                    let state = global.getState();

                    assert.true(Array.isArray(args), 'Event arguments must be an array');
                    assert.true(args.length <= 10, 'Event can take 10 arguments maximum');
                    assert.true(typeof event === 'string', 'Event name must be a string');
                    _events._emit(event, args, state.block, state.contractAddress);
                    return waitForReturn();
                }
            };

        });

        vm.setObjectGlobal('_contracts', {
            /**
             * Calls method from another contract with data deploying
             * @param {string} contract Contract address
             * @param {string} method   Method name
             * @param {array}  args     Call arguments
             * @param {object} state    Current state
             * @private
             */
            _callMethodDeploy: function (contract, method, args, state) {

                let sync = vmSync();

                if(METHODS_BLACKLIST.indexOf(method) !== -1 || METHODS_BLACKLIST.indexOf('contract.' + method) !== -1) {
                    sync.fails();
                    throw 'Calling blacklisted method of contract is not allowed';
                }

                if(!state.rollback) {
                    let block = state.block || null;
                    if(!block) {
                        throw 'MethodDeploy: Can\'t detect block in state';
                    }
                    if(state.block.index <= Number(contract)) {
                        throw 'Block not found';
                    }
                }

                state.calledFrom = state.contractAddress;
                state.contractAddress = contract;
                that.callContractMethodDeployWait(contract, method, state, function (err, result) {
                    if(err) {
                        that.rollbackAndClearContractsChain(state, function () {
                            sync.fails();
                            throw new Error('Contracts calling chain fails with error: ' + err);
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
             * @param {string} contract Contract address
             * @param {string} method   Method name
             * @param {array}  args     Call arguments
             * @param {object} state    Current state
             * @private
             */
            _callMethodRollback: function (contract, method, args, state) {

                let sync = vmSync();

                if(METHODS_BLACKLIST.indexOf(method) !== -1 || METHODS_BLACKLIST.indexOf('contract.' + method) !== -1) {
                    sync.fails();
                    throw 'Calling blacklisted method of contract is not allowed';
                }


                /* let block = state.block || null;
                 if(!block){
                     throw 'MethodRollback: Can\'t detect block in state';
                 }
                 if(state.block.index <= Number(contract)) {
                     throw 'Block not found';
                 }*/

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
            },
            _getContractProperty: function (contract, property, state) {

                let sync = vmSync();
                if(!state.rollback) {
                    let block = state.block || null;
                    if(!block) {
                        throw 'GetProperty: Can\'t detect block in state';
                    }
                    if(state.block.index <= Number(contract)) {
                        throw 'Block not found';
                    }
                }

                state.calledFrom = state.contractAddress;
                state.contractAddress = contract;
                that.getContractProperty(contract, 'contract.' + property, function (err, result) {
                    if(err) {
                        sync.return(err);
                    } else {
                        if(!result) {
                            sync.return(false);
                        } else {
                            sync.return(result);
                        }
                    }
                });
            },
            /**
             * Add method for delayed calling
             * @param contract
             * @param method
             * @param args
             * @param state
             * @private
             */
            _addDelayedCall: function (contract, method, args, state) {

                if(!state.rollback) {
                    let block = state.block || null;
                    if(!block) {
                        throw 'DelayedCall: Can\'t detect block in state';
                    }
                    if(state.block.index <= Number(contract)) {
                        throw 'Block not found';
                    }
                }

                state.calledFrom = state.contractAddress;
                state.contractAddress = contract;
                if(that._delayedCallLimiter >= DELAYED_QUEUE_LIMIT) {
                    throw 'Maximum delayed call queue limit reached';
                }

                if(METHODS_BLACKLIST.indexOf(method) !== -1 || METHODS_BLACKLIST.indexOf('contract.' + method) !== -1) {
                    throw 'Calling blacklisted method of contract is not allowed';
                }

                that._delayedCallLimiter++;
                that._nextCallings.push({contract: contract, method: method, args: args, state: state});
            },
            /**
             * Returns master contract address
             * @param state
             * @private
             */
            _getMasterContractAddress: function (state) {
                let sync = vmSync();
                const address = that.config.ecmaContract.masterContract;
                if(address) {
                    if(state.block && state.block.index >= Number(address)) {
                        sync.return(String(address));
                        return;
                    }
                }
                sync.fails();

            }
        });

        vm.injectScript('new ' + function () {
            let waitForReturn = global.waitForReturn;
            let _contracts = global._contracts;
            global._contracts = undefined;
            global.contracts = {
                /**
                 * Call another contract method with deploy
                 * @param {string} contract Contract address
                 * @param {string} method   Method name
                 * @param {array}  args     Arguments array
                 * @param {object}  extendState     Extended state
                 * @return {*}
                 */
                callMethodDeploy: function (contract, method, args, extendState = {}) {
                    let state = global.getState();

                    state.extend = extendState;
                    state.delayedMethod = false;

                    if((contract === state.contractAddress || this.caller() === contract) && !this.isDelayedCall()) {
                        throw 'callMethodDeploy: You can\'t call method from himself1';
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
                 * Call another contract method with deploy
                 * @param {string} contract Contract address
                 * @param {string} method   Method name
                 * @param {array}  args     Arguments array
                 * @param {object}  extendState     Extended state
                 * @return {*}
                 */
                callDelayedMethodDeploy: function (contract, method, args, extendState = {}) {
                    let state = global.getState();

                    state.extend = extendState;
                    state.delayedMethod = true;

                    if((contract === state.contractAddress || this.caller() === contract) && !this.isDelayedCall()) {
                        throw 'callDelayedMethodDeploy: You can\'t call method from himself2';
                    }
                    if(typeof state.callingIndex === 'undefined') {
                        state.callingIndex = 0;
                    } else {
                        state.callingIndex++;
                    }
                    _contracts._addDelayedCall(contract, method, args, state);
                    return true;
                },

                /**
                 * Call another contract method with rollback
                 * @param contract
                 * @param method
                 * @param args
                 * @param {object}  extendState     Extended state
                 * @return {*}
                 */
                callMethodRollback: function (contract, method, args, extendState = {}) {
                    let state = global.getState();
                    state.extend = extendState;
                    state.delayedMethod = false;
                    if((contract === state.contractAddress || this.caller() === contract) && !this.isDelayedCall()) {
                        throw 'callMethodRollback: You can\'t call method from himself';
                    }

                    if(typeof state.callingIndex === 'undefined') {
                        state.callingIndex = 0;
                    } else {
                        state.callingIndex++;
                    }

                    _contracts._callMethodRollback(contract, method, args, state);
                    return waitForReturn();
                },
                /**
                 * Returns property value from another contract
                 * @param contract
                 * @param property
                 * @return {*}
                 */
                getContractProperty: function (contract, property) {
                    let state = global.getState();
                    state.delayedMethod = false;

                    if((contract === state.contractAddress || this.caller() === contract) && !this.isDelayedCall()) {
                        throw 'You can\'t call method from himself';
                    }
                    _contracts._getContractProperty(contract, property, state);
                    return waitForReturn();
                },
                /**
                 * Returns master contract address
                 * @return {*}
                 */
                getMasterContractAddress: function () {
                    let state = global.getState();

                    //Check if master contract in state
                    if(state.masterContractAddress) {
                        return String(state.masterContractAddress);
                    }

                    state.delayedMethod = false;
                    _contracts._getMasterContractAddress(state);
                    return String(waitForReturn());

                },
                /**
                 * Get parent caller address
                 * @return {*}
                 */
                caller: function () {
                    let state = global.getState();

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
                 * Is deploying now or just method call
                 * @return {boolean}
                 */
                isDeploy() {
                    let state = global.getState();

                    return typeof state !== 'undefined' && state.deploy;
                },
                isDelayedCall() {
                    let state = global.getState();
                    return typeof state.delayedMethod !== 'undefined' && state.delayedMethod;
                },
                /**
                 * Returns extended state object
                 * @return {*}
                 */
                getExtendedState() {
                    let state = global.getState();
                    if(typeof state['extend'] === 'undefined') {
                        return {};
                    }

                    return state.extend;
                },
                /**
                 * Get index of contract calling chain
                 * @return {number}
                 */
                callingIndex() {
                    let state = global.getState();

                    if(typeof state.callingIndex === 'undefined') {
                        return 0
                    } else {
                        return state.callingIndex;
                    }
                }
            };
        });

        vm.injectSource(__dirname + '/internalModules/mockdate.js');
        vm.injectScript('new ' + function () {
            let _MockDate = MockDate;
            global.updateExternalState = function () {
                global.updateState();

                let state = global.getState();

                if(typeof state.block !== 'undefined' && typeof state.block.timestamp !== 'undefined') {
                    _MockDate.set(new Date(state.block.timestamp));
                } else {
                    _MockDate.set(new Date(0));
                }
            };
            MockDate = undefined;
        });

        /**
         * Support external plugins
         */
        vm.setObjectGlobal('_plugins', that.plugins.ecma.getAllRegisteredFunctionsAsObject(function (err, val) {
                let sync = vmSync();
                if(!err) {
                    sync.return(val);
                } else {
                    sync.fails(false);
                }
            })
        );

        vm.injectScript('new ' + function () {
            let waitForReturn = global.waitForReturn;
            let _plugins = global._plugins;
            global._plugins = undefined;
            let funcObj = {};
            for (let key in _plugins) {
                if(!_plugins.hasOwnProperty(key)) {
                    continue;
                }

                //If namespaced method
                if(key.indexOf('.') !== -1) {
                    let nKey = key.split('.');
                    let namespace = nKey[0];
                    nKey = nKey[1];

                    if(typeof funcObj[namespace] === 'undefined') {
                        funcObj[namespace] = {};
                    }

                    funcObj[namespace][nKey] = function (...args) {
                        _plugins[key](...args);
                        return waitForReturn();
                    }

                } else { //Method without namespace
                    funcObj[key] = function (...args) {
                        _plugins[key](...args);
                        return waitForReturn();
                    }
                }

            }
            global.plugins = {};
            global.plugins = funcObj;
        });

        //Inject plugins scripts
        for (let s of that.plugins.ecma.injectedScripts) {
            vm.injectScript("" + s);
        }


        /**
         * Support for require external contracts
         */
        vm.injectSource(__dirname + '/internalModules/Require.js');
        vm.injectScript('new ' + function () {
            global.require = function (contractAddress) {
                return new Require(contractAddress);
            }
        });

        vm.injectSource(__dirname + '/internalModules/BigNumber.js');
        vm.injectSource(__dirname + '/internalModules/TypedKeyValue.js');
        /**
         * @deprecated
         */
        vm.injectSource(__dirname + '/internalModules/BlockchainObject.js');
        vm.injectSource(__dirname + '/internalModules/BlockchainMap.js');
        vm.injectSource(__dirname + '/internalModules/TokensRegister.js');
        vm.injectSource(__dirname + '/internalModules/Contract.js');
        vm.injectSource(__dirname + '/internalModules/TokenContract.js');
        vm.injectSource(__dirname + '/internalModules/Event.js');
        vm.injectSource(__dirname + '/internalModules/BlockchainArray.js');
        vm.injectSource(__dirname + '/internalModules/ContractConnector.js');
        vm.injectSource(__dirname + '/internalModules/TokenContractConnector.js');
        vm.injectSource(__dirname + '/internalModules/SellerContractConnector.js');


    }


    /**
     * Call contract method without deploying promise version. (Useful for testing and get contract information)
     * @param {string} address
     * @param {string} method
     * @param {Object} state
     * @param args
     */
    callContractMethodRollbackPromise(address, method, state, ...args) {
        let that = this;
        return new Promise((resolve, reject) => {
            that.callContractMethodRollback(address, method, state, function (err, result) {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            }, ...args);
        });
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
        let that = this;

        state.rollback = true;

        if(method.indexOf('._') !== -1 || method[0] === '_') {
            throw new Error('Calling private contract method in deploy method not allowed');
        }

        this.getContractInstanceByAddress(address, function (err, instance) {

            if(err) {
                logger.error('Error getting contract instance 1 for contract: ' + address + ' method ' + method);
                cb(new Error('Error getting contract instance 1 for contract: ' + address + ' method ' + method));
            } else {
                try {
                    instance.vm.waitForReady(function () {
                        if(instance.vm.isBusy()) {
                            logger.error('VM is busy');
                            cb(new Error('VM is busy'));
                            return;
                        }

                        instance.vm.setState(state);
                        instance.vm.runContextMethod("updateExternalState");
                        instance.vm.runContextMethodAsync('contract.' + method, function (err, result) {
                            if(err) {
                                logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                                that._nextCallings = [];
                                that._delayedCallLimiter = 0;
                                cb(new Error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err));
                                return;
                            }
                            try {
                                that.events.rollback(instance.vm.state.contractAddress, state.block.index, function () {
                                    instance.db.rollback(function () {
                                        that._nextCallings = [];
                                        that._delayedCallLimiter = 0;
                                        cb(null, result);
                                    });
                                });
                            } catch (e) {
                                instance.db.rollback(function () {
                                    that._nextCallings = [];
                                    that._delayedCallLimiter = 0;
                                    cb(null, result);
                                });
                            }


                        }, ...args);
                    });

                } catch (err) {
                    logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                    that._nextCallings = [];
                    that._delayedCallLimiter = 0;
                    cb(new Error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err));
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
     * @deprecated
     */

    callContractMethodDeploy(address, method, state, cb, ...args) {
        if(method.indexOf('._') !== -1 || method[0] === '_') {
            throw 'Calling private contract method in deploy method not allowed';
        }

        state.rollback = false;

        this.getContractInstanceByAddress(address, function (err, instance) {
            if(err) {
                cb(new Error('Error getting contract instance 3 for contract: ' + address + ' method ' + method));
            } else {
                try {
                    instance.vm.waitForReady(function () {
                        if(instance.vm.isBusy()) {
                            logger.error('VM is busy');
                            cb(new Error('VM is busy'));
                            return;
                        }

                        instance.vm.setState(state);
                        instance.vm.runContextMethod("updateExternalState");
                        instance.vm.runContextMethodAsync('contract.' + method, function (err, result) {
                            if(err) {
                                logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                                cb(new Error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err));
                                return;
                            }
                            instance.db.deploy(function () {
                                cb(null, result);
                            });

                        }, ...args);
                    });
                } catch (err) {
                    logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                    cb(new Error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err));
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

        state.rollback = false;

        if(method.indexOf('._') !== -1 || method[0] === '_') {
            throw new Error('Calling private contract method in deploy method not allowed');
        }


        this.getContractInstanceByAddress(address, function (err, instance) {
            if(err) {
                cb(new Error('Error getting contract instance 2 for contract 1: ' + address + ' method ' + method));
            } else {
                try {
                    that._instanceCallstack.push(instance);
                    instance.vm.waitForReady(function () {
                        if(instance.vm.isBusy()) {
                            logger.error('VM is busy');
                            cb(new Error('VM is busy'));
                            return;
                        }
                        instance.vm.setState(state);
                        instance.vm.runContextMethod("updateExternalState");

                        instance.vm.runContextMethodAsync('contract.' + method, async function (err, result) {
                            if(err) {
                                logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                                that._nextCallings = [];
                                that._delayedCallLimiter = 0;
                                cb(new Error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err));
                                return;
                            }

                            if(that._nextCallings.length === 0) {
                                cb(null, result);
                            } else {
                                let nextCall = that._nextCallings.shift();
                                await that.callContractMethodDeployWaitPromise(nextCall.contract, nextCall.method, nextCall.state, ...nextCall.args);
                                cb(null, result);
                            }

                        }, ...args);
                    });

                } catch (err) {
                    logger.error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err);
                    that._nextCallings = [];
                    that._delayedCallLimiter = 0;
                    cb(new Error('Contract `' + address + '` in method `' + method + '` falls with error: ' + err));
                }
            }
        });
    }

    /**
     * Deploy method promise version
     * @param address
     * @param method
     * @param state
     * @param args
     * @return {Promise<any>}
     */
    callContractMethodDeployWaitPromise(address, method, state, ...args) {
        let that = this;
        return new Promise((resolve, reject) => {
            that.callContractMethodDeployWait(address, method, state, function (err, result) {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            }, ...args);
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
                            that.events.rollback(that._instanceCallstack[a].vm.state.contractAddress, state.block.index, function () {
                                that._instanceCallstack[a].db.rollback(function () {
                                    resolve();
                                });
                            });

                        });
                    })()
                }
            }

            that._instanceCallstack = [];
            try {
                cb(null);
            } catch (e) {
                logger.error(e);
            }
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
        this.getContractInstanceByAddress(address, async function (err, instance) {
            if(err) {
                cb(err);
            } else {
                try {
                    cb(null, await instance.vm.getContextProperty(property));
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
            that.getOrCreateContractInstance(address, '', {}, function (instance) {
                cb(null, instance);
            });
            // cb(null, this._contractInstanceCache[address].instance);
        } else {
            this.contracts.get(address, function (err, contract) {
                if(err) {
                    cb(err);
                } else {
                    contract = JSON.parse(contract);
                    that.getOrCreateContractInstance(address, contract.code, contract.state, function (instance) {
                        cb(null, instance);
                    });

                }
            })
        }

    }

    /**
     * Async version of getContractInstanceByAddres
     * @param {string} address
     * @returns {Promise<Object>}
     */
    getContractInstanceByAddressAsync(address) {
        let that = this;
        return new Promise((resolve, reject) => {
            that.getContractInstanceByAddress(address, function (err, instance) {
                if(err) {
                    reject(err);
                } else {
                    resolve(instance);
                }
            })
        })
    }

    /**
     * Check if contract exists
     * @param {string} address
     * @returns {Promise<boolean>}
     */
    async contractExists(address) {
        try {
            await this.getContractInstanceByAddressAsync(address);
        } catch (e) {
            return false;
        }

        return true;
    }

    /**
     * Deploy contract with current wallet
     * @param {string|object} code Smart contract code or Signed deploy block
     * @param {string} resourceRent resource rent amount
     * @param {Function} cb deployed callback
     * @param {string|boolean} accountName Account name
     */
    async deployContract(code, resourceRent, cb, accountName = false) {
        let that = this;

        let deployBlock;
        if(typeof code === 'string') {
            let wallet = await this.accountManager.getAccountAsync(accountName);

            code = uglifyJs.minify(code).code;

            deployBlock = new EcmaContractDeployBlock(code, {
                randomSeed: random.int(0, 10000),
                from: wallet.id,
                resourceRent: String(resourceRent)
            });
            deployBlock = wallet.signBlock(deployBlock);
        } else {
            deployBlock = code
        }

        let testWallet = new Wallet(false, this.config);

        testWallet.createId(deployBlock.pubkey);
        if(testWallet.id !== deployBlock.state.from) {
            logger.error('Contract deploy check author error');
            cb(null);
            return;
        }

        function generateBlock() {
            that.blockchain.generateNextBlockAuto(deployBlock, async function (generatedBlock) {

                if(!await checkDeployingContractLength(generatedBlock.index, code.length)) {
                    logger.error(new Error('Deploying contract too big'));
                    cb(null);
                    return;
                }

                that.blockchain.addBlock(generatedBlock, function () {
                    that.blockchain.broadcastLastBlock();
                    cb({block: generatedBlock, address: generatedBlock.index});
                })
            });
        }

        /**
         * Check deploying contract length
         * @param codeLength
         * @returns {boolean}
         */
        async function checkDeployingContractLength(address, codeLength) {

            let maxContractLength = that.config.ecmaContract.maxContractLength;
            if((that.config.ecmaContract.masterContract) && (Number(address) > that.config.ecmaContract.masterContract)) {
                try {
                    maxContractLength = await that.callContractMethodRollbackPromise(that.config.ecmaContract.masterContract, 'getCurrentMaxContractLength', {});
                } catch (e) {

                }
            }

            if(codeLength > maxContractLength) {
                logger.error('Size contract is too large(' + codeLength + '). Max allow size - ' + maxContractLength);
                return false;
            }
            return true;
        }

        that.blockchain.getLatestBlock(function (latestBlock) {

            if(!that.config.ecmaContract.masterContract || latestBlock.index < that.config.ecmaContract.masterContract) {
                logger.info('Deploying contract without master contract');
                generateBlock();
            } else {
                logger.info('Deploying contract with master contract ' + that.config.ecmaContract.masterContract);
                that.callContractMethodRollback(that.config.ecmaContract.masterContract, 'processDeploy', {
                    deployState: deployBlock.state,
                    code: code,
                    contractAddress: latestBlock.index + 1
                }, function (err, result) {
                    if(err) {
                        throw err;
                    }
                    generateBlock();
                });
            }
        });
    }

    /**
     * Deploy call contract method
     * @param {string} address
     * @param {string} method
     * @param {Array|Object} args
     * @param {Object} state
     * @param {Function} cb
     * @param {string} accountName
     */
    deployContractMethod(address, method, args = [], state = {}, cb, accountName = false) {
        let that = this;


        that.getContractLimits(address, async function (limits) {


            if(!that.checkOrAddCallingLimitsControl(address, moment().utc().valueOf(), limits.callLimit, true)) {
                logger.error('Contract ' + address + ' calling limits exceed');
                return cb(new Error('Contract ' + address + ' calling limits exceed'));
            }

            let callBlock;


            let wallet = await that.accountManager.getAccountAsync(accountName);


            //If method is string - its method name. Object - is signed block
            if(Array.isArray(args)) {

                state.from = wallet.id;
                state.contractAddress = address;
                state.masterContractAddress = that.config.ecmaContract.masterContract ? that.config.ecmaContract.masterContract : false;

                callBlock = new EcmaContractCallBlock(address, method, args, state);
                callBlock = wallet.signBlock(callBlock);
            } else {
                callBlock = args;
                state.from = callBlock.state.from;
                state.contractAddress = callBlock.state.contractAddress;
                state.masterContractAddress = callBlock.state.masterContractAddress;
            }

            let testWallet = new Wallet(false, that.config);

            testWallet.createId(callBlock.pubkey);
            if(testWallet.id !== state.from) {
                logger.error('Contract method deploy check author error');
                cb(new Error('Contract method deploy check author error'));
                return;
            }

            that.blockchain.generateNextBlockAuto(callBlock, function (generatedBlock) {

                that.events._handleBlockReplay(generatedBlock.index, function () {
                    that._handleBlock(JSON.parse(generatedBlock.data), generatedBlock, true, (err) => {
                        if(err) {
                            cb(err);
                            return;
                        }
                        that.blockchain.addBlock(generatedBlock, function () {
                            that.blockchain.broadcastLastBlock();
                            cb(null, generatedBlock);
                        })
                    });
                });


            });
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

            this._contractInstanceCache[address] = true;
            this.createContractInstance(address, code, state, function (instance) {
                let timer = setTimeout(function () {
                    destroyInstanceTimer(instance);
                }, that._contractInstanceCacheLifetime);


                that._contractInstanceCache[address] = {instance: instance};
                that._contractInstanceCache[address].timer = timer;


                cb(instance);
            })

        } else {

            if(this._contractInstanceCache[address] === true) {
                setTimeout(function () {
                    that.getOrCreateContractInstance(address, code, state, cb);
                }, 100);
            } else {

                //If contract VM disposed, create new VM
                if(this._contractInstanceCache[address].instance.vm.isolate.isDisposed) {

                    let code = this._contractInstanceCache[address].instance.vm.script;
                    clearTimeout(this._contractInstanceCache[address].timer);
                    try {

                        this._contractInstanceCache[address].instance.vm.destroy();
                    } catch (e) {
                    }
                    try {
                        this._contractInstanceCache[address].instance.db.close(function () {
                            that._contractInstanceCache[address] = undefined;
                            delete that._contractInstanceCache[address];
                            that.getOrCreateContractInstance(address, code, state, cb);
                        });
                    } catch (e) {
                        that._contractInstanceCache[address] = undefined;
                        delete that._contractInstanceCache[address];
                        that.getOrCreateContractInstance(address, code, state, cb);
                    }
                } else {

                    clearTimeout(this._contractInstanceCache[address].timer);
                    this._contractInstanceCache[address].timer = setTimeout(function () {
                        if(that._contractInstanceCache[address]) {
                            destroyInstanceTimer(that._contractInstanceCache[address].instance);
                        }
                    }, this._contractInstanceCacheLifetime);

                    process.nextTick(function () {
                        cb(that._contractInstanceCache[address].instance);
                    });

                }
            }
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
            delete this._contractInstanceCache[addr];
            return;
        } else {
            db = new TransactionalKeyValue(/*this.config.workDir +*/ 'contractsRuntime/' + addr);
        }
        db.clear(function () {
            db.close(function () {
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


        /**
         * Initiate and run contract
         */
        function addNewContract() {

            state.block = block;
            state.contractAddress = address;
            let contract = {code: code, state: state};

            that.contracts.put(address, JSON.stringify(contract), function (err) {

                if(err) {
                    logger.error('Contract deploy handling error');
                    callback(true);
                    return;
                }
                let contractInstance = {};
                try {
                    state.deploy = true;
                    that.getOrCreateContractInstance(address, code, state, function (contractInstance) {
                        that.deployAndClearContractsChain(state, function () {
                            contractInstance.db.deploy(function () {
                                callback(null, contractInstance);
                            });
                        });

                    });
                } catch (e) {
                    logger.error('Contract deploy handling error ' + e);
                    callback(true);
                    return;
                }

            })

        }

        /**
         * Check deploy if master contract defined
         */
        function checkDeployByMaster() {

            that.blockchain.getLatestBlock(function (latestBlock) {

                if(!that.config.ecmaContract.masterContract || that._lastKnownBlock < that.config.ecmaContract.masterContract || block.index === that.config.ecmaContract.masterContract) {
                    addNewContract()
                } else {
                    that.callContractMethodDeployWait(that.config.ecmaContract.masterContract, 'processDeploy', {
                        deployState: state,
                        code: code,
                        contractAddress: block.index
                    }, function (err, result) {
                        if(err) {
                            logger.error('Contract deploy handling error ' + err);
                            callback(true);
                        } else {
                            addNewContract();
                        }
                    });
                }

            });
        }

        //Checking for contract already created
        this.contracts.get(address, function (err, contract) {
            if(err) {
                checkDeployByMaster();
            } else {
                let oldContract = JSON.parse(contract);
                that.destroyContractByAddress(address, function () {
                    checkDeployByMaster();
                });
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
     * @param {boolean} testOnly
     * @param {Function} callback
     * @private
     */
    _handleContractCall(address, method, args, state, block, testOnly, callback) {


        let that = this;
        if((method === 'contract.deploy') || (method === 'deploy')) {
            logger.error('Calling deploy method of contract is not allowed');
            return callback(new Error('Calling deploy method of contract is not allowed'));
        }

        //Prevert blacklist call
        if(METHODS_BLACKLIST.indexOf(method) !== -1 || METHODS_BLACKLIST.indexOf('contract.' + method) !== -1) {
            logger.error('Calling blacklisted method of contract is not allowed');
            return callback(new Error('Calling blacklisted method of contract is not allowed'));
        }

        //Check call limits
        that.getContractLimits(address, function (limits) {

            if(!that.checkOrAddCallingLimitsControl(address, block.timestamp, limits.callLimit, false)) {
                logger.error('Contract ' + address + ' calling limits exceed');
                return callback(new Error('Contract ' + address + ' calling limits exceed'));
            }


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
                        logger.error('Contracts calling chain falls with error: ' + err);
                        callback(new Error('Contracts calling chain falls with error: ' + err));
                    });
                } else {
                    if(testOnly) {
                        that.rollbackAndClearContractsChain(state, function () {
                            callback();
                        });
                    } else {
                        that.deployAndClearContractsChain(state, function () {
                            callback();
                        });
                    }
                }

            });
            for (let a in args) {
                if(args.hasOwnProperty(a)) {
                    callstack.push(args[a]);
                }
            }
            that.callContractMethodDeployWait.apply(that, callstack);

        });


    }

    /**
     * Handle Ecma blocks
     * @param {EcmaContractDeployBlock} blockData
     * @param {Block} block
     * @param {boolean} testOnly
     * @param {Function} callback
     * @private
     */
    _handleBlock(blockData, block, testOnly, callback) {
        let that = this;
        let verifyBlock = {};
        let testWallet = new Wallet(false, that.config);




        switch (blockData.type) {
            case EcmaContractDeployBlock.blockType:


                verifyBlock = new EcmaContractDeployBlock(blockData.ecmaCode, blockData.state);

                if(verifyBlock.data !== blockData.data) {
                    logger.error('Contract invalid data in block ' + block.index);
                    callback(new Error('Contract invalid data in block ' + block.index));
                    return
                }

                //Checking sign and wallet id equals
                testWallet.createId(blockData.pubkey);
                if(!this.blockchain.wallet.verifyData(blockData.data, blockData.sign, blockData.pubkey) || blockData.state.from !== testWallet.id) {
                    logger.error('Contract invalid sign in block ' + block.index);
                    callback(new Error('Contract invalid sign in block ' + block.index));
                    return
                }

                this._handleContractDeploy(block.index, blockData.ecmaCode, blockData.state, block, callback);
                break;

            case EcmaContractCallBlock.blockType:

                verifyBlock = new EcmaContractCallBlock(blockData.address, blockData.method, blockData.args, blockData.state);
                if(verifyBlock.data !== blockData.data) {
                    logger.error('Contract invalid data in block ' + block.index);
                    callback(new Error('Contract invalid data in block ' + block.index));
                    return
                }

                //Checking sign and wallet id equals
                testWallet.createId(blockData.pubkey);
                if(!this.blockchain.wallet.verifyData(blockData.data, blockData.sign, blockData.pubkey) || blockData.state.from !== testWallet.id) {
                    logger.error('Contract invalid sign in block ' + block.index);
                    callback(new Error('Contract invalid sign in block ' + block.index));
                    return
                }

                this._handleContractCall(blockData.address, blockData.method, blockData.args, blockData.state, block, testOnly, callback);


                break;
            default:
                logger.error('Unexpected block type ' + block.index);
                callback(new Error('Unexpected block type ' + block.index));
        }
    }

    /**
     * Register RPC methods and callbacks
     * @private
     */
    _registerRPCMethods() {
        let app = storj.get('httpServer');
        let that = this;
        if(!app) {
            logger.error("Can't register RPC methods for EcmaContract");
            return;
        }


        app.get('/contracts/ecma/getInfo', async function (req, res) {
            res.send({
                ready: that.ready,
                lastBlock: that._lastKnownBlock
            });

        });


        app.get('/contracts/ecma/getContractInfo/:address', async function (req, res) {
            that.getContractInstanceByAddress(req.params.address, async function (err, instance) {
                if(err) {
                    res.send({error: true});
                    return;
                }
                res.send({info: instance.info, initState: instance.vm.state, source: instance.vm.script});
            });
        });


        app.get('/contracts/ecma/contractExists/:address', async function (req, res) {
            try {
                res.send(await that.contractExists(req.params.address));
            } catch (e) {
                res.send({error: true, message: e.message, message2: JSON.stringify(e)});
            }
        });

        app.get('/contracts/ecma/getContractProperty/:address/:property', async function (req, res) {
            let contract = new ContractConnector(that, req.params.address);
            try {
                res.send({result: await contract.getPropertyPromise(req.params.property)});
            } catch (e) {
                res.send({error: true, message: e.message, message2: JSON.stringify(e)});
            }
        });

        app.post('/contracts/ecma/callMethod/:address/:method', async function (req, res) {

            if(typeof req.body.argsEncoded !== 'undefined') {
                req.body.args = JSON.parse(req.body.argsEncoded);
            } else {
                req.body.args = req.body['args[]'];
                if(typeof req.body.args === 'undefined') {
                    req.body.args = [];
                }
            }

            if(!Array.isArray(req.body.args)) {
                req.body.args = [req.body.args];
            }

            let accountName = req.params.accountName ? req.params.accountName : false;

            let contract = new ContractConnector(that, req.params.address, accountName);
            contract.registerMethod(req.params.method);
            try {
                res.send({result: await contract[req.params.method](...req.body.args)});
            } catch (e) {
                res.send({error: true, message: e.message, message2: JSON.stringify(e)});
            }
        });

        app.post('/contracts/ecma/deployMethod/:address/:method', async function (req, res) {

            if(typeof req.body.argsEncoded !== 'undefined') {
                req.body.args = JSON.parse(req.body.argsEncoded);
            } else {
                req.body.args = req.body['args[]'];
                if(typeof req.body.args === 'undefined') {
                    req.body.args = [];
                }
            }
            if(!Array.isArray(req.body.args)) {
                req.body.args = [req.body.args];
            }

            let accountName = req.params.accountName ? req.params.accountName : false;

            let contract = new ContractConnector(that, req.params.address, accountName);
            contract.registerDeployMethod(req.params.method);
            try {
                res.send({result: await contract[req.params.method](...req.body.args)});
            } catch (e) {
                res.send({error: true, message: e.message, message2: JSON.stringify(e)});
            }
        });

        app.post('/contracts/ecma/deploySignedMethod/:address', async function (req, res) {

            let source = req.body.source;
            source = JSON.parse(source);

            let contract = new ContractConnector(that, req.params.address);

            try {
                res.send({result: await contract.deployContractMethod(req.params.method, source)});
            } catch (e) {
                res.send({error: true, message: e.message, message2: JSON.stringify(e)});
            }
        });

        app.post('/contracts/ecma/deployContract', async function (req, res) {
            try {
                let src = req.body.source;
                let resourceRent = req.body.resourceRent;

                if(typeof src === 'undefined' || src.length === 0) {
                    res.send({error: true, message: 'Empty source'});
                    return;
                }

                //If we got an object - is a signed block. String - contract source
                try {
                    src = JSON.parse(src);
                } catch (e) {
                }

                let accountName = req.params.accountName ? req.params.accountName : false;

                that.deployContract(
                    src,
                    resourceRent,
                    function (deployResult) {
                        if(deployResult.error) {
                            res.send({error: true, message: deployResult.error});
                        } else {
                            res.send({result: deployResult});
                        }
                    },
                    accountName
                );
            } catch (e) {
                res.send({error: true, message: e.message, message2: JSON.stringify(e)});
            }
        });
    }

    /**
     * Termination handling
     * @param cb
     */
    terminate(cb) {
        logger.info('Terminating...');
        let that = this;
        this.events.flush(function (err) {
            if(err) {
                logger.error(err);
            }
            that.db.deploy(function () {
                that.db.save(function () {
                    cb();
                });
            });
        })
    }
}

module.exports = EcmaContract;