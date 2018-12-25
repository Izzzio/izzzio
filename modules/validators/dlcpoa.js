/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * DLCPoA validator
 * DLCPoA - is a Dynamic Limited Confidence Proof-of-Activity
 * Like LCPoA but with dynamic complexity
 */


const TARGET_NETWORK_SPEED = 100;                       // blocks per second
const MINIMAL_COMPLEXITY = 0.1;                         //minimal network complexity
const MAX_HASH_SIGMA = 'ffffff';                        //Maximum hash sigma

//******************************* Auto calculated ****************************************
const MAX_HASH_SIGMA_INT = Number.parseInt(MAX_HASH_SIGMA, 16);//Minimal complexity sigma
const HASH_SIGMA_LENGTH = MAX_HASH_CHECK.length;                    //How many symbols form hash use for validation

/**
 * Blockchain object
 * @type {Blockchain}
 */
let blockchain = null;

const Block = require('../block');
const Signable = require('../blocks/signable');

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

    let complexity = getComplexity(newBlock.timestamp, previousBlock.timestamp);
    complexity = complexity < MINIMAL_COMPLEXITY ? MINIMAL_COMPLEXITY : complexity;
    complexity = Math.round(complexity * 10000) / 10000;


    if(previousBlock.index + 1 !== newBlock.index) {
        console.log('Error: DLCPoA: Invalid block index ' + newBlock.index);
        return false;
    } else if((previousBlock.hash !== newBlock.previousHash) || !isValidHash(newBlock.hash)) {
        console.log('Error: DLCPoA: Invalid block previous hash or new hash in ' + newBlock.index);
        return false;
    } else if(!isValidHash(previousBlock.hash) && previousBlock.sign.length === 0) {
        console.log('Error: DLCPoA: Invalid previous block hash');
        return false;
    } else if((blockchain.calculateHashForBlock(newBlock) !== newBlock.hash) || !isValidHash(newBlock.hash, complexity)) {
        console.log('Error: DLCPoA: Invalid hash for block: ' + blockchain.calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
        return false;
    } else if(newBlock.startTimestamp > newBlock.timestamp || previousBlock.timestamp > newBlock.timestamp) { //LCPoA time checking
        console.log('Error: DLCPoA: Invalid start or block timestamp');
        return false;
    } else if(newBlock.timestamp > (moment().utc().valueOf() + 1000)) {
        console.log('Error: DLCPoA: Invalid local time or block creator time');
        return false;
    } else if(String(newBlock.timestamp).length !== 13 || String(newBlock.startTimestamp).length !== 13) {
        console.log('Error: DLCPoA: Invalid timestamp number');
        return false;
    }

    return true;
}

/**
 * Returns current complexity inf float 0-1
 * @param {Number} currentBlockTime
 * @param {Number} previousBlockTime
 * @return {number}
 */
function getComplexity(currentBlockTime, previousBlockTime) {

    function complexityFormula(distance) {
        return Math.abs((Math.log10((1000 - distance) / (1000 / TARGET_NETWORK_SPEED))));
    }

    const MAX_COMPLEXITY = complexityFormula(0);
    let distance = currentBlockTime - previousBlockTime;
    let internalComplexity = complexityFormula(distance);

    if(!isFinite(internalComplexity) || isNaN(internalComplexity)) {
        return 0;
    }

    return internalComplexity / MAX_COMPLEXITY;
}

/**
 * Проверка хеша блока на валидность
 * @param {String} hash
 * @param {Number} complexity
 * @returns {boolean}
 */
function isValidHash(hash, complexity) {
    let hashSigma = hash.slice(-HASH_SIGMA_LENGTH);
    hashSigma = Number.parseInt(hashSigma, 16);

    return hashSigma <= Math.round(MAX_HASH_SIGMA_INT * (1 - complexity));
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
 * Проверяем готов-ли консенсус
 * @return {boolean}
 */
function isReady() {
    if(blockchain.config.program.disableMining) {
        return false;
    }
    return true;
}

/**
 * DLCPoA не генерирует пустые блоки
 * @return {boolean}
 */
function generateEmptyBlock() {
    return false;
}

/**
 * Toggle empty blocks generation
 * @param generate
 */
function setGenerateEmptyBlocks(generate) {
    return false;
}


module.exports = function (blockchainVar) {
    blockchain = blockchainVar;
    console.log('Info: DLCPoA validator loaded');
    return {
        consensusName: 'DLCPoA',
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks,
    };
};

