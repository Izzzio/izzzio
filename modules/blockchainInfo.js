/**
 * Module for asking and checking info about blockchain on connection
 *
 */
'use strict';

const logger = new (require('./logger'))('BlockchainInfo');

class BlockchainInfo {
    /**
     * начальная инициализация и установка параметров
     * @param blockchain
     */
    constructor(blockchain) {
        this.blockchain = blockchain;
        this.BLOCKCHAIN_INFO = 'BLOCKCHAIN_INFO'; //ид для сообщений запроса информации о блокчейне
        this.ASKING_TIMEOUT = 10000; //таймаут опроса последнего известного блока
    };

    /**
     * запрос информации от вновь подключенной ноды и установка таймера опроса
     * @param ws
     * @param sendFunction
     * @param timeout
     * @returns {number | *}
     */
    onConnection(ws, sendFunction, timeout = this.ASKING_TIMEOUT) {
        let message = {data: '', id: this.BLOCKCHAIN_INFO};//поле данных пустое, значит, это запрос данных от другой ноды
        //посылаем запрос на информацию о блокчейне сокета
        sendFunction(ws, message);
        //устанавливаем интервал опроса информации о последнем блоке
        //привязываем инфо объект к сокету
        ws.blockchainInfoTimerID = setInterval(() => {
            sendFunction(ws, message);
        }, timeout);
        return ws.blockchainInfoTimerID;
    };

    /**
     * получаем извлекаем всю информацию о себе
     * @param blockchain
     */
    getOurBlockchainInfo(blockchain = this.blockchain) {
        //получаем длину всей цепочки
        let infoObject = {};
        infoObject['lastBlockInfo'] = {};
        let blockInfo = {};
        blockchain.getLatestBlock((val) => blockInfo = val);
        infoObject['lastBlockInfo'].blockchainLength = blockInfo.index + 1;
        infoObject['lastBlockInfo'].timestamp = blockInfo.timestamp;
        infoObject['lastBlockInfo'].hash = blockInfo.hash;
        infoObject['genesisHash'] = blockchain.getGenesisBlock().hash;
        return infoObject;
    }

    /**
     * посылаем информацию о себе ноде, запросившей ее
     * @param ws адрес ноды
     * @param sendFunction функция для посылки сообщения
     * @param info посылаемая информация
     * @returns {*} //undefined в случае ошибки и сообщение в случае отправки
     */
    sendOurInfo(ws, sendFunction, info = this.getOurBlockchainInfo()) {
        let data;
        try {
            data = JSON.stringify(info);
        } catch (e) {
            logger.error('Error creating JSON data' + e);
            return;
        }
        let message = {
            data: data,
            id: this.BLOCKCHAIN_INFO,
        };
        sendFunction(ws, message);
        return message;
    }

    /**
     * обработчик входящих сообщений с информацией о блокчейне
     * @param message
     * @param ws
     * @param lastBlockInfo
     * @param sendFunction
     * @returns {boolean}
     */
    handleIncomingMessage(message, ws, lastBlockInfo, sendFunction) {
        //проверяем сообщения, содержащие информацию о блокчейне
        if(message.id === this.BLOCKCHAIN_INFO) {
            if(message.data === '') {//если пустая дата, значит, просят прислать информацию о нас
                this.sendOurInfo(ws, sendFunction);
                return true;
            } else {
                //сообщение не пустое, значит, в нем должна содержаться информация о блокчейне подключенной ноды
                let info;
                try {
                    info = JSON.parse(message.data);
                } catch (e) {
                    logger.error('' + e);
                    ws.haveBlockchainInfo = false; //тормозим обработку сообщений
                    return true;
                }
                //если хэши не совпадают, значит, отключаемся
                if(info['genesisHash'] !== this.blockchain.getGenesisBlock().hash) {
                    logger.info('Genesis hashes are not equal. Socket will be disconnected.');
                    ws.haveBlockchainInfo = false; //тормозим обработку сообщений
                    clearInterval(ws.blockchainInfoTimerID); //выключаем опросник
                    ws.close();
                    message = null;
                    return true;
                } else {
                    ws.haveBlockchainInfo = true; //разрешаем дальнейшую обработку сообщенй
                    //проверяем актуальность нашей инфы по длине цепочки(если больше у другой ноды, то обновляем инфу)
                    if(lastBlockInfo.blockchainLength < info['lastBlockInfo'].blockchainLength) {
                        lastBlockInfo = info['lastBlockInfo'];
                    }
                    return true;
                }
            }
        } else {
            return false;
        }
    }
}

module.exports = BlockchainInfo;