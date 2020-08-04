/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * LCPoA validator
 * LCPoA - is a Limited Confidence Proof-of-Activity
 * Somebody call this - Proof-of-Time
 * But I call him - the second wife.
 */

/**
 * Blockchain object
 * @type {Blockchain}
 */
let blockchain = null;

const Block = require('../block');
const Signable = require('../blocksModels/signable');

/**
 * Хотим ли мы генерировать блоки поддержки сети:
 * @type {boolean}
 */
let generateEmptyBlocks = false;

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

    if(previousBlock.index + 1 !== newBlock.index) {
        console.log('Error: LCPoA: Invalid block index ' + newBlock.index);
        return false;
    } else if((previousBlock.hash !== newBlock.previousHash) || !isValidHash(newBlock.hash)) {
        console.log('Error: LCPoA: Invalid block previous hash or new hash in ' + newBlock.index);
        return false;
    } else if(!isValidHash(previousBlock.hash) && previousBlock.sign.length === 0) {
        console.log('Error: LCPoA: Invalid previous block hash');
        return false;
    } else if((blockchain.calculateHashForBlock(newBlock) !== newBlock.hash) || !isValidHash(newBlock.hash)) {
        console.log('Error: LCPoA: Invalid hash for block: ' + blockchain.calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
        return false;
    } else if(newBlock.startTimestamp > newBlock.timestamp || previousBlock.timestamp > newBlock.timestamp) { //LCPoA time checking
        console.log('Error: LCPoA: Invalid start or block timestamp');
        return false;
    } else if(newBlock.timestamp > (moment().utc().valueOf() + 1000)) {
        console.log('Error: LCPoA: Invalid local time or block creator time');
        return false;
    } else if(String(newBlock.timestamp).length !== 13 || String(newBlock.startTimestamp).length !== 13) {
        console.log('Error: LCPoA: Invalid timestamp number');
        return false;
    }

    return true;
}

/**
 * Проверка хеша блока на валидность
 * @param hash
 * @returns {boolean}
 */
function isValidHash(hash) {
    return blockchain.config.blockHashFilter.blockEndls.indexOf(hash.slice(-4)) !== -1;
}


/**
 * Майнит новый блок LCPoA
 * @param {Signable} blockData
 * @param {Function} cb
 * @param {Function} cancelCondition
 */
function generateNextBlock(blockData, cb, cancelCondition) {
    /*if(miningNow) {
     return;
     }*/

    if(typeof blockData === 'object') {
        blockData = JSON.stringify(blockData);
    }

    /*if(blockchain.config.program.disableMining){
        throw('Error: Mining disabled');
    }*/

    let nextHash = '';
    let nextTimestamp;
    console.log('Mining: Mining block...');
    blockchain.miningNow++;
    blockchain.setMiningForce(blockchain.miningNow, blockchain.miningForce);
    let mineCounter = 0;
    let lastHash = '';
    let lastTime = new Date().getTime() / 1000;
    let minerNo = blockchain.miningNow;
    let startTimestamp = moment().utc().valueOf();

    function tryMine() {
        if(typeof cancelCondition !== 'undefined') {
            if(cancelCondition()) { //Если проверка вернула не обходимость выулючить майнер
                console.log('Mining: Miner ' + minerNo + ' aborted');
                blockchain.miningNow--;
                return;
            }
        }
        blockchain.getLatestBlock(function (previousBlock) {
            if(!previousBlock) {
                //В этом случае скорее всего сеть занята синхронизацией, и надо перенести майнинг на попозже
                setTimeout(tryMine, 5000);
            }
            const nextIndex = previousBlock.index + 1;
            nextTimestamp = moment().utc().valueOf();
            nextHash = blockchain.calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, startTimestamp, '');
            if(nextHash !== lastHash) {
                lastHash = nextHash;
                mineCounter++;
            }
            if((nextTimestamp / 1000) % 1 === 0) {
                blockchain.miningForce = (mineCounter / 1);
                blockchain.setMiningForce(blockchain.miningNow, blockchain.miningForce);
                console.log('Miner #' + minerNo + ': Speed ' + (mineCounter / 1) + ' H/s');
                lastTime = nextTimestamp / 1000;
                mineCounter = 0;
            }
            if(isValidHash(nextHash)) {
                console.log('Mining: New block found ' + nextHash);
                blockchain.miningNow--;
                blockchain.setMiningForce(blockchain.miningNow, blockchain.miningForce);

                cb(new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, nextHash, startTimestamp, ''));
            } else {
                setTimeout(tryMine, blockchain.config.lcpoaVariantTime);
            }
        });

    }

    setTimeout(tryMine, 1);

}

/**
 * Генерирует пустой блок, если в сети нет активных ттанзанкций
 */
function generateEmptyBlock(keyring) {

    if((blockchain.getCurrentPeers().length <= 2 || blockchain.miningNow > 0 || blockchain.blockHandler.syncInProgress) && !keyring) {
        return;
    }

    let lastMaxBlock = blockchain.maxBlock;

    blockchain.getLatestBlock(function (block) {
        if(moment().utc().valueOf() - block.timestamp > (blockchain.config.generateEmptyBlockDelay) || keyring) {
            let empty = new Signable();
            generateNextBlock(empty, function (generatedBlock) {
                //Если за это время кто-то добавил блок, то тогда ничего не делаем
                blockchain.getLatestBlock(function (block) {
                    if(moment().utc().valueOf() - block.timestamp > (blockchain.config.generateEmptyBlockDelay) || keyring) {
                        if(isValidNewBlock(generatedBlock, block)) {
                            blockchain.addBlock(generatedBlock);
                        } else {
                            console.log('Error: LCPoA: We generate bad block :( ')
                        }
                        blockchain.broadcastLastBlock();

                    }
                });
            }, function () {
                return blockchain.maxBlock !== lastMaxBlock;
            });
        }
    });
}

/**
 * Проверка, будем ли генерить новый пустой блок
 * @return {boolean}
 */
function generateEmptyBlockCheck() {
    if(blockchain !== 'null' && generateEmptyBlocks) {
        generateEmptyBlock();
    }
}


/**
 * Работа возможна всегда
 * @return {boolean}
 */
function isReady() {
    if(blockchain.config.program.disableMining) {
        return false;
    }
    return true;
}

/**
 * Toggle empty blocks generation
 * @param generate
 */
function setGenerateEmptyBlocks(generate) {
    generateEmptyBlocks = generate;
    /*if(!generate){
        console.log('Info: LCPoA empty block generation disabled');
    }*/
}


module.exports = function (blockchainVar) {
    blockchain = blockchainVar;
    console.log('Info: LCPoA validator loaded');
    setInterval(generateEmptyBlockCheck, blockchain.config.emptyBlockInterval);
    return {
        consensusName: 'LCPoA',
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks,
    };
};

