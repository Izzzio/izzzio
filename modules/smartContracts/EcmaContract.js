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

        /**
         * @var {BlockHandler} this.blockHandler
         */
        this.blockHandler = storj.get('blockHandler');

        this.blockHandler.registerBlockHandler(EcmaContractDeployBlock.blockType, function (blockData, block, callback) {
            that.handleBlock(blockData, block, callback)
        });

        /*this.blockHandler.registerBlockHandler('Document', function (blockData, block, callback) {
            that.handleBlock(blockData, block, callback)
        });*/


        logger.info('Initialized');


        setTimeout(function () {
            that.deployContract('', function (generatedBLock) {
                //console.log(generatedBLock);
                //console.log(generatedBLock);

                setTimeout(function () {
                    that.getContractProperty(generatedBLock.index, 'contract.contract', function (err, val) {
                        console.log(val);
                        process.exit();
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
     * @return {{vm: VM, db: KeyValueInstancer}}
     */
    createContractInstance(address, code, state) {
        let vm = new VM({ramLimit: this.config.ecmaContract.ramLimit});
        let db = new KeyValueInstancer(this.db, address);
        try {
            vm.compileScript(code, state);
            vm.setObjectGlobal('state', state);
            this._setupVmFunctions(vm);
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
     * @param vm
     * @private
     */
    _setupVmFunctions(vm) {
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
    }

    /**
     * Call contract method without deploying. (Useful for testing and get contract information)
     * @param {string} address
     * @param {string} method
     * @param {Function} cb
     * @param args
     */
    callContractMethodRollback(address, method, cb, ...args) {
        /* if(method.indexOf('contract._') !== -1) {
             throw 'Calling private contract method not allowed';
         }*/

        this.getContractInstanceByAddress(address, function (err, instance) {
            if(err) {
                cb(err);
            } else {
                try {
                    let result = instance.vm.runContextMethod(method, ...args);
                    instance.db.rollback(function () {
                        cb(null, result);
                    });

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
            console.log('CONTRACT FROM CACHE');
            cb(null, this._contractInstanceCache[address].instance);
        } else {
            this.contracts.get(address, function (err, contract) {
                console.log('CONTRACT FROM DB');
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

    deployContract(code, cb) {
        let that = this;
        //TODO: write other code
        code = 'new ' + function () {
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
                        owner: false,
                    };
                }

                constructor() {
                    this.walletsBalance = {};
                }

                /**
                 * Mint tokens
                 * @param to
                 * @param amount
                 */
                mint(to, amount) {
                    if(typeof this.walletsBalance[to] === 'undefined') {
                        this.walletsBalance[to] = 0;
                    }

                    this.walletsBalance[to] += amount;
                }

                /**
                 * Get balance of wallet
                 * @param address
                 * @return {*}
                 */
                balanceOf(address) {
                    if(typeof this.walletsBalance[address] !== 'undefined') {
                        return this.walletsBalance[address];
                    }
                    return 0;
                }

                /**
                 * Internal transfer func
                 * @param from
                 * @param to
                 * @param amount
                 * @private
                 */
                _transfer(from, to, amount) {
                    //Check balance
                    assert.defined(this.walletsBalance[from], 'Unknown wallet ' + from);
                    assert.gt(this.walletsBalance[from], amount, 'Insufficient funds');

                    if(typeof this.walletsBalance[to] === 'undefined') {
                        this.walletsBalance[to] = 0;
                    }

                    this.walletsBalance[from] -= amount;
                    this.walletsBalance[to] += amount;
                }

                /**
                 * Transfer method
                 * @param to
                 * @param amount
                 */
                transfer(to, amount) {
                    this._transfer(state.sender, to, amount);
                }
            }

            global.registerContract(SimpleToken);
        };

        code = uglifyJs.minify(code).code;

        let deployBlock = new EcmaContractDeployBlock(code, {randomSeed: random.int(0, 10000)});
        deployBlock = this.blockchain.wallet.signBlock(deployBlock);

        this.blockchain.generateNextBlockAuto(deployBlock, function (generatedBlock) {
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
     * Handle Ecma blocks
     * @param {EcmaContractDeployBlock} blockData
     * @param {Block} block
     * @param {Function} callback
     */
    handleBlock(blockData, block, callback) {
        let that = this;

        switch (blockData.type) {
            case EcmaContractDeployBlock.blockType:
                this._handleContractDeploy(block.index, blockData.ecmaCode, blockData.state, callback);
                break;
            case '':
                break;
            default:
                logger.error('Unexpected block type ' + block.index);
                callback();
        }

        return;

        let contract = this.getOrCreateContractInstance('000', '', {randomSeed: 1});

        console.log(contract);

        that.callContractMethodRollback('000', 'contract.balanceOf', function (err, value) {
            console.log(value);
            that.callContractMethodRollback('000', 'contract.mint', function (err, value) {
                that.callContractMethodRollback('000', 'contract._transfer', function (err, value) {
                    that.callContractMethodRollback('000', 'contract.balanceOf', function (err, value) {
                        console.log(value);
                        callback();
                    }, '001');
                }, '000', '001', 100);
            }, '000', 1000);
        }, '000');


    }
}

module.exports = EcmaContract;