/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const MESSAGE_MUTEX_TIMEOUT = 1000;

class DApp {

    constructor(config, blockchain) {
        this.config = config;
        this.blockchain = blockchain;
        /**
         * Input message mutex
         * @type {{}}
         * @private
         */
        this._messageMutex = {};
    }


    /**
     * Register message handler
     * @param {string} message
     * @param {function} handler
     * @return {boolean}
     */
    registerMessageHandler(message, handler) {
        let that = this;
        if(typeof that.blockchain !== 'undefined') {
            this.blockchain.registerMessageHandler(message, function (messageBody) {
                if(messageBody.id === message || message.length === 0) {
                    if(typeof  messageBody.mutex !== 'undefined' && typeof that._messageMutex[messageBody.mutex] === 'undefined') {
                        handler(messageBody);
                        that._messageMutex[messageBody.mutex] = true;
                        setTimeout(function () {
                            if(typeof that._messageMutex[messageBody.mutex] !== 'undefined') {
                                delete that._messageMutex[messageBody.mutex];
                            }
                        }, MESSAGE_MUTEX_TIMEOUT);
                    }
                }
            });
            return true;
        }

        return false;
    }

    /**
     * Generates new block with configured consensus
     * @param blockData
     * @param cb
     * @param cancelCondition
     */
    generateBlock(blockData, cb, cancelCondition) {
        let that = this;
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
            that.blockchain.addBlock(generatedBlock);
            that.blockchain.broadcastLastBlock();
            cb(generatedBlock);
        }, cancelCondition);
    }

    /**
     * Initiate Application start
     */
    init() {

    }
}

module.exports = DApp;