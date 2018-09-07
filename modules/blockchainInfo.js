/**
 * Module for asking and checking info about blockchain on connection
 *
 */

const logger = new (require('./logger'))('BlockchainInfo');

class BlockchainInfo{
    /**
     * начальная инициализация и установка параметров
     * @param blockchain
     */
    constructor(blockchain){
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
    onConnection(ws, sendFunction, timeout = this.ASKING_TIMEOUT){
        let message = {data:'', id: this.BLOCKCHAIN_INFO};//поле данных пустое, значит, это запрос данных от другой ноды
        //посылаем запрос на информацию о блокчейне сокета
        sendFunction(ws,message);
        //устанавливаем интервал опроса информации о последнем блоке
        //привязываем инфо объект к сокету
        ws.blockchainInfoTimerID = setInterval(()=>{
            sendFunction(ws, message);
        }, timeout);
        return ws.blockchainInfoTimerID;
    };

    /**
     * получаем извлекаем всю информацию о себе
     * @param blockchain
     */
    getOurBlockchainInfo(blockchain = this.blockchain){
        //получаем длину всей цепочки
        let infoObject = {};
        infoObject['lastBlockInfo']={};
        let blockInfo = {};
        blockchain.getLatestBlock((val)=> blockInfo = val);
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
    sendOurInfo(ws, sendFunction, info = this.getOurBlockchainInfo()){
        let data;
        try {
            data = JSON.stringify(info);
        } catch (e) {
            logger.Error('Error creating JSON data' + e);
            return;
        }
        let message = {
            data:data,
            id: this.BLOCKCHAIN_INFO,
        };
        sendFunction(ws,message);
        return message;
    }
}

module.exports = BlockchainInfo;