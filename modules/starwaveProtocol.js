/**
 Starwave protocol
 Протокол использует объект BlockChain и его методы отправки сообщений: blockchain.broadcast, blockchain.write
 добавлен новый тип сообщений SW_BROADCAST - это тип, который используют сообщения этого протокола
 Структура сообщения на основе BlockChain initmessage, но добавлены дополнительные поля:
 * @param relevancyTime //время жизни сообщения в мс
 * @param route // маршрут, по которому прошло сообщение
 * @param timestampOfStart //время первоначальной отправки сообщения от которого отсчитывается время жизни
 */

const MESSAGE_MUTEX_TIMEOUT = 1000;
const RESPONSE_SUFFIX = '_RESP';

const storj = require('./instanceStorage');
const moment = require('moment');

class starwaveProtocol {

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
     * @param timestampOfStart
     * @return {{type: number, data: *, reciver: *, sender: *, id: *, timestamp: number, TTL: number, index: number, relevancyTime: number, route: []}}
     */
    createMessage(data, reciver, sender, id, timestamp, index, TTL, relevancyTime, route, type, timestampOfStart) {
        return {
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
            type: type !== undefined ? type : this.blockchain.MessageType.SW_BROADCAST,
            timestampOfStart: timestampOfStart !== undefined ? timestampOfStart : moment().utc().valueOf()
        };
    };

    /**
     * Рассылает широковещательное сообщение по системе всем, кроме отправителя(если указан флаг)
     * @param {object} message
     */
    broadcastMessage(message) {
        let that = this;
       //примечание по заданию: Если маршрут пустой ИЛИ если в маршруте нет известных получателей (за исключением отправителя), сообщения рассылаются всем кроме отправителя
        //если пустой, значит, первая отправка и идет всем
        if(typeof that.blockchain !== 'undefined') {
            let prevSender; //отправитель сообщения
            if (message.route.length > 0) { //если массив маршрута пуст, значит, это первая отправка сообщения.
                //сохраняем предыдущего отправителя(он записан последним в массиве маршрутов)
                prevSender = that.blockchain.getSocketByBusAddress(message.route[message.route.length - 1]);
            }
            //добавляем свой адрес в маршруты
            message.route.push(this.config.recieverAddress);
            //устанавливаем тип сообщения
            message.type = this.blockchain.MessageType.SW_BROADCAST;
            //рассылаем всем, кроме отправителя(если это уже не первая пересылка)
            that.blockchain.broadcast(message, prevSender);

            this.handleMessageMutex(messageBody);
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
                            that.createMessage(data,messageBody.recepient, message + RESPONSE_SUFFIX,that.getAddress(), messageBody);
                            that.send(data, message + RESPONSE_SUFFIX, messageBody.recepient);
                        });
                        that.handleMessageMutex(messageBody);
                    }
                }
            });
            return true;
        }
        return false;
    };

    /**
     * Посылает сообщение непосредственно подключенному пиру(по его busAddress)
     * @param messageBusAddress
     * @param {object} message
     */
    sendMessageToPeer(messageBusAddress, message) {
        let that = this;
        if(typeof that.blockchain !== 'undefined') {

            let socket = this.blockchain.getSocketByBusAddress(messageBusAddress);
            if (!socket) {  //нет такого подключенного сокета
                return false;
            } else{
                //добавляем свой адрес в маршруты
                message.route.push(this.config.recieverAddress);
                //отправляем сообщение
                that.blockchain.write(socket, message);
                this.handleMessageMutex(message);
                return true; //сообщение отправлено
            }

        }
    };

    /**
     *  посылает сообщение по протоколу starwave
     * @param message //объект сообщения
     */
    sendMessage(message){
        if (!this.sendMessageToPeer(message.reciver, message)) {   //не получилось отправить напрямую, нет напрямую подключенного пира, делаем рассылку всем
            this.broadcastMessage(message);
            return 2; //отправили широковещательно
        };
        return 1; //отправили напрямую
    };

    /**
     * проверяем является ли наш сервер получателем сообщения
     * @param message
     * @returns {boolean}
     */
    endpointForMessage(message){
        return message.reciver === this.config.recieverAddress;
    };

    manageIncomingMessage(message){
        //проверяем актуальность сообщения

        if (this.endpointForMessage(message)){

        }
    };

    //работаем с мьютексом сообщения
    handleMessageMutex(messageBody){
        //взято из диспетчера
        this._messageMutex[messageBody.mutex] = true;
        setTimeout(()=>{
            if(typeof this._messageMutex[messageBody.mutex] !== 'undefined') {
                delete this._messageMutex[messageBody.mutex];
            }
        }, MESSAGE_MUTEX_TIMEOUT);
    };

    /**
     * Returns address
     * @return {string}
     */
    getAddress() {
        return this.blockchain.config.recieverAddress;
    };
}

module.exports = starwaveProtocol;