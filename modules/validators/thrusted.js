/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


/**
 * Thrusted Nodes validator
 * Проверяет цифровые подписи блоков
 * Используется как основной консенсус сети, блокируя работу альтернативных
 * В случае отсутствия блоков Thrusted Nodes в течении 24 часов, отключает состояние готовности,
 * и разблокирует альтернативные консенсусы
 *
 * Yep, I know that "trusted" and "tHrusted" are different words.
 * I specifically made it so that the word sounded like a Jewish accent...
 * Or maybe I was just mistaken. You will never know! (ಠ_ಠ)
 *                                                          Andrey.
 */

/**
 * Blockchain object
 * @type {Blockchain}
 */
let blockchain = null;

const ThrustedNodesTimeout = 86400 * 1000; //24hours
const MessageTimeout = 60000;
const AddMessageTimeout = 10000;
const consensusName = 'Thrusted Nodes';


/**
 * Хотим ли мы генерировать блоки поддержки сети:
 * @type {boolean}
 */
let generateEmptyBlocks = true;

/**
 * Возможно ли сейчас использовать Thrusted консенсус
 * @type {boolean}
 */
let isReadyNow = true;

/**
 * Все запросы на добавление блока, для коллбеков
 * @type {Array}
 */
let thrustedAwait = [];


const Wallet = require('../wallet');
/**
 * Test wallet
 * @type {Wallet}
 */
let testWallet = new Wallet();


let lastTimestampRequest = 0;
let lastRecepient = '';

const Block = require('../block');
const Signable = require('../blocksModels/signable');
const moment = require('moment');

/**
 * Проверка корректности блока
 * @param {Block} newBlock
 * @param {Block} previousBlock
 */
function isValidNewBlock(newBlock, previousBlock) {

    if(typeof newBlock === 'undefined' || typeof previousBlock === 'undefined') {
        return false;
    }

    if(newBlock.previousHash !== previousBlock.hash) {
        console.log('Error: Thrusted Nodes: Invalid block previous hash');
        return false;
    }

    //Совпадающие по времени блоки отбраковывем из за проблемы множественного добавления
    if(newBlock.timestamp <= previousBlock.timestamp) {
        return false;
    }

    if(newBlock.timestamp - previousBlock.timestamp < ThrustedNodesTimeout && newBlock.sign.length === 0 && newBlock.index > 5) {
        throw ('Error: Thrusted Nodes: Adding other consensus block disabled due security configuration.');
    }

    if(previousBlock.index + 1 !== newBlock.index) {
        console.log('Error: Thrusted Nodes: Invalid block index');
        return false;
    }

    if(typeof newBlock.sign === 'undefined') {
        console.log('Error: Thrusted Nodes: Block format incompatible with thrusted nodes consensus');
        return false;
    }

    if(newBlock.sign.length === 0) { //блок не подписан, отдаём дальше
        return false;
    }

    const keyring = blockchain.blockHandler.keyring;

    for (let a in keyring) {
        if(keyring.hasOwnProperty(a)) {
            if(testWallet.verifyData(newBlock.hash, newBlock.sign, keyring[a])) {
                return true;
            }
        }
    }

    console.log('Error: Fake signed block');

    return false;
}

/**
 * Получает коллбек по таймстампу
 * @param timestamp
 * @return {*}
 */
function getThrustedAwait(timestamp) {
    for (let a in thrustedAwait) {
        if(thrustedAwait.hasOwnProperty(a)) {
            if(Number(thrustedAwait[a].timestamp) === Number(timestamp)) {
                return thrustedAwait[a];
            }
        }
    }

    return false;
}

/**
 * Создаёт новый блок
 *
 * @param {Signable} blockData
 * @param {Function} cb
 * @param {Function} cancelCondition
 * @param {int} timestamp
 */
function generateNextBlock(blockData, cb, cancelCondition, timestamp) {

    /**
     * Если у нас нет ключей для немедленного добавления блока в сеть,
     * можем только просить добавить блок других участников
     */
    if(!blockchain.blockHandler.isKeyFromKeyring(blockchain.wallet.keysPair.public)) {
        console.log('Info: Thrusted Nodes: Sending block addition request');

        /**
         * Отправляем сообщение
         */
        let message = blockchain.broadcastMessage(blockData, Math.random(), 'thrusted_node', blockchain.config.recieverAddress, 0);


        /**
         * Если время ожидания превысило таймаут, то считаем транзакцию неуспешной
         * @type {number}
         */
        let timer = setTimeout(function () {
            for (let a in thrustedAwait) {
                if(thrustedAwait.hasOwnProperty(a)) {
                    if(Number(thrustedAwait[a].timestamp) === Number(message.timestamp)) {
                        thrustedAwait[a].callback();
                        delete thrustedAwait[a];
                        return;
                    }
                }
            }
        }, AddMessageTimeout);

        /**
         * Добавляем в лист ожидания блоки
         */
        thrustedAwait.push({callback: cb, timestamp: message.timestamp, timer: timer});

        /*cb(new Block(-1, '', message.timestamp, blockData, '', message.timestamp, ''));*/
        //console.log('Error: This node can\'t create Thrusted blocks');
        return false;
    }

   /* if(typeof blockData === 'object') {
        blockData = JSON.stringify(blockData);
    }*/

    blockchain.getLatestBlock(function (previousBlock) {
        if(!previousBlock) {
            return;
        }

        let startTimestamp = moment().utc().valueOf(),
            nextTimestamp = moment().utc().valueOf();
        if(typeof timestamp !== 'undefined') {
            startTimestamp = timestamp;
            nextTimestamp = timestamp;
        }
        const nextIndex = previousBlock.index + 1;

        let hash = blockchain.calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, startTimestamp, '');

        let sign = blockchain.wallet.signData(hash).sign;

        let newBlock = new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, hash, startTimestamp, sign);

        cb(newBlock);
    });
}

/**
 * Создаёт пустой блок, для поддержки подтверждения транзакций при простое
 */
function generateEmptyBlock() {
    let empty = new Signable();
    if(isReady()) {
        generateNextBlock(empty, function (generatedBlock) {
            blockchain.addBlock(generatedBlock);
            blockchain.broadcastLastBlock();
        });
    }
}

/**
 * Проверка, будем ли генерить новый пустой блок
 * @return {boolean}
 */
function generateEmptyBlockCheck() {
    if(blockchain !== null && generateEmptyBlocks) {
        //Мы не выпускали ключи
        if(!blockchain.blockHandler.isKeyFromKeyring(blockchain.wallet.keysPair.public)) {
            console.log('Info: We can\'t generate empty Thrusted blocks');
            generateEmptyBlocks = false;
            return false;
        }
        blockchain.getLatestBlock(function (previousBlock) {
            if(!previousBlock) {
                return;
            }
            if(moment().utc().valueOf() - previousBlock.timestamp > (blockchain.config.generateEmptyBlockDelay)) {
                console.log('Info: Create empty block');
                generateEmptyBlock();
            }
        });

    }
}

/**
 * Проверка возможности использования Thrusted консенсуса
 * @return {boolean}
 */
function isReady() {

    if(blockchain.blockHandler.isKeyFromKeyring(blockchain.wallet.keysPair.public)) {
        //Если мы готовы работать, то выключаем генерацию пустых блоков остальных консенсусов
        for (let a in blockchain.config.validators) {
            if(blockchain.config.validators.hasOwnProperty(a) && blockchain.config.validators[a].consensusName !== consensusName) {
                try {
                    blockchain.config.validators[a].setGenerateEmptyBlocks(false);
                } catch (e) {
                    console.log(e);
                }
            }
        }
        return true;
    }

    if(blockchain.blockHandler.keyring.length !== 0 && isReadyNow) {
        isReadyNow = true;
    } else {
        isReadyNow = false;
    }

    blockchain.getLatestBlock(function (previousBlock) {
        if(!previousBlock) {
            isReadyNow = false;
        }


        /*console.log(previousBlock.sign.length);
        console.log(moment().utc().valueOf() - previousBlock.timestamp);*/

        if(typeof previousBlock.sign === 'undefined'){
            console.log(previousBlock);
            isReadyNow = false;
            return isReadyNow;
        }

        if(previousBlock.sign.length !== 0 && moment().utc().valueOf() - previousBlock.timestamp > ThrustedNodesTimeout) {
            isReadyNow = false;
        } else {
            if(moment().utc().valueOf() - previousBlock.timestamp > ThrustedNodesTimeout) {
                isReadyNow = false;
            } else {
                isReadyNow = true;
            }
        }

    });


    return isReadyNow;
}


/**
 * Для thrusted любой хеш валиден
 * @return {boolean}
 */
function isValidHash() {
    return true;
}


/**
 * Обработчик входящих сообщений
 * @param message
 */
function handleMessage(message) {

    /**
     * Если мы получили сообщение для нас, как для доверенной ноды
     */
    if(message.reciver === 'thrusted_node' && blockchain.blockHandler.isKeyFromKeyring(blockchain.wallet.keysPair.public)) {

        if(moment().utc().valueOf() - message.timestamp < MessageTimeout && lastTimestampRequest < message.timestamp && message.recepient !== lastRecepient) {

            lastTimestampRequest = message.timestamp;
            lastRecepient = message.recepient;

            /**
             * Блок-кандидат на добавление в сеть
             * Несколько доверенных нод могут взять один и тот же блок для добавления
             * в сеть. Для этого используется timestamp сообщения в качестве времени блока
             * Проверка совпадения Timestampов в этом случае отбракует дублируемый блок
             */
            generateNextBlock(message.data, function (generatedBlock) {
                blockchain.addBlock(generatedBlock);
                blockchain.broadcastLastBlock();

                // console.log(message);
                console.log('Block added for ' + message.recepient);

                /**
                 * Отправляем ответ об успешном добавлении блока
                 * с небольшой задержкой
                 */
                setTimeout(function () {
                    blockchain.broadcastMessage({
                        type: 'thrusted_block_add',
                        timestamp: message.timestamp,
                        block: generatedBlock
                    }, Math.random(), message.recepient, blockchain.config.recieverAddress, 0);
                }, 100);


            }, null, message.timestamp);
        }

        return true;
    }

    /**
     * Если мы получили сообщение от доверенной ноды
     */
    if(message.reciver === blockchain.config.recieverAddress && typeof message.data.type !== 'undefined' && message.data.type === 'thrusted_block_add') {
        let timestamp = message.data.timestamp;
        let block = message.data.block;
        for (let a in thrustedAwait) {
            if(thrustedAwait.hasOwnProperty(a)) {
                if(Number(thrustedAwait[a].timestamp) === Number(timestamp)) {
                    /**
                     * Отмечаем добавление блока
                     */
                    clearTimeout(thrustedAwait[a].timer);
                    thrustedAwait[a].callback(block);
                    delete thrustedAwait[a];
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Toggle empty blocks generation
 * @param generate
 */
function setGenerateEmptyBlocks(generate) {
    generateEmptyBlocks = generate;
}


module.exports = function (blockchainVar) {
    blockchain = blockchainVar;
    console.log('Info: Thrusted Nodes validator loaded');
    setInterval(generateEmptyBlockCheck, blockchain.config.emptyBlockInterval);
    setTimeout(function () {
        isReady();
    }, 5000);

    blockchain.registerMessageHandler('ThrustedNodes', handleMessage);


    return {
        consensusName: consensusName,
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks,
    };
};

