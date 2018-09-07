/**
 * Module for asking and checking info about blockchain on connection
 *
 */
const BLOCKCHAIN_INFO = 'BLOCKCHAIN_INFO'; //ид для сообщений запроса информации о блокчейне
const ASKING_TIMEOUT = 10000; //таймаут опроса последнего известного блока

class BlockchainInfo{
    constructor(blockchain, ws, sendFunction){
        this.blockchain = blockchain;
        this.ws = ws;
        let message = {
            data:'',
            id: BLOCKCHAIN_INFO,
        };
        //посылаем запрос на информацию о блокчейне сокета
        sendFunction(ws,message);
        //устанавливаем интервал опроса информации о последнем блоке
        this.timerID = setInterval(()=>{
            sendFunction(ws, message);
        }, ASKING_TIMEOUT);
    };

    /**
     * получаем извлекаем всю информацию о себе
     * @param blockchain
     */
    getBlockchainInfo(blockchain = this.blockchain){
        /*При подключении к другой ноде, нода должна сначала запросить0
         длину всей цепочки, таймстамп и хеш(можно просто последний известный блок),
         и сохранить как "последний известный блок". В последующем обновлять этот блок,
         что-бы держать его актуальным.

Также должна запросить хеш нулевого блока и в случае несовпадения с хешем блока,
полученного от функции genesisBlock отключится от ноды
*/
        //получаем длину всей цепочки
        let infoObject = [];
        infoObject['lastKnownBlock']={};

        blockchain.blockchain.get('maxBlock' ,(err, value) =>
        {
            if (err) {
                logger.error('Database failure. Repair or resync database!');
                return;
            }
            infoObject['lastKnownBlock'].blockchainLength = Number(value);
            blockchain.getLatestBlock((val)=> infoObject['lastKnownBlock'].timeStamp = val);
        });
        //hash should be added

        return infoObject;

    }
}

module.exports = BlockchainInfo;