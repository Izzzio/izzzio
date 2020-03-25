/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author:  iZ³ Team (info@izzz.io)
 */


/**
 Starwave protocol
 Протокол использует объект BlockChain и его методы отправки сообщений: blockchain.broadcast, blockchain.write
 добавлен новый тип сообщений SW_BROADCAST - это тип, который используют сообщения этого протокола
 Структура сообщения на основе BlockChain initmessage, но добавлены дополнительные поля:
 * @param relevancyTime //время жизни сообщения в мс
 * @param route // маршрут, по которому прошло сообщение
 * @param timestampOfStart //время первоначальной отправки сообщения от которого отсчитывается время жизни
 *
 * маршрут считается заполенным, если конечный  элемент массива маршрута равен получателю сообщения
 * маршрут записывается полный: от отправителя до получателя
 */

const MESSAGE_MUTEX_TIMEOUT = 1000;
const LATENCY_TIME = 2 * 1000; //отклонение на устаревание сообщения

const BROADCAST_TYPE = "broadcast";

const storj = require('./instanceStorage');
const moment = require('moment');
const getid = require('./getid');

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
        storj.put('starwaveProtocol', this);
    }

    /**
     * Создает сообщение
     * @param data
     * @param reciver
     * @param sender
     * @param id
     * @param timestamp
     * @param TTL
     * @param relevancyTime
     * @param route
     * @param type
     * @param timestampOfStart
     * @param {string} broadcastId
     * @returns {{data: *, reciver: *, sender: *, id: *, timestamp: number, TTL: number, index: *, mutex: string, relevancyTime: Array, route: Array, type: number, timestampOfStart: number}}
     */
    createMessage(data, reciver, sender, id, timestamp, TTL, relevancyTime, route, type, timestampOfStart, broadcastId = '') {
        return {
            data: data,
            reciver: reciver,
            sender: sender !== undefined ? sender : this.config.recieverAddress,
            id: id,
            timestamp: timestamp !== undefined ? timestamp : moment().utc().valueOf(),  //при пересылке сообщений. если указано время, значит, пересылается сообщение и оставляем первоначальное время создания
            TTL: typeof TTL !== 'undefined' ? TTL : 0, //количество скачков сообщения
            mutex: getid() + getid() + getid(),
            relevancyTime: relevancyTime !== undefined ? relevancyTime : LATENCY_TIME, // время актуальности сообщений
            route: route !== undefined ? route : [],     //маршрут сообщения
            type: type !== undefined ? type : this.blockchain.MessageType.SW_BROADCAST,
            timestampOfStart: timestampOfStart !== undefined ? timestampOfStart : moment().utc().valueOf(),
            broadcastId
        };
    };

    /**
     * Register message handler
     * @param {string} message
     * @param {function|string} broadcastId
     * @param {function} handler
     * @return {boolean}
     */
    registerMessageHandler(message, broadcastId = '', handler = null) {
        let that = this;

        //for legacy methods
        if (typeof broadcastId === 'function' && !handler) {
            handler = broadcastId;
        }

        if (typeof that.blockchain !== 'undefined') {
            this.blockchain.registerMessageHandler(message, function (messageBody) {
                if (
                    messageBody.id === message
                    || (typeof broadcastId === 'string' && message === BROADCAST_TYPE && messageBody.broadcastId === broadcastId)
                ) {
                    if (typeof messageBody.mutex !== 'undefined' && typeof that._messageMutex[messageBody.mutex] === 'undefined') {
                        if (handler(messageBody)) {
                            that.handleMessageMutex(messageBody);
                            if (messageBody.broadcastId === broadcastId) {
                                return false;
                            }
                            return true;
                        } else {
                            return false;
                        }
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

            if(messageBusAddress === this.getAddress()) { //Сообщение самому себе
                this.handleMessage(message, this.blockchain.messagesHandlers, null);
                return true;
            } else {
                let socket = this.blockchain.getSocketByBusAddress(messageBusAddress);

                if(!socket) {  //нет такого подключенного сокета
                    return false;
                } else {
                    //добавляем свой адрес в маршруты, если маршрут не закончен
                    if(!this.routeIsComplete(message)) {
                        message.route.push(this.config.recieverAddress);
                    }
                    //отправляем сообщение
                    that.blockchain.write(socket, message);
                    this.handleMessageMutex(message);
                    return true; //сообщение отправлено
                }
            }

        }
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
            if(message.route.length > 0) { //если массив маршрута пуст, значит, это первая отправка сообщения и рассылать нужно без ограничений
                //сохраняем предыдущего отправителя(он записан последним в массиве маршрутов)
                prevSender = that.blockchain.getSocketByBusAddress(message.route[message.route.length - 1]);
            }
            //добавляем свой адрес в маршруты
            message.route.push(this.config.recieverAddress);
            //устанавливаем тип сообщения
            message.type = this.blockchain.MessageType.SW_BROADCAST;
            //рассылаем всем, кроме отправителя(если это уже не первая пересылка)
            that.blockchain.broadcast(message, prevSender);
            this.handleMessageMutex(message);
        }
    };

    /**
     *  посылает сообщение по протоколу starwave
     * @param message //объект сообщения
     */
    sendMessage(message) {
        if(!this.sendMessageToPeer(message.reciver, message)) {   //не получилось отправить напрямую, нет напрямую подключенного пира, делаем рассылку всем
            //очищаем маршрут, начиная с текущего узла
            this.broadcastMessage(message);
            return 2; //отправили широковещательно
        }
        return 1; //отправили напрямую
    };

    /**
     * разбираем входящее сообщение и смотрим что с ним  делать дальше
     * @param message
     * @returns {*}
     */
    manageIncomingMessage(message) {

        //Сообщение от самого себя
        if(message.sender === this.getAddress()) {
            try { //Попытка отключения от самого себя
                message._socket.close();
            } catch (e) {
            }
            return 0;
        }

        //проверяем актуальность сообщения
        if((moment().utc().valueOf()) > (message.timestamp + message.relevancyTime + LATENCY_TIME)) {
            return 0; //оставляем без внимания сообщение
        }
        //проверяем, достигли сообщение конечной точки
        if(this.endpointForMessage(message)) {
            //сохраняем карту маршрута
            if(message.route.length > 1) { //если карта маршрута из одного элемента, значит, есть прямое подключение к отправителю и записывать не нужно
                message.route.push(this.config.recieverAddress);//переворачиваем массив, чтобы использовать его для посылки
                this.blockchain.routes[message.sender] = message.route.reverse().filter((v, i, a) => a.indexOf(v) === i);
            }
            return 1;   //признак того, что сообщение достигло цели
        } else {        //если сообщение проходное
            return this.retranslateMessage(message);
        }
        //сообщение актуально и не достигло получателя, значит
        //проверяем наличие закольцованности. если в маршруте уже есть этот адрес, а конечная точка еще не нашлась,то не пускаем дальше
        //см. описание выше
        /* if(!this.routeIsComplete(message) &&
             (message.route.indexOf(this.config.recieverAddress) > -1)) {
             return 0;                           //т.е. массив маршрута еще в стадии построения, и к нам пришло сообщение повторно
         }*/
    };

    /**
     * пересылаем полученное сообщение дальше по маршруту
     * @param message
     * @returns {*} отправленное сообщение
     */
    retranslateMessage(message) {
        //пересоздаем сообщение(если необходимо что-то добавить)
        let newMessage = message;
        if(this.routeIsComplete(newMessage)) {
            let ind = newMessage.route.indexOf(this.config.recieverAddress); // индекс текущего узла в маршрутной карте
            if(!this.sendMessageToPeer(newMessage.route[ind + 1], newMessage)) { //не получилось отправить напрямую, нет напрямую подключенного пира, делаем рассылку всем
                //очищаем маршрут, начиная с текущего узла, потому что маршрут сломан и перестраиваем его
                newMessage.route = newMessage.route.splice(ind);
                this.broadcastMessage(newMessage);
            }
        } else {//если маршрут не закончен
            this.sendMessage(newMessage);
        }
        return newMessage;
    };

    /**
     * полная обработка сообщения по протоколу
     * @param message
     * @param messagesHandlers
     * @param ws
     * @returns {*} //возвращает индекс обработанного сообщения
     */
    handleMessage(message, messagesHandlers, ws) {
        if(message.type === this.blockchain.MessageType.SW_BROADCAST) {
            if(this.manageIncomingMessage(message) === 1) {
                //значит, сообщение пришло в конечную точку и
                //сначала дешифруем, если нужно
                // this.starwaveCrypto.handleIncomingMessage(message);
                /**
                 * Проходимся по обработчикам входящих сообщений
                 */

                for (let a in messagesHandlers) {
                    if(messagesHandlers.hasOwnProperty(a)) {
                        message._socket = ws;
                        if(messagesHandlers[a].handle(message)) {
                            return message.id; //Если сообщение обработано, выходим
                        }
                    }
                }
            }
        }
    }

    /**
     * работаем с мьютексом сообщения
     * @param messageBody
     */
    handleMessageMutex(messageBody) {
        //взято из диспетчера
        this._messageMutex[messageBody.mutex] = true;
        setTimeout(() => {
            if(typeof this._messageMutex[messageBody.mutex] !== 'undefined') {
                delete this._messageMutex[messageBody.mutex];
            }
        }, MESSAGE_MUTEX_TIMEOUT);
    };

    /**
     * проверяем является ли наш сервер получателем сообщения
     * @param message
     * @returns {boolean}
     */
    endpointForMessage(message) {
        return message.reciver === this.config.recieverAddress;
    };

    /**
     * прверяет, закончен ли маршрут
     * @param message
     * @returns {boolean}
     */
    routeIsComplete(message) {
        return (message.route[message.route.length - 1] === message.reciver);
    };

    /**
     * Returns address
     * @return {string}
     */
    getAddress() {
        return this.blockchain.config.recieverAddress;
    };

    /**
     * close connection with socket if there are more then one url on that busaddress
     * @param socket
     * @returns {number} //status of the operation
     */
    preventMultipleSockets(socket) {
        let busAddress;
        if(socket.nodeMetaInfo) {
            busAddress = socket.nodeMetaInfo.messageBusAddress;
            if(busAddress === undefined) {
                return 2; //socket without busAddress
            }
        } else {
            return 3; //socket has no meta info
        }
        //if there are more than 1 socket on busaddress we close connection
        const sockets = this.blockchain.getCurrentPeers(true);
        let socketsOnBus = 0;
        const socketsNumber = sockets.length;
        for (let i = 0; i < socketsNumber; i++) {
            if(sockets[i] && sockets[i].nodeMetaInfo) {
                if(sockets[i].nodeMetaInfo.messageBusAddress === busAddress) {
                    socketsOnBus++;
                }
            }
        }
        if(socketsOnBus > 1) {
            socket.close();
            return 0; //close connection
        } else {
            return 1; // no other connections
        }
    }


}

module.exports = starwaveProtocol;