/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const MESSAGE_MUTEX_TIMEOUT = 1000;
const RESPONSE_SUFFIX = '_RESP';

const storj = require('./instanceStorage');

class MessagesDispatcher {

    constructor(config, blockchain) {
        this.config = config;
        this.blockchain = blockchain;
        /**
         * Input message mutex
         * @type {{}}
         * @private
         */
        this._messageMutex = {};

        this._waitingMessages = {};
        this.RESPONSE_SUFFIX = RESPONSE_SUFFIX;

        storj.put('messagesDispatcher', this);
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
                        handler(messageBody, function (data) {
                            that.broadcastMessage(data, message + RESPONSE_SUFFIX, messageBody.recepient);
                        });
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
     * Broadcast message
     * @param {object} data
     * @param {string} message
     * @param {string} reciver
     */
    broadcastMessage(data, message, reciver) {
        let that = this;

        if(typeof that.blockchain !== 'undefined') {
            let messageBody = that.blockchain.broadcastMessage(data, message, reciver, that.getAddress());
            that._messageMutex[messageBody.mutex] = true;
            setTimeout(function () {
                if(typeof that._messageMutex[messageBody.mutex] !== 'undefined') {
                    delete that._messageMutex[messageBody.mutex];
                }
            }, MESSAGE_MUTEX_TIMEOUT);
        }
    }

    /**
     * TODO: Shitty code
     * @param data
     * @param message
     * @param recepient
     * @param timeout
     * @param cb
     */
    broadcastMessageWaitResponse(data, message, recepient, timeout, cb) {
        let that = this;

        that.registerMessageHandler(message + RESPONSE_SUFFIX, function (messageBody) {
            if(messageBody.reciver === that.getAddress()) {
                cb(null, messageBody);
            }
        });

        setTimeout(function () {
            cb('timeout');
        }, timeout);

        that.broadcastMessage(data, message, recepient);

    }

    /**
     * Returns address
     * @return {string}
     */
    getAddress() {
        return this.blockchain.config.recieverAddress;
    }

}

module.exports = MessagesDispatcher;