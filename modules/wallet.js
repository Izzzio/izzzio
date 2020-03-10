/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const fs = require('fs');
const moment = require('moment');
const formatToken = require('./formatToken');

const namedStorage = new (require('./NamedInstanceStorage'))();

const logger = new (require('./logger'))();


let cryptography;

/**
 * Wallet object
 * @param walletFile
 * @param {Object} config
 * @returns {{id, block, keysPair: {public,private}, data, balance, addressBook, generate, signData, verifyData, getAddress, setBlock, setWalletFile, save, init, transactions, transact}}
 * @constructor
 */
let Wallet = function (walletFile, config) {

    //Assign named storage
    namedStorage.assign(config.instanceId);

    cryptography = namedStorage.get('cryptography');

    let wallet = {};

    wallet.walletFile = walletFile;

    if(typeof config === 'undefined') {
        config = {
            precision: 1000000,
        };
    }


    wallet.enableLogging = true;
    wallet.log = function (string) {
        if(wallet.enableLogging) {
            console.log(string);
        }
    };

    /**
     * Wallet id (address)
     */
    wallet.id = '';

    /**
     * Block number, where wallet was defined
     * @type {number}
     */
    wallet.block = -1;

    /**
     * Wallet RSA keys
     */
    wallet.keysPair = {public: '', private: ''};

    /**
     * Another wallet data
     */
    wallet.data = {};

    /**
     * Wallet balance (only for cache)
     */
    wallet.balance = 0.00;

    /**
     * Just list of saved addresses
     */
    wallet.addressBook = {};


    /**
     Кошелёк утверждён блокчейном
     */
    wallet.accepted = false;

    /**
     * Generators list
     * @type {{}}
     * @private
     */
    wallet._generatorHooks = [];

    /**
     * Register wallet generator
     * @param generator
     */
    wallet.registerGeneratorHook = function (generator) {
        wallet._generatorHooks.push(generator);
    };

    /**
     * Repair bad generated key
     * @param key
     * @return {*}
     */
    function repairKey(key) {
        if(key[key.length - 1] !== "\n") {
            key += "\n";
        }
        return key.replace(new RegExp("\n\n", 'g'), "\n");
    }

    if(typeof walletFile !== 'undefined' && walletFile) {
        try {
            let walletData = JSON.parse(fs.readFileSync(walletFile));
            wallet.id = walletData.id;
            wallet.keysPair = walletData.keysPair;
            wallet.data = walletData.data;
            wallet.balance = walletData.balance;
            wallet.addressBook = walletData.addressBook;
            wallet.block = walletData.block;
            wallet.accepted = walletData.accepted;

        } catch (e) {
            wallet.log('Error: Invalid wallet file!');
        }
    }

    /**
     * Generates new data for wallet
     */
    wallet.generate = function () {

        let generated = false;
        for (let generator of wallet._generatorHooks) {
            let generatorResult = generator(wallet);
            if(generatorResult) {
                wallet.keysPair = generatorResult.keysPair;
                generated = true;
                break;
            }
        }

        if(!generated) {
            wallet.keysPair = cryptography.generateKeyPair();
        }

        wallet.log('Info: Generated');
        this.createId();
        wallet.create();
    };

    /**
     * Generate wallet ID
     */
    wallet.createId = function (publicKey) {
        publicKey = publicKey || wallet.keysPair.public;
        if(typeof config.signFunction === "undefined" || 0 === config.signFunction.length) {
            wallet.id = cryptography.hash(String(publicKey)).toString();
        } else {
            wallet.id = publicKey;
        }
    };

    if(typeof walletFile === 'undefined') {
        //wallet.generate();
    }

    /**
     * Initialize wallet if not
     * @returns {{}}
     */
    wallet.init = function () {
        if(wallet.id.length === 0) {
            // wallet.generate();
            logger.info('Empty wallet created');
        } /*else if(!wallet.selfValidate()) {
            throw logger.fatal('Wallet self-validation error! Invalid key or sign checking');

        }*/

        return wallet;
    };


    /**
     * Signs data
     * @param data
     * @param key
     * @returns {{data: *, sign: *}}
     */
    wallet.signData = function (data, key) {
        key = typeof key === 'undefined' ? wallet.keysPair.private : key;
        return cryptography.sign(data, key);
    };

    /**
     * Verify data sign
     * @param data
     * @param sign
     * @param key
     * @returns {boolean}
     */
    wallet.verifyData = function (data, sign, key) {
        key = typeof key === 'undefined' ? wallet.keysPair.public : key;
        return cryptography.verify(data, sign, key);
    };

    /**
     * Gets wallet address
     * @param allowTiny
     */
    wallet.getAddress = function (allowTiny) {
        if(wallet.block !== -1 && allowTiny) {
            return 'BL_' + wallet.block;
        }

        return wallet.id;// + (wallet.block === -1 ? '' : ('_' + wallet.block))
    };

    /**
     * Set wallet define block
     * @param blockId
     */
    wallet.setBlock = function (blockId) {
        if(blockId > 0) {
            wallet.block = Number(blockId);
        }

        return wallet;
    };

    /**
     * Wallet file
     * @param path
     */
    wallet.setWalletFile = function (path) {
        wallet.walletFile = path;

        return wallet;
    };

    /**
     * Write current wallet state to file
     * @returns {boolean}
     */
    wallet.save = function () {
        try {
            fs.writeFileSync(wallet.walletFile, JSON.stringify(wallet))
        } catch (e) {
            return false;
        }

        return true;
    };

    wallet.signBlock = function (unsignedBlock) {
        if(unsignedBlock.isSigned()) {
            return unsignedBlock;
        }
        unsignedBlock.sign = wallet.signData(unsignedBlock.data).sign;
        unsignedBlock.pubkey = wallet.keysPair.public;
        return unsignedBlock;
    };

    /**
     * Создает запрос на регистрацию кошелька
     * @returns {{}}
     */
    wallet.create = function () {
        if(wallet.id.length === 0) {
            wallet.log('Error: Can\'t create empty wallet');
            return false;
        }

        return true;
    };


    wallet.update = function () {
        //wallet.log('Info: Wallet balance: ' + formatToken(wallet.balance, config.precision));
        wallet.save();
    };

    /**
     * Self validate signing
     * @return {boolean}
     */
    wallet.selfValidate = function () {
        try {
            let data = String(Math.random());
            data = wallet.signData(data);
            return wallet.verifyData(data.data, data.sign);
        } catch (e) {
            console.log(e);
            return false;
        }
    };

    return wallet;
};

module.exports = Wallet;