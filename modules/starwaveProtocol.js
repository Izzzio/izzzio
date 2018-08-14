/**
 Starwave protocol
 */

const MESSAGE_MUTEX_TIMEOUT = 1000;
const RESPONSE_SUFFIX = '_RESP';

const storj = require('./instanceStorage');
const moment = require('moment');

class Starwave {

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
     * Создает сообщение
     * @param data
     * @param reciver
     * @param sender
     * @param id
     * @param timestamp
     * @param index
     * @param TTL
     * @param relevancyTime
     * @param route
     * @param type
     * @return {{type: number, data: *, reciver: *, sender: *, id: *, timestamp: number, TTL: number, index: number, relevancyTime: number, route: []}}
     */
    createMessage(data, reciver, sender, id, timestamp, index, TTL, relevancyTime, route, type) {
        return {
            type: type !== undefined ? type : this.blockchain.MessageType.BROADCAST,
            data: data,
            reciver: reciver,
            sender: sender,
            id: id,
            timestamp: timestamp !== undefined ? timestamp : moment().utc().valueOf(),  //при пересылке сообщений. если указано время, значит, пересылается сообщение и оставляем первоначальное время создания
            TTL: typeof TTL !== 'undefined' ? TTL : 0, //количество скачков сообщения
            index: index,
            mutex: getid() + getid() + getid(),
            relevancyTime: relevancyTime !== undefined ? relevancyTime : [], // время актуальности сообщений
            route: route !== undefined ? route : []     //маршрут сообщения
        };
    };

    /**
     * Рассылает широковещательное сообщение по системе всем, кроме отправителя
     * @param {object} message
     * @param {string} prevSender от кого пришло сообщение, если была пересылка (messagebusaddress)
     */
    broadcastMessage(message) {
        let that = this;

        if(typeof that.blockchain !== 'undefined') {
            //сохраняем предыдущего отправителя(он записан последним в массиве маршрутов)
            message.route(message.route.length - 1);
            //добавляем свой адрес в маршруты
            message.route.push(this.config.recieverAddress);
            //устанавливаем тип сообщения
            message.type = this.blockchain.MessageType.SW_BROADCAST;
            //рассылаем всем, кроме отправителя
            that.blockchain.broadcast(message, prevSender);

           /* that._messageMutex[messageBody.mutex] = true;
            setTimeout(function () {
                if(typeof that._messageMutex[messageBody.mutex] !== 'undefined') {
                    delete that._messageMutex[messageBody.mutex];
                }
            }, MESSAGE_MUTEX_TIMEOUT);*/
        }
    };

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
     * Send message directly to socket
     * @param socket
     * @param {object} data
     * @param {string} message
     * @param {string} receiver
     */
    sendMessage(socket, data, message, receiver) {
        let that = this;
        if(typeof that.blockchain !== 'undefined') {
            let messageBody = that.createMessage(data, receiver, that.getAddress(), message, that.blockchain.lastMsgIndex + 1);
            that.blockchain.write(socket, messageBody);
            that._messageMutex[messageBody.mutex] = true;
            setTimeout(function () {
                if(typeof that._messageMutex[messageBody.mutex] !== 'undefined') {
                    delete that._messageMutex[messageBody.mutex];
                }
            }, MESSAGE_MUTEX_TIMEOUT);
        }
    }

    /**
     * Returns address
     * @return {string}
     */
    getAddress() {
        return this.blockchain.config.recieverAddress;
    }





}

module.exports = Starwave;