/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * fsbPoA Nodes validator
 */

/**
 * Blockchain object
 * @type {Blockchain}
 */
let blockchain = null;

const fsbPoANodesTimeout = 86400 * 1000; //24hours
const consensusName = "fsbpoa";

const keyOperation = {
    add: "TYPE-KEY-ISSUE",
    delete: "KEY-DELETE"
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
let fsbPoAAwait = [];

/**
 * read all keys from keystorage file
 */
const keyStorageFile = "keyStorage.json";
let keyStorage = { Admin: "", System: [] };
const keyStorageFromFile = loadKeyStorage();
keyStorage = keyStorageFromFile ? keyStorageFromFile : keyStorage;

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
    if (
        typeof newBlock === "undefined" ||
        typeof previousBlock === "undefined"
    ) {
        return false;
    }

    if (newBlock.previousHash !== previousBlock.hash) {
        console.log("Error: fsbPoA Nodes: Invalid block previous hash");
        return false;
    }

    //blocks is bad if time is equal. it's a problem of multiple adding
    if (newBlock.timestamp <= previousBlock.timestamp) {
        return false;
    }

    if (
        newBlock.timestamp - previousBlock.timestamp < fsbPoANodesTimeout &&
        newBlock.sign.length === 0 &&
        newBlock.index > 5
    ) {
        throw "Error: fsbPoA Nodes: Adding other consensus block disabled due security configuration.";
    }

    if (previousBlock.index + 1 !== newBlock.index) {
        console.log("Error: fsbPoA Nodes: Invalid block index");
        return false;
    }

    if (typeof newBlock.sign === "undefined") {
        console.log(
            "Error: fsbPoA Nodes: Block format incompatible with fsbPoA nodes consensus"
        );
        return false;
    }

    if (newBlock.sign.length === 0) {
        //block has no signature. it is bad for us
        return false;
    }
    if (checkBlockSign(newBlock)) return true;

    console.log("Error: Fake signed block");

    return false;
}

/**
 * Get callback by timestamp
 * @param timestamp
 * @return {*}
 */
function getfsbPoAAwait(timestamp) {
    for (let a in fsbPoAAwait) {
        if (fsbPoAAwait.hasOwnProperty(a)) {
            if (Number(fsbPoAAwait[a].timestamp) === Number(timestamp)) {
                return fsbPoAAwait[a];
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
    if (typeof blockData === "object") {
        blockData = JSON.stringify(blockData);
    }

    blockchain.getLatestBlock(function(previousBlock) {
        if (!previousBlock) {
            return;
        }

        let startTimestamp = moment()
                .utc()
                .valueOf(),
            nextTimestamp = moment()
                .utc()
                .valueOf();
        if (typeof timestamp !== "undefined") {
            startTimestamp = timestamp;
            nextTimestamp = timestamp;
        }
        const nextIndex = previousBlock.index + 1;

        let hash = blockchain.calculateHash(
            nextIndex,
            previousBlock.hash,
            nextTimestamp,
            blockData,
            startTimestamp,
            ""
        );

        let sign = blockchain.wallet.signData(hash).sign;

        let newBlock = new Block(
            nextIndex,
            previousBlock.hash,
            nextTimestamp,
            blockData,
            hash,
            startTimestamp,
            sign
        );

        cb(newBlock);
    });
}

/**
 * Creates empty block. For net support when idle
 */
function generateEmptyBlock() {
    let empty = new Signable();
    if (isReady()) {
        generateNextBlock(empty, function(generatedBlock) {
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
    if (blockchain !== "null" && generateEmptyBlocks) {
        //Мы не выпускали ключи
        if (!isKeyFromKeyStorage(blockchain.wallet.keysPair.public)) {
            console.log("Info: We can't generate empty fsbPoA blocks");
            generateEmptyBlocks = false;
            return false;
        }
        blockchain.getLatestBlock(function(previousBlock) {
            if (!previousBlock) {
                return;
            }
            if (
                moment()
                    .utc()
                    .valueOf() -
                    previousBlock.timestamp >
                blockchain.config.generateEmptyBlockDelay
            ) {
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
    if (isKeyFromKeyStorage(blockchain.wallet.keysPair.public)) {
        //Если мы готовы работать, то выключаем генерацию пустых блоков остальных консенсусов
        for (let a in blockchain.config.validators) {
            if (
                blockchain.config.validators.hasOwnProperty(a) &&
                blockchain.config.validators[a].consensusName !== consensusName
            ) {
                try {
                    blockchain.config.validators[a].setGenerateEmptyBlocks(
                        false
                    );
                } catch (e) {
                    console.log(e);
                }
            }
        }
        return true;
    }

    //check do we have keys or not
    if (keyStorageToArray().length !== 0 && isReadyNow) {
        isReadyNow = true;
    } else {
        isReadyNow = false;
    }

    blockchain.getLatestBlock(function(previousBlock) {
        if (!previousBlock) {
            isReadyNow = false;
        }

        if (typeof previousBlock.sign === "undefined") {
            isReadyNow = false;
            return isReadyNow;
        }

        if (
            previousBlock.sign.length !== 0 &&
            moment()
                .utc()
                .valueOf() -
                previousBlock.timestamp >
                fsbPoANodesTimeout
        ) {
            isReadyNow = false;
        } else {
            if (
                moment()
                    .utc()
                    .valueOf() -
                    previousBlock.timestamp >
                fsbPoANodesTimeout
            ) {
                isReadyNow = false;
            } else {
                isReadyNow = true;
            }
        }
    });

    return isReadyNow;
}

/**
 * All hash is good for fsbPoA
 * @return {boolean}
 */
function isValidHash() {
    return true;
}

/**
 * handling blocks with keys operations
 * @param {Block} block
 * @param {Signable} blockData
 * @param {function} cb
 */
function handleKeyBlock(blockData, block, cb) {
    const keyType = checkBlockSign(block);

    //do nothing if type not 'Admin'
    if (keyType !== "Admin") {
        return false;
    }

    if (!blockData) {
        return false;
    }

    if (typeof blockData === "string") {
        try {
            blockData = JSON.parse(blockData);
        } catch (e) {
            return false;
        }
    }
    //data for keys operations should be: blockData.data={keyType, publicKey}
    if (blockData.type === keyOperation.add) {
        saveKeyToKeyStorage(
            blockData.data.publicKey,
            blockData.data.keyType //'Admin' | 'System'
        );
        return true;
    }

    if (blockData.type === keyOperation.delete) {
        deleteKeyFromKeyStorage(blockData.data.publicKey);
        return true;
    }
    //do nothing because we don't know such type
    return false;
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
    keyStorage = adminKeyPersistenseCheck();
    return (
        keyStorage.Admin === publicKey ||
        keyStorage.System.indexOf(publicKey) !== -1
    );
}

/**
 * make array from keys object
 */
function keyStorageToArray() {
    return [keyStorage.Admin, ...keyStorage.System];
}

/**
 * checks if this key is aadmin key
 * @param {string} publicKey
 */
function isAdminKey(publicKey) {
    keyStorage = adminKeyPersistenseCheck();
    return publicKey === keyStorage.Admin;
}

/**
 * save currebt state of keyObject to file as JSON
 * @param {object} object
 * @param {string} dir
 * @param {string} file
 */
function rewriteKeyFile(
    object = keyStorage,
    dir = blockchain.config.workDir,
    file = keyStorageFile
) {
    fs.writeFileSync(dir + "/" + file, JSON.stringify(object));
}

/**
 * add new key to keyStorage(if admin key, then rewrite it)
 * @param {string} publicKey
 * @param {string} type Admin | System
 */
function saveKeyToKeyStorage(publicKey, type = "System") {
    let changed = false;
    if (type === "System") {
        if (!keyStorage.System.find(x => x === publicKey)) {
            keyStorage.System.push(publicKey);
            changed = true;
        }
    } else {
        //there could be only one admin key so we rewrite it
        if (keyStorage.Admin !== publicKey) {
            keyStorage.Admin = publicKey;
            changed = true;
        }
    }
    if (changed) {
        rewriteKeyFile();
    }
}

/**
 * delete key from keystorage. only for keys of type "System". we cannot delete key with type "Admin"
 * @param {string} publicKey
 */
function deleteKeyFromKeyStorage(publicKey) {
    let changed = false;
    if (keyStorage.System.find(v => v === publicKey)) {
        keyStorage.System = keyStorage.System.filter(v => v !== publicKey);
        changed = true;
    }
    if (changed) {
        rewriteKeyFile();
    }
}

/**
 * check if we have admin key. if not, then we try to load
 */
function adminKeyPersistenseCheck() {
    let keyStorageFromFile = "";
    if (!keyStorage.Admin) {
        keyStorageFromFile = loadKeyStorage(
            blockchain.config.workDir,
            keyStorageFile
        );
    }
    return keyStorageFromFile ? keyStorageFromFile : keyStorage;
}

/**
 * returns key type (Admin | System) if block was signed with key from keystorage. returns false if signed with other key
 * @param {Block} newBlock
 */
function checkBlockSign(newBlock) {
    keyStorage = adminKeyPersistenseCheck();
    const keyStorageArr = keyStorageToArray();
    for (let key of keyStorageArr) {
        try {
            if (
                blockchain.wallet.verifyData(newBlock.hash, newBlock.sign, key)
            ) {
                return isAdminKey(key) ? "Admin" : "System";
            }
        } catch {}
    }
    return false;
}

/**
 * get and parse keystorage object from file
 * @param {string} dir
 * @param {string} file
 */
function loadKeyStorage(
    dir = blockchain.config.workDir,
    file = keyStorageFile
) {
    try {
        return JSON.parse(
            Buffer.from(fs.readFileSync(dir + "/" + file)).toString()
        );
    } catch (e) {
        return;
    }
}

module.exports = function(blockchainVar) {
    blockchain = blockchainVar;
    console.log("Info: fsbPoA Nodes validator loaded");
    setInterval(generateEmptyBlockCheck, blockchain.config.emptyBlockInterval);
    setTimeout(function() {
        isReady();
    }, 5000);

    blockchain.blockHandler.registerBlockHandler(
        keyOperation.add,
        handleKeyBlock
    );
    blockchain.blockHandler.registerBlockHandler(
        keyOperation.delete,
        handleKeyBlock
    );

    return {
        consensusName: consensusName,
        isValidNewBlock: isValidNewBlock,
        generateNextBlock: generateNextBlock,
        isValidHash: isValidHash,
        isReady: isReady,
        generateEmptyBlock: generateEmptyBlock,
        setGenerateEmptyBlocks: setGenerateEmptyBlocks
    };
};
