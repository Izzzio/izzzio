/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const namedStorage = new (require('../modules/NamedInstanceStorage'))();

const MessagesDispatcher = require('../modules/messagesDispatcher');
const EcmaContract = require('../modules/smartContracts/EcmaContract');

let that;

class DApp {

    constructor(config, blockchain) {

        //Assign named storage
        namedStorage.assign(config.instanceId);

        this.config = config;
        this.blockchain = blockchain;
        this.rpc = namedStorage.get('httpServer');

        /***
         * @var {starwaveProtocol} this.starwave
         */
        this.starwave = namedStorage.get('starwaveProtocol');

        this.ecmaContract = namedStorage.get('ecmaContract');

        /**
         * @var {AccountManager}
         */
        this.accounts = namedStorage.get('accountManager');


        that = this;
        /**
         * Message dispatcher
         * @type {MessagesDispatcher}
         * @private
         */
        this._messagesDispatcher = new MessagesDispatcher(config, blockchain);

        /**
         * Network functions
         * @type {{getCurrentPeers: ((function(*=): (*|Array))|getCurrentPeers), getSocketByBusAddress: getSocketByBusAddress, socketSend: *, rpc: {registerGetHandler: DApp.network.rpc.registerGetHandler, registerPostHandler: DApp.network.rpc.registerPostHandler}}}
         */
        this.network = {
            getCurrentPeers: that.blockchain.getCurrentPeers,
            getSocketByBusAddress: that.blockchain.getSocketByBusAddress,
            socketSend: that.blockchain.write,
            rpc: {
                registerGetHandler: function (url, cb) {
                    that.rpc.get(url, cb);
                },
                registerPostHandler: function (url, cb) {
                    that.rpc.post(url, cb);
                },
            }
        };

        /**
         * Messaging functions
         * @type {{registerMessageHandler: (function(): boolean), broadcastMessage: (function(): void), sendMessage: (function(): void), starwave: {registerMessageHandler: (function(): any), sendMessage: (function(): any), createMessage: (function(): any)}}}
         */
        this.messaging = {
            registerMessageHandler: function () {
                return that._messagesDispatcher.registerMessageHandler.apply(that._messagesDispatcher, arguments)
            },
            broadcastMessage: function () {
                return that._messagesDispatcher.broadcastMessage.apply(that._messagesDispatcher, arguments)
            },
            sendMessage: function () {
                return that._messagesDispatcher.sendMessage.apply(that._messagesDispatcher, arguments)
            },
            starwave: {
                registerMessageHandler: function () {
                    return that.starwave.registerMessageHandler.apply(that._messagesDispatcher, arguments)
                },
                sendMessage: function () {
                    return that.starwave.sendMessage.apply(that._messagesDispatcher, arguments)
                },
                createMessage: function () {
                    return that.starwave.createMessage.apply(that._messagesDispatcher, arguments)
                },
            }
        };

        /**
         * Blockchain functions
         * @type {{generateBlock: (function(*=, *=, *=): boolean), generateAndAddBlock: DApp.generateAndAddBlock, handler: {get: (function(): (*|BlockHandler)), registerHandler: (function(string, Function): boolean)}, accounting: {wallet: {getCurrent: (function(): (DApp.block.accounting.wallet|{getCurrent}|*))}}}}
         */
        this.blocks = {
            generateBlock: function () {
                return that.generateBlock.apply(that, arguments)
            },
            generateAndAddBlock: function () {
                return that.generateAndAddBlock.apply(that, arguments)
            },
            addBlock: function () {
                return that.blockchain.addBlock.apply(that, arguments)
            },
            /**
             * Async get block by index
             * @param {number} blockIndex
             * @returns {Promise<Block>}
             */
            getBlockAsync: function (blockIndex) {
                return new Promise((resolve, reject) => {
                    that.blockchain.getBlockById(blockIndex, (err, val) => {
                        if(err) {
                            return reject(err);
                        }

                        resolve(val);
                    })
                });
            },
            /**
             * Returns block by index
             * @param {number} blockIndex
             * @param {Function} cb
             */
            getBlock: function (blockIndex, cb) {
                that.blockchain.getBlockById(blockIndex, cb);
            },
            handler: {
                get: that.getBlockHandler,
                registerHandler: that.registerBlockHandler
            },
            accounting: {
                wallet: {
                    getCurrent: that.getCurrentWallet
                },
                manager: this.accounts
            }
        };

        /**
         * Smart contracts functions
         * @type {{ecmaContract: EcmaContract}}
         */
        this.contracts = {
            /**
             * @type EcmaContract
             */
            ecmaContract: that.ecmaContract,
            /**
             * @type EcmaContract
             */
            ecma: that.ecmaContract,
            ecmaPromise: {
                /**
                 * Promised version of EcmaContracts methods
                 * deployContract
                 * @param source
                 * @param resourceRent
                 * @param accountName
                 * @return {Promise<any>}
                 */
                deployContract: function (source, resourceRent = 0, accountName = false) {
                    return new Promise((resolve, reject) => {
                        that.ecmaContract.deployContract(source, resourceRent, function (block) {
                            if(block === null) {
                                return reject(new Error('Contract deploy general error'));
                            }

                            if(block.error) {
                                return reject(new Error(block.error));
                            }

                            resolve(block);
                        }, accountName);
                    })
                },
                /**
                 * deployMethod
                 * @param address
                 * @param method
                 * @param args
                 * @param state
                 * @param accountName
                 * @return {Promise<any>}
                 */
                deployMethod: function (address, method, args = [], state = {}, accountName = false) {
                    return new Promise((resolve, reject) => {
                        try {
                            that.ecmaContract.deployContractMethod(address, method, args, state, function (err, generatedBlock) {
                                if(err) {
                                    reject(err);
                                    return;
                                }
                                resolve(generatedBlock);
                            }, accountName)
                        } catch (e) {
                            reject(e);
                        }
                    });
                },
                /**
                 * callMethodRollback
                 * @param address
                 * @param method
                 * @param args
                 * @param state
                 * @return {Promise<any>}
                 */
                callMethodRollback: function (address, method, args = [], state = {}) {
                    return new Promise((resolve, reject) => {
                        try {
                            that.ecmaContract.callContractMethodRollback(address, method, state, function (err, result) {
                                if(err) {
                                    reject(err);
                                    return;
                                }
                                resolve(result);
                            }, ...args);
                        } catch (e) {
                            reject(e);
                        }
                    });
                },
                /**
                 * Check if contract exists
                 * @param {string} address
                 * @returns {Promise<boolean>}
                 */
                contractExists: function (address) {
                    return that.ecmaContract.contractExists(address);
                }
            }
        };

        /**
         * System functions
         * @type {{getConfig: *}}
         */
        this.system = {
            getConfig: that.getConfig()
        };
    }


    /**
     * Register message handler
     * @param {string} message
     * @param {function} handler
     * @return {boolean}
     */
    registerMessageHandler(message, handler) {
        return that._messagesDispatcher.registerMessageHandler(message, handler);
    }


    /**
     * Generates new block with configured consensus
     * @param blockData
     * @param cb
     * @param cancelCondition
     */
    generateBlock(blockData, cb, cancelCondition) {
        return that.blockchain.generateNextBlockAuto(blockData, cb, cancelCondition);
    }

    /**
     * Generates new block with configured consensus and adds to blockchain
     * @param blockData
     * @param cb
     * @param cancelCondition
     */
    generateAndAddBlock(blockData, cb, cancelCondition) {
        let that = this;
        that.generateBlock(blockData, function (generatedBlock) {
            that.blockchain.addBlock(generatedBlock, function () {
                that.blockchain.broadcastLastBlock();
                cb(generatedBlock);
            });

        }, cancelCondition);
    }

    /**
     * Returns config object
     * @return {*}
     */
    getConfig() {
        return namedStorage.get('config');
    }

    /**
     * Returns appConfig section of config file
     * @returns {*}
     */
    getAppConfig() {
        return this.getConfig()['appConfig'];
    }

    /**
     * Returns block handler object
     * @return {BlockHandler}
     */
    getBlockHandler() {
        return that.blockchain.blockHandler;
    }

    /**
     * Returns current wallet object
     * @return {Wallet}
     */
    getCurrentWallet() {
        return that.blockchain.wallet;
    }

    /**
     * Register block handler by type
     * @param {string} type
     * @param {function} handler
     * @return {boolean}
     */
    registerBlockHandler(type, handler) {
        return that.getBlockHandler().registerBlockHandler(type, handler);
    }

    /**
     * Returns array of peers addresses or sockets
     * @param fullSockets
     * @return {*|Array}
     */
    getCurrentPeers(fullSockets) {
        return that.blockchain.getCurrentPeers(fullSockets);
    }

    /**
     * Returns master contract address
     * @return {number}
     */
    getMasterContractAddress() {
        return that.getConfig().ecmaContract.masterContract
    }

    /**
     * Initiate Application start
     */
    init() {

    }

    /**
     * Terminating app
     */
    terminate(cb) {
        cb();
    }
}

module.exports = DApp;