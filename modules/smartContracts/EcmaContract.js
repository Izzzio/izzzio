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
         * @var {BlockHandler} this.blockHandler
         */
        this.blockHandler = storj.get('blockHandler');

        this.blockHandler.registerBlockHandler(EcmaContractDeployBlock.blockType, function (blockData, block, callback) {
            that.handleBlock(blockData, block, callback);
        });

        this.blockHandler.registerBlockHandler(EcmaContractCallBlock.blockType, function (blockData, block, callback) {
            that.handleBlock(blockData, block, callback);
        });

        /*this.blockHandler.registerBlockHandler('Document', function (blockData, block, callback) {
            that.handleBlock(blockData, block, callback)
        });*/


        logger.info('Initialized');


        let code = 'new ' + function () {
            class SimpleToken {

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
                        decimals: 10,
                        owner: '3e761301cbdaf93c4f0188d11bd9b49411154b83e86c5ba54d3896d7f8fe8bc2',
                    };
                }

                constructor() {
                    this.wallets = new TokensRegister(this.contract.ticker);
                }

                test(amount, sayIt) {
                    assert.assert(this.contract.owner !== state.from, 'Restricted access');
                    this.wallets.setBalance('000', '20');
                    this.wallets.setBalance('001', '0');

                    this.wallets.transfer('000', '001', state.block.index);

                    console.log(sayIt);
                    console.log(state);
                    return 123;
                }

                /**
                 * Mint tokens
                 * @param to
                 * @param amount
                 */
                mint(to, amount) {
                    assert.assert(this.contract.owner !== state.from, 'Restricted access');
                    this.wallets.deposit(to, amount);
                }

                /**
                 * Get balance of wallet
                 * @param address
                 * @return {*}
                 */
                balanceOf(address) {
                    return this.wallets.balanceOf(address).toFixed();
                }

                /**
                 * Transfer method
                 * @param to
                 * @param amount
                 */
                transfer(to, amount) {
                    this.wallets.transfer(state.from, to, amount);
                }
            }

            global.registerContract(SimpleToken);
        };


        setTimeout(function () {
            that.deployContract(code, function (generatedBLock) {
                setTimeout(function () {
                    /*that.callContractMethodRollback(generatedBLock.index, 'contract.test', function (err, val) {
                        console.log("RESULT", val);
                        process.exit();

                    });*/

                    that.deployContractMethod(generatedBLock.index, 'test', [5, 'Hello world!'], {}, function (generatedBlock) {
                        that.callContractMethodRollback(generatedBLock.index, 'balanceOf', {}, function (err, val) {
                            console.log('Balance of 001 ', val);
                            that.callContractMethodRollback(generatedBLock.index, 'balanceOf', {}, function (err, val) {
                                console.log('Balance of 000 ', val);
                                process.exit();
                            }, '000');

                        }, '001');
                        //console.log(generatedBlock);

                    })
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
     * @return {{vm: VM, db: KeyValueInstancer}}
     */
    createContractInstance(address, code, state) {
        let vm = new VM({ramLimit: this.config.ecmaContract.ramLimit});
        let db = new KeyValueInstancer(this.db, address);
        try {
            vm.setTimingLimits(10000);
            vm.compileScript(code, state);
            vm.setObjectGlobal('state', state);
            this._setupVmFunctions(vm, db);
            vm.execute();
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
                console.log(that._dbInstances);
                return that._dbInstances[handleId].namespace;
            },
            _get: function (handleId, key) {
                vm.setObjectGlobal('_execResult', {status: 0});
                that._dbInstances[handleId].get(key, function (err, val) {
                    if(!err) {
                        vm.setObjectGlobal('_execResult', {status: 1, result: val});
                    } else {
                        vm.setObjectGlobal('_execResult', {status: 1, result: false});
                    }
                });

                return true;
            },
            _put: function (handleId, key, value) {
                vm.setObjectGlobal('_execResult', {status: 0});
                that._dbInstances[handleId].put(key, value, function (err) {
                    vm.setObjectGlobal('_execResult', {status: 1, result: err});
                });
                return true;
            }
        });
        //Inject DB module
        vm.injectScript('new ' + function () {
            let _db = global._db;
            global._db = undefined;
            global.KeyValue = function (dbName) {
                let that = this;

                function waitForReturn() {
                    while (true) {
                        if(global._execResult.status !== 0) {
                            return global._execResult.result
                        } else {
                            system.processMessages();
                        }
                    }
                }

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
        vm.injectSource(__dirname + '/modules/BigNumber.js');
        vm.injectSource(__dirname + '/modules/TokensRegister.js');
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
                    instance.vm.runContextMethodAsync('contract.' + method, function (result) {
                        instance.db.rollback(function () {
                            cb(null, result);
                        });

                    }, ...args);

                } catch (e) {
                    logger.error('Contract ' + address + ' method ' + method + ' falls with error: ' + e);
                    cb(e);
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
                    instance.vm.runContextMethodAsync('contract.' + method, function (result) {
                        instance.db.deploy(function () {
                            cb(null, result);
                        });

                    }, ...args);

                } catch (e) {
                    logger.error('Contract ' + address + ' method ' + method + ' falls with error: ' + e);
                    cb(e);
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
                    let instance = that.getOrCreateContractInstance(address, contract.code, contract.state);
                    cb(null, instance)
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
                cb(generatedBlock);
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
     * @return {*}
     */
    getOrCreateContractInstance(address, code, state) {
        let that = this;
        if(typeof this._contractInstanceCache[address] === 'undefined') {
            let instance = {instance: this.createContractInstance(address, code, state)};
            instance.timer = setTimeout(function () {
                that._contractInstanceCache[address].instance.vm.destroy();
                that._contractInstanceCache[address] = undefined;
                delete that._contractInstanceCache[address];
            }, this._contractInstanceCacheLifetime);
            this._contractInstanceCache[address] = instance;
            return instance.instance;

        } else {
            clearTimeout(this._contractInstanceCache[address].timer);
            this._contractInstanceCache[address].timer = setTimeout(function () {
                that._contractInstanceCache[address].instance.vm.destroy();
                that._contractInstanceCache[address] = undefined;
                delete that._contractInstanceCache[address];
            }, this._contractInstanceCacheLifetime);

            return this._contractInstanceCache[address].instance;
        }
    }

    /**
     * Destroy instance
     * @param instance
     */
    destroyContractInstance(instance, cb) {
        //TODO: Delete contract DB instances
        instance.vm.destroy();
        instance = undefined;
        cb();
    }


    /**
     *  Handling contract deploy
     * @param {string} address
     * @param {string} code
     * @param {Object} state
     * @param {Function} callback
     * @private
     */
    _handleContractDeploy(address, code, state, callback) {
        let that = this;

        function addNewContract() {
            let contract = {code: code, state: state};
            that.contracts.put(address, JSON.stringify(contract), function (err) {
                if(err) {
                    logger.error('Contract deploy handling error');
                    callback(true);
                }
                let contractInstance = {};
                try {
                    contractInstance = that.getOrCreateContractInstance(address, code, state);
                } catch (e) {
                    logger.error('Contract deploy handling error ' + e);
                    callback(true);
                    return;
                }
                callback(null, contractInstance);
            })

        }

        this.contracts.get(address, function (err, contract) {
            if(err) {
                addNewContract();
            } else {
                let oldContract = JSON.parse(contract);
                //TODO Contract changed. Destroy it correctly
                if(oldContract.state.codeHash !== state.codeHash) {

                }
                //Handle contract deploying
                addNewContract();
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

        let callstack = [];
        callstack.push(address);
        callstack.push(method);
        callstack.push(state);
        callstack.push(function (err, result) {
            console.log('METHOD CALL', address, method, result);
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

                this._handleContractDeploy(block.index, blockData.ecmaCode, blockData.state, callback);
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