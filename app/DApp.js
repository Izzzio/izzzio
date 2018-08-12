/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const storj = require('../modules/instanceStorage');
const MessagesDispatcher = require('../modules/messagesDispatcher');

let that;

class DApp {

    constructor(config, blockchain) {
        this.config = config;
        this.blockchain = blockchain;
        this.rpc = storj.get('httpServer');


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
         * @type {{registerMessageHandler: MessagesDispatcher.registerMessageHandler, broadcastMessage: MessagesDispatcher.broadcastMessage, sendMessage: MessagesDispatcher.sendMessage}}
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
            }
        };

        /**
         * Blockchain functions
         * @type {{generateBlock: (function(*=, *=, *=): boolean), generateAndAddBlock: DApp.generateAndAddBlock, handler: {get: (function(): (*|BlockHandler)), registerHandler: (function(string, Function): boolean)}, accounting: {wallet: {getCurrent: (function(): (DApp.block.accounting.wallet|{getCurrent}|*))}}}}
         */
        this.blocks = {
            generateBlock: that.generateBlock,
            generateAndAddBlock: that.generateAndAddBlock,
            addBlock: that.blockchain.addBlock,
            handler: {
                get: that.getBlockHandler,
                registerHandler: that.registerBlockHandler
            },
            accounting: {
                wallet: {
                    getCurrent: that.getCurrentWallet
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
        return storj.get('config');
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