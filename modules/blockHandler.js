/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const Keyring = require("./blocksModels/keyring");
const Wallet = require("./wallet");
const fs = require("fs-extra");

const logger = new (require("./logger"))();
const storj = require("./instanceStorage");

/**
 * Предел до которого сеть может принять блок ключей
 * @type {number}
 */
const keyEmissionMaxBlock = 5;

/**
 * Ловец блоков
 * В данной реализации обрабатывает всю загруженную блокчейн сеть, верефицирует транзанкции, создания кошельков, корректности цифровых подписей, связку ключей и пустые блоки
 */
class BlockHandler {
    constructor(wallet, blockchain, blockchainObject, config, options) {
        this.wallet = wallet;
        this.blockchain = blockchain;

        this.options = options;
        this.maxBlock = -1;
        this.enableLogging = true;

        /**
         * External block handlers
         * @type {{}}
         * @private
         */
        this._blocksHandlers = {};

        this.syncInProgress = false;
        storj.put("syncInProgress", false);
        this.keyring = [];

        try {
            this.keyring = JSON.parse(fs.readFileSync(config.workDir + '/keyring.json'));
        } catch (e) {
        }

        this.blockchainObject = blockchainObject;
        this.config = config;

        this.transactor = undefined;
        this.frontend = undefined;
    }

    /**
     * Регистрируем новый обработчик блока
     * @param {string} type
     * @param {function} handler WARNING: Always call callback in handler method
     */
    registerBlockHandler(type, handler) {

        if(typeof handler !== 'function') {
            return false;
        }

        if(typeof this._blocksHandlers[type] === 'undefined') {
            this._blocksHandlers[type] = [];
        }

        this._blocksHandlers[type].push(handler);
        return true;
    }

    /**
     * Сообщаем информацию о номере последнего блока
     * @param max
     */
    changeMaxBlock(max) {
        this.maxBlock = max;
    }

    log(string) {
        if(this.enableLogging) {
            console.log((new Date()).toUTCString() + ': ' + string);
        }
    }

    /**
     * Очищает базу с таблицей кошельков
     * @param cb
     */
    clearDb(cb) {
        let that = this;
        setTimeout(function () {
            cb();
        }, 100);
    }

    /**
     * Запуск пересинхронизации блокчейна
     * Проводит проверку всех блоков и подсчитывает деньги на кошельках
     */
    resync(cb) {
        let that = this;
        if(that.syncInProgress) {
            return;
        }
        that.syncInProgress = true;
        storj.put('syncInProgress', true);

        logger.info('Blockchain resynchronization started');
        that.clearDb(function () {
            that.playBlockchain(0, function () {
                logger.info('Blockchain resynchronization finished');
                if(cb) {
                    cb();
                }
            });
        });
    }

    /**
     * Async block handler
     * @param result
     * @returns {Promise<unknown>}
     */
    asyncHandleBlock(result) {
        let that = this;
        return new Promise((resolve, reject) => {
            that.handleBlock(JSON.parse(result), (err, result) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Проверяет содержится-ли этот публичный ключ в связке
     * @param {String} publicKey
     * @returns {boolean}
     */
    isKeyFromKeyring(publicKey) {
        return this.keyring.indexOf(publicKey) !== -1;
    }

    /**
     * Воспроизведение блокчейна с определенного момента
     * @param fromBlock
     * @param cb
     */
    playBlockchain(fromBlock, cb) {
        let that = this;
        that.syncInProgress = true;
        storj.put('syncInProgress', true);
        if(!that.config.program.verbose) {
            that.enableLogging = false;
            logger.disable = true;
            that.wallet.enableLogging = false;
        }
        (async function () {
            let prevBlock = null;
            for (let i = fromBlock; i < that.maxBlock + 1; i++) {
                let result;
                try {
                    result = await that.blockchain.getAsync(i);
                    if(prevBlock !== null) {
                        if(JSON.parse(prevBlock).hash !== JSON.parse(result).previousHash) {
                            if(that.config.program.autofix) {
                                logger.info('Autofix: Delete chain data after ' + i + ' block');

                                for (let a = i; a < that.maxBlock + 1; a++) {
                                    await that.blockchain.delAsync(a);
                                }

                                logger.info('Info: Autofix: Set new blockchain height ' + i);
                                await that.blockchain.putAsync('maxBlock', i - 1);
                                that.syncInProgress = false;
                                storj.put("syncInProgress", false);
                                that.enableLogging = true;
                                logger.disable = false;
                                that.wallet.enableLogging = true;

                                if(typeof cb !== "undefined") {
                                    cb();
                                }

                                return;
                                break;
                            } else {
                                logger.disable = false;
                                console.log('PREV', JSON.parse(prevBlock));
                                console.log('CURR', JSON.parse(result));
                                logger.fatalFall('Saved chain corrupted in block ' + i + '. Remove wallets and blocks dirs for resync. Also you can use --autofix');
                            }
                        }
                    }
                    prevBlock = result;
                } catch (e) {
                    if(that.config.program.autofix) {
                        console.log('Info: Autofix: Set new blockchain height ' + (i - 1));
                        await that.blockchain.putAsync('maxBlock', i - 1);
                    } else {
                        console.log(e);
                        logger.fatalFall('Saved chain corrupted. Remove wallets and blocks dirs for resync. Also you can use --autofix');
                    }
                    //continue;
                } //No important error. Ignore
                await that.asyncHandleBlock(result);
            }

            that.syncInProgress = false;
            storj.put('syncInProgress', false);
            that.enableLogging = true;
            logger.disable = false;
            that.wallet.enableLogging = true;

            if(typeof cb !== 'undefined') {
                cb();
            }
        })();
    }

    /**
     * Обработка входящего блока
     * @param block
     * @param callback
     * @returns {*}
     */
    handleBlock(block, callback) {
        let that = this;
        if(typeof callback === 'undefined') {
            callback = function () {
                //Dumb
            }
        }

        try {
            let blockData;
            // if(typeof block.data !== 'object') {
            try {
                blockData = JSON.parse(block.data);
            } catch (e) {
                logger.info('Not JSON block ' + block.index);
                return callback();
            }
            /* } else {
                 blockData = block.data;
             }*/

            if(block.index === keyEmissionMaxBlock) {
                if(that.keyring.length === 0) {
                    logger.warning("Network without keyring");
                }

                if(that.isKeyFromKeyring(that.wallet.keysPair.public)) {
                    logger.warning("TRUSTED NODE. BE CAREFUL.");
                }
            }

            switch (blockData.type) {
                case Keyring.prototype.constructor.name:
                    if(block.index >= keyEmissionMaxBlock || that.keyring.length !== 0) {
                        logger.warning("Fake keyring in block " + block.index);
                        return callback();
                    }
                    logger.info("Keyring recived in block " + block.index);
                    that.keyring = blockData.keys;
                    fs.writeFileSync(that.config.workDir + "/keyring.json", JSON.stringify(that.keyring));
                    return callback();
                    break;
                case "Empty":
                    return callback();
                    break;
                default:
                    /**
                     * Запускаем на каждый тип блока свой обработчик
                     */
                    if(typeof that._blocksHandlers[blockData.type] !== "undefined") {
                        for (let i in that._blocksHandlers[blockData.type]) {
                            if(that._blocksHandlers[blockData.type].hasOwnProperty(i)) {
                                try {
                                    that._blocksHandlers[blockData.type][i](blockData, block, callback);
                                } catch (e) {
                                    console.log(e);
                                    return callback();
                                }
                            }
                        }
                    } else {
                        if(that.config.program.verbose) {
                            logger.info("Unexpected block type " + block.index);
                        }
                        return callback();
                    }
            }
        } catch (e) {
            console.log(e);
            return callback();
        }
    }
}

module.exports = BlockHandler;
