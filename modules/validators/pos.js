

const CONSENSUS_NAME = 'PoS';
let blockchain = null;

/**
 * Do we want to generate network support blocks:
 * @type {boolean}
 */
let generateEmptyBlocks = true;
const ThrustedNodesTimeout = 86400 * 1000; //24hours

const Wallet = require('../wallet');
const Block = require('../block');
const Signable = require('../blocksModels/signable');
const storj = require('../instanceStorage');
const moment = require('moment');


/**
 * Test wallet
 * @type {Wallet}
 */
let testWallet = new Wallet();

async function callMethodRollback(address, method, args = [], state = {}) {
    return new Promise(async (resolve, reject) => {
        const ecmaContract = storj.get('ecmaContract');

        if (!(await ecmaContract.contractExists(address))) {
            resolve(false);
        }

        try {
            ecmaContract.callContractMethodRollback(address, method, state, function (err, result) {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(result);
            }, ...args);
        } catch (e) {
            reject(e);
        }
    })
}

/**
 * Checking the correctness of the block
 * @param {Block} newBlock
 * @param {Block} previousBlock
 */
async function isValidNewBlock(newBlock, previousBlock) {
    if(typeof newBlock === 'undefined' || typeof previousBlock === 'undefined') {
        return false;
    }

    if(newBlock.previousHash !== previousBlock.hash) {
        console.log('Error: Thrusted Nodes: Invalid block previous hash');
        return false;
    }

    //Blocks that coincide in time are rejected due to the problem of multiple addition
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

    if(newBlock.sign.length === 0) { //the block is not signed, we give it further
        return false;
    }

    if ([1, 2].includes(newBlock.index)) {
        return true;
    }

    console.log('\n');
    console.log('POS check block', previousBlock.index, '-', newBlock.index);
    const masterContractAddress = blockchain.config.ecmaContract.masterContract;
    const isValidWallet = await callMethodRollback(masterContractAddress, 'checkBlockSign', [newBlock.hash, newBlock.sign]) || testWallet.verifyData(newBlock.hash, newBlock.sign, JSON.parse(newBlock.data)?.state?.from);
    const feeFromBlock = await callMethodRollback(masterContractAddress, 'getFeeFromBlock', [newBlock]);

    console.log('pos', masterContractAddress, isValidWallet, newBlock.fee, feeFromBlock);

    const checkBlockFee = typeof newBlock.fee === 'undefined' || newBlock.fee == feeFromBlock;
    console.log('pos 2', isValidWallet, checkBlockFee);
    return isValidWallet && checkBlockFee;
}



/**
 * Creates a new block
 *
 * @param {Signable} blockData
 * @param {Function} cb
 * @param {Function} cancelCondition
 * @param {int} timestamp
 */
function generateNextBlock(blockData, cb, cancelCondition, timestamp) {
    if(typeof blockData === 'object') {
        blockData = JSON.stringify(blockData);
    }

    blockchain.getLatestBlock(function (previousBlock) {
        if(!previousBlock) {
            console.log('previousBlock', previousBlock);
            return
        }

        let startTimestamp = moment().utc().valueOf(),
            nextTimestamp = moment().utc().valueOf();
        if(typeof timestamp !== 'undefined') {
            startTimestamp = timestamp;
            nextTimestamp = timestamp;
        }

        const nextIndex = previousBlock.index + 1;
        const hash = blockchain.calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, startTimestamp, '');
        const sign = blockchain.wallet.signData(hash).sign;
        const wallet = JSON.parse(blockData).wallet;
        const newBlock = new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, hash, startTimestamp, sign, wallet);

        cb(newBlock);
    })
}

/**
 * Creates an empty block to support transaction confirmation when idle
 */
function generateEmptyBlock() {
    console.log('Generate empty block');

    const empty = new Signable();
    generateNextBlock(empty, (generatedBlock) => {
        blockchain.addBlock(generatedBlock);
        blockchain.broadcastLastBlock();
    });
}

function generateEmptyBlockCheck() {
    if (blockchain && generateEmptyBlocks) {
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
 * For pos, any hash is valid
 * @return {boolean}
 */
function isValidHash() {
    return true;
}

/**
 * Checking the possibility of using PoS consensus
 * @return {boolean}
 */
function isReady() {
    return true;
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

    if(blockchain.config.emptyBlockInterval) {
        setInterval(generateEmptyBlockCheck, blockchain.config.emptyBlockInterval);
    }

    console.log(`Info: Pos validator loaded`);

    return {
        consensusName: CONSENSUS_NAME,
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks,
    };
}