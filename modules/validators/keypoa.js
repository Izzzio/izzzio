/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * KeyPoA Nodes validator
 */

/**
 * Blockchain object
 * @type {Blockchain}
 */
let blockchain = null;

const fs = require("fs-extra");
const logger = new (require("../logger"))("KeyPoA");

const KEYPOA_NODES_TIMEOUT = 86400 * 1000; //24hours
const CONSENSUS_NAME = "keypoa";


/**
 * Key operation
 * @type {{add: string, delete: string}}
 */
const KEY_OPERATION = {
    add: "TYPE-KEY-ISSUE",
    delete: "KEY-DELETE"
};

/**
 * Key type
 * @type {{system: string, admin: string}}
 */
const KEY_TYPE = {
    admin: 'Admin',
    system: 'System'
};

/**
 * Do we want to generate blocks for net support
 * @type {boolean}
 */
let generateEmptyBlocks = true;

/**
 * Can we use consensus right now
 * @type {boolean}
 */
let isReadyNow = true;

/**
 * all requests for adding blocks(for callbacks)
 * @type {Array}
 */
let keyPoAAwait = [];

/**
 * keystorageObject
 */
const KEYRING_FILE = "keyStorage.json";
let keyStorage = {};

const Wallet = require("../wallet");
/**
 * Test wallet
 * @type {Wallet}
 */
let testWallet = new Wallet();

const Block = require("../block");
const Signable = require("../blocksModels/signable");
const moment = require("moment");

/**
 * new block validation. is it correct.
 * @param {Block} newBlock
 * @param {Block} previousBlock
 */
function isValidNewBlock(newBlock, previousBlock) {
    if(typeof newBlock === "undefined" || typeof previousBlock === "undefined") {
        return false;
    }

    if(newBlock.previousHash !== previousBlock.hash) {
        logger.error("KeyPoA Nodes: Invalid block previous hash");
        return false;
    }

    //blocks is bad if time is equal. it's a problem of multiple adding
    if(newBlock.timestamp <= previousBlock.timestamp) {
        return false;
    }

    if(newBlock.timestamp - previousBlock.timestamp < KEYPOA_NODES_TIMEOUT && newBlock.sign.length === 0 && newBlock.index > 5) {
        throw "Error: KeyPoA Nodes: Adding other consensus block disabled due security configuration.";
    }

    if(previousBlock.index + 1 !== newBlock.index) {
        logger.error("KeyPoA Nodes: Invalid block index");
        return false;
    }

    if(typeof newBlock.sign === "undefined") {
        logger.error("KeyPoA Nodes: Block format incompatible with KeyPoA nodes consensus");
        return false;
    }

    if(newBlock.sign.length === 0) {
        //block has no signature. it is bad for us
        return false;
    }

    //Admin sign always valid
    if(isValidBlockAdminSign(newBlock)) {
        return true;
    }

    //Is block sign valid
    if(isValidBlockSign(newBlock)) {
        return true;
    }

    logger.error("Fake signed block");

    return false;
}

/**
 * Get callback by timestamp
 * @param timestamp
 * @return {*}
 */
function getKeyPoAAwait(timestamp) {
    for (let a in keyPoAAwait) {
        if(keyPoAAwait.hasOwnProperty(a)) {
            if(Number(keyPoAAwait[a].timestamp) === Number(timestamp)) {
                return keyPoAAwait[a];
            }
        }
    }
    return false;
}

/**
 * create new block
 *
 * @param {Signable} blockData
 * @param {Function} cb
 * @param {Function} cancelCondition
 * @param {int} timestamp
 */
function generateNextBlock(blockData, cb, cancelCondition, timestamp) {
    if(typeof blockData === "object") {
        blockData = JSON.stringify(blockData);
    }

    blockchain.getLatestBlock(function (previousBlock) {
        if(!previousBlock) {
            return;
        }

        let startTimestamp = moment().utc().valueOf(),
            nextTimestamp = moment().utc().valueOf();
        if(typeof timestamp !== "undefined") {
            startTimestamp = timestamp;
            nextTimestamp = timestamp;
        }
        const nextIndex = previousBlock.index + 1;

        let hash = blockchain.calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, startTimestamp, "");

        let sign = blockchain.wallet.signData(hash).sign;

        let newBlock = new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, hash, startTimestamp, sign);
        cb(newBlock);
    });
}

/**
 * Creates empty block. For net support when idle
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
 * Check if we will generate new empty block
 * @return {boolean}
 */
function generateEmptyBlockCheck() {
    if(blockchain !== null && generateEmptyBlocks) {
        //Мы не выпускали ключи
        if(!isKeyFromKeyStorage(blockchain.wallet.keysPair.public)) {
            console.log("Info: We can't generate empty KeyPoA blocks");
            generateEmptyBlocks = false;
            return false;
        }
        blockchain.getLatestBlock(function (previousBlock) {
            if(!previousBlock) {
                return;
            }
            if(moment().utc().valueOf() - previousBlock.timestamp > blockchain.config.generateEmptyBlockDelay) {
                console.log("Info: Create empty block");
                generateEmptyBlock();
            }
        });
    }
}

/**
 * Check if we can use consensus
 * @return {boolean}
 */
function isReady() {
    return isKeyFromKeyStorage(blockchain.wallet.keysPair.public);
}

/**
 * All hash is good for KeyPoA
 * @return {boolean}
 */
function isValidHash() {
    return true;
}

/**
 * Toggle empty blocks generation
 * @param generate
 */
function setGenerateEmptyBlocks(generate) {
    generateEmptyBlocks = generate;
}

/**
 * Checks if this public key is in the list
 * @param {String} publicKey
 * @returns {boolean}
 */
function isKeyFromKeyStorage(publicKey) {
    for (let [value] of Object.entries(keyStorage)) {
        if(value.key === publicKey) {
            return true;
        }
    }
}

/**
 * Saves keyring in file
 * @param {object} object
 * @param {string} dir
 * @param {string} file
 */
function rewriteKeyFile(object = keyStorage, dir = blockchain.config.workDir, file = KEYRING_FILE) {
    fs.writeFileSync(dir + "/" + file, JSON.stringify(object));
}


/**
 * Saves key to storage
 * @param {string} publicKey
 * @param {string} type
 */
function saveKeyToKeyStorage(publicKey, type = KEY_TYPE.system) {
    if(typeof keyStorage[publicKey] === 'undefined' && (type === KEY_TYPE.system || KEY_TYPE.admin)) {
        keyStorage[publicKey] = {key: publicKey, type: type};
        rewriteKeyFile();
    }
}


/**
 * remove key from storage
 * @param {string} publicKey
 */
function deleteKeyFromKeyStorage(publicKey) {
    delete keyStorage[publicKey];
}


/**
 * Loads keyring file
 * @param {string} dir
 * @param {string} file
 */
function loadKeyStorage(dir = blockchain.config.workDir, file = KEYRING_FILE) {
    return JSON.parse(Buffer.from(fs.readFileSync(dir + "/" + file)).toString());
}

/**
 * Check is valid admin or system sign
 * @param {Block} block
 * @returns {boolean}
 */
function isValidBlockSign(block) {
    for (let [value] of Object.entries(keyStorage)) {
        if(testWallet.verifyData(block.hash, block.sign, value.key)) {
            return true;
        }
    }
    return false;
}

/**
 * Check is valid admin key sign
 * @param {Block} block
 * @returns {boolean}
 */
function isValidBlockAdminSign(block) {
    for (let [value] of Object.entries(keyStorage)) {
        if(testWallet.verifyData(block.hash, block.sign, value.key) && value.type === KEY_TYPE.admin) {
            return true;
        }
    }

    return false;
}


/**
 * Handle key operation block
 * @param {Block} block
 * @param {Signable} blockData
 * @param {function} cb
 */
function handleKeyBlock(blockData, block, cb) {
    if(!isValidBlockAdminSign(block)) {
        logger.warning('Invalid key operation block sign in' + block.index);
        return cb();
    }

    if(typeof blockData === "string") {
        try {
            blockData = JSON.parse(blockData);
        } catch (e) {
        }
    }

    if(!blockData) {
        logger.warning('Invalid key operation block in' + block.index);
        return cb();
    }

    //data for keys operations should be: blockData.data={keyType, publicKey}
    if(blockData.type === KEY_OPERATION.add) {
        saveKeyToKeyStorage(blockData.data.publicKey, blockData.data.keyType);
        return cb();
    } else if(blockData.type === KEY_OPERATION.delete) {
        deleteKeyFromKeyStorage(blockData.data.publicKey);
        return cb();
    }


    return cb();
}

module.exports = function (blockchainVar) {
    blockchain = blockchainVar;

    try {
        keyStorage = loadKeyStorage(blockchain.config.workDir, KEYRING_FILE);
    } catch (e) {
        logger.warning("Keyring file not found. Using empty storage.");
    }

    logger.info("KeyPoA Nodes validator loaded");

    if(blockchain.config.emptyBlockInterval) {
        setInterval(generateEmptyBlockCheck, blockchain.config.emptyBlockInterval);
    }

    blockchain.blockHandler.registerBlockHandler(KEY_OPERATION.add, handleKeyBlock);
    blockchain.blockHandler.registerBlockHandler(KEY_OPERATION.delete, handleKeyBlock);


    return {
        consensusName: CONSENSUS_NAME,
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks
    };
};
