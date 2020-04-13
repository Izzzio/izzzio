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

const CONSENSUS_NAME = "keypoa";


/**
 * Key operation
 * @type {{add: string, delete: string}}
 */
const KEY_OPERATION = {
    add: "KO-KEY-ISSUE",
    delete: "KO-KEY-DELETE"
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
 * keystorageObject
 */
const KEYRING_FILE = "poaKeyStorage.json";
let keyStorage = {};

const Wallet = require("../wallet");
/**
 * Test wallet
 * @type {Wallet}
 */
let testWallet = new Wallet();


const storj = require('../instanceStorage');
const Block = require("../block");
const Signable = require("../blocksModels/signable");
const KeyIssue = require("../blocksModels/keypoa/keyIssue");
const KeyDelete = require("../blocksModels/keypoa/keyDelete");
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
    return typeof keyStorage[publicKey] !== 'undefined';
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
    for (let keys of Object.keys(keyStorage)) {
        let key = keyStorage[keys];
        if(key.type === KEY_TYPE.admin && testWallet.verifyData(block.hash, block.sign, key.key)) {
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
        saveKeyToKeyStorage(blockData.publicKey, blockData.keyType);
        return cb();
    } else if(blockData.type === KEY_OPERATION.delete) {
        deleteKeyFromKeyStorage(blockData.publicKey);
        return cb();
    }


    return cb();
}

/**
 * Issue new key
 * @param {string} publicKey
 * @param {string} keyType
 * @return {Promise<unknown>}
 */
function issueKey(publicKey, keyType = KEY_TYPE.system) {
    return new Promise((resolve, reject) => {
        let keyIssueBlock = new KeyIssue(publicKey, keyType);
        keyIssueBlock = blockchain.wallet.signBlock(keyIssueBlock);
        if(isReady()) {
            generateNextBlock(keyIssueBlock, function (generatedBlock) {
                if(!isValidBlockAdminSign(generatedBlock)) {
                    return reject('Invalid admin signature');
                }

                blockchain.addBlock(generatedBlock, () => {
                    //console.log(generatedBlock);
                    resolve(generatedBlock);
                });
                blockchain.broadcastLastBlock();
                //resolve(generatedBlock);
            });
        } else {
            reject('Consensus not ready')
        }
    })
}

/**
 * Delete key block
 * @param {string} publicKey
 * @return {Promise<unknown>}
 */
function deleteKey(publicKey) {
    return new Promise((resolve, reject) => {
        let keyDeleteBlock = new KeyDelete(publicKey);
        keyDeleteBlock = blockchain.wallet.signBlock(keyDeleteBlock);
        if(isReady()) {
            generateNextBlock(keyDeleteBlock, function (generatedBlock) {
                if(!isValidBlockAdminSign(generatedBlock)) {
                    return reject('Invalid admin signature');
                }
                blockchain.addBlock(generatedBlock, () => {
                    resolve(generatedBlock);
                });
                blockchain.broadcastLastBlock();

            });
        } else {
            reject('Consensus not ready')
        }
    })
}

/**
 * Replace current key storage with new
 * @param keyStorageReplacement
 * @private
 */
function _replaceKeyStorage(keyStorageReplacement) {
    keyStorage = keyStorageReplacement;
}

/**
 * Returns current state of key storage
 * @return {{}}
 */
function getCurrentKeyStorage() {
    return keyStorage;
}

module.exports = function (blockchainInstance) {
    blockchain = blockchainInstance;

    try {
        keyStorage = loadKeyStorage(blockchain.config.workDir, KEYRING_FILE);
    } catch (e) {
        logger.warning("Keyring file not found. Using empty storage.");
        rewriteKeyFile();
    }

    logger.info("KeyPoA Nodes validator loaded");

    if(blockchain.config.emptyBlockInterval) {
        setInterval(generateEmptyBlockCheck, blockchain.config.emptyBlockInterval);
    }

    //Initial admin keys
    if(Array.isArray(blockchain.config.keypoaInitialAdminKeys)) {
        for (let adminKey of blockchain.config.keypoaInitialAdminKeys) {
            keyStorage[adminKey] = {key: adminKey, type: KEY_TYPE.admin};
        }
    }

    blockchain.blockHandler.registerBlockHandler(KEY_OPERATION.add, handleKeyBlock);
    blockchain.blockHandler.registerBlockHandler(KEY_OPERATION.delete, handleKeyBlock);


    const keyPOAObject = {
        consensusName: CONSENSUS_NAME,
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks,
        interface: {
            issueKey,
            deleteKey,
            loadKeyStorage,
            _replaceKeyStorage,
            isValidBlockAdminSign,
            isValidBlockSign,
            isKeyFromKeyStorage,
            KEYRING_FILE,
            KEY_TYPE,
            KEY_OPERATION,
            keyStorage,
            getCurrentKeyStorage
        }
    };

    storj.put('keypoa', keyPOAObject);

    return keyPOAObject;
};
