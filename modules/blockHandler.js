/**
 iZ³ | Izzzio blockchain - https://izzz.io
 BitCoen project - https://bitcoen.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

//const Smart = require("./smart");
const Keyring = require("./blocks/keyring");
const Transaction = require("./blocks/transaction");
const WalletRegister = require("./blocks/walletRegister");
const Wallet = require("./wallet");
const Sync = require('sync');
const fs = require('fs-extra');
const formatToken = require('./formatToken');
const moment = require('moment');

const KeyValue = require('./keyvalue');
const levelup = require('level');

const logger = new (require('./logger'))();
const storj = require('./instanceStorage');

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

        if(!config.program.fastLoad) {
            try {
                fs.removeSync(config.workDir + '/wallets');
            } catch (e) {
            }
        }
        this.wallets =  new KeyValue(config.walletsDB); // levelup(config.workDir + '/wallets');
        this.options = options;
        this.maxBlock = -1;
        this.enableLogging = true;
        this.ourWalletBlocks = {income: [], outcome: []};

        if(config.program.fastLoad) {
            try {
                this.ourWalletBlocks = JSON.parse(fs.readFileSync(config.workDir + '/ourWalletBlocks.json'));
            } catch (e) {
            }
        }

        this.syncInProgress = false;
        storj.put('syncInProgress', false);
        this.keyring = [];

        try {
            this.keyring = JSON.parse(fs.readFileSync(config.workDir + '/keyring.json'));
        } catch (e) {
        }

        this.blockchainObject = blockchainObject;
        this.config = config;

        this.transactor = undefined;
        this.frontend = undefined;
        this.runningSmarts = [];
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
            //try {
                that.wallets.clear(function () {
                    cb();
                });
            /*} catch (e) {
                console.log(e);
            }*/

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
        that.ourWalletBlocks = {income: [], outcome: []};
        that.clearDb(function () {
            that.playBlockchain(0, cb);
        });

    }

    //Врапперы для модуля Sync, а то он любит портить this объекта
    exBlockhainGet(index, callback) {
        this.blockchain.get(index, callback);
    }

    exBlockHandler(result, callback) {
        this.handleBlock(JSON.parse(result), callback)
    }

    /**
     * Проверяет содержится-ли этот публичный ключ в связке
     * @param {String} publicKey
     * @returns {boolean}
     */
    isKeyFromKeyring(publicKey) {
        return this.keyring.indexOf(publicKey) !== -1
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
        Sync(function () {
            let prevBlock = null;
            for (let i = fromBlock; i < that.maxBlock + 1; i++) {
                let result;
                try {
                    result = that.exBlockhainGet.sync(that, i);
                    if(prevBlock !== null) {
                        if(JSON.parse(prevBlock).hash !== JSON.parse(result).previousHash) {
                            if(that.config.program.autofix) {
                                logger.info('Autofix: Delete chain data after ' + i + ' block');

                                for (let a = i; a < that.maxBlock + 1; a++) {
                                    that.blockchain.del.sync(that.blockchain, a);
                                }

                                logger.info('Info: Autofix: Set new blockchain height ' + i);
                                that.blockchain.put.sync(that.blockchain, 'maxBlock', i - 1);
                                that.syncInProgress = false;
                                storj.put('syncInProgress', false);
                                that.enableLogging = true;
                                logger.disable = false;
                                that.wallet.enableLogging = true;
                                cb();
                                return;
                                break;
                            } else {
                                logger.disable = false;
                                console.log(JSON.parse(prevBlock));
                                console.log(JSON.parse(result));
                                logger.fatal('Saved chain corrupted in block ' + i + '. Remove wallets and blocks dirs for resync. Also you can use --autofix');
                                process.exit(1);
                            }
                        }
                    }
                    prevBlock = result;
                } catch (e) {
                    if(that.config.program.autofix) {
                        console.log('Info: Autofix: Set new blockchain height ' + (i - 1));
                        that.blockchain.put.sync(that.blockchain, 'maxBlock', i - 1);
                    } else {
                        console.log(e);
                        logger.fatal('Saved chain corrupted. Remove wallets and blocks dirs for resync. Also you can use --autofix');
                        process.exit(1);
                    }
                    //continue;
                } //No important error. Ignore
                that.exBlockHandler.sync(that, result);
            }

            that.syncInProgress = false;
            storj.put('syncInProgress', false);
            that.enableLogging = true;
            logger.disable = false;
            that.wallet.enableLogging = true;
            if(typeof cb !== 'undefined') {
                cb();
            }
        });
    }

    /**
     * Get wallet by full any address
     * @param id
     * @param cb
     */
    getWallet(id, cb) {
        let that = this;
        id = id.toLowerCase();
        if(id.indexOf('bl_') !== -1) {
            let blockIndex = id.split('_')[1];
            that.blockchain.get(blockIndex, function (err, val) {
                if(err) {
                    return cb(false);
                }
                let block;
                try {
                    block = JSON.parse(val);
                    block.data = JSON.parse(block.data);
                } catch (e) {
                    return cb(false);
                }
                let id = block.data.id;
                if(typeof id === 'undefined') {
                    return cb(false);
                }
                that.wallets.get(id, function (err, val) {
                    if(!err) {
                        return cb(val);
                    }
                    cb(false);
                });
            });
            return;
        }
        if(id.indexOf('_') !== -1) {
            id = id.split('_')[0];
        }

        that.wallets.get(id, function (err, val) {
            if(!err) {
                cb(val);
            } else {
                cb(false);
            }
        })
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
            try {
                blockData = JSON.parse(block.data);
            } catch (e) {
                that.log('Info: Not JSON block ' + block.index);
                return callback();
            }

            // that.log(blockData.type + block.index);

            if(block.index === keyEmissionMaxBlock) {
                if(this.keyring.length === 0) {
                    logger.warning('Network without keyring');
                }

                if(this.isKeyFromKeyring(this.wallet.keysPair.public)) {
                    logger.warning('THRUSTED NODE. BE CAREFUL.');
                }
            }

            switch (blockData.type) {
                case WalletRegister.prototype.constructor.name:
                    this.handleWalletBlock(blockData, block, callback);
                    break;
                case Transaction.prototype.constructor.name:
                    if(this.handleTransaction(blockData, block, callback)) {
                        fs.writeFileSync(that.config.workDir + '/ourWalletBlocks.json', JSON.stringify(this.ourWalletBlocks));
                    } else {
                        // logger.error('Block ' + block + ' rejected');
                    }
                    break;
                case Keyring.prototype.constructor.name:
                    if(block.index >= keyEmissionMaxBlock || this.keyring.length !== 0) {
                        logger.warning('Fake keyring in block ' + block.index);
                        return callback();
                    }
                    logger.info('Keyring recived in block ' + block.index);
                    this.keyring = blockData.keys;
                    fs.writeFileSync(this.config.workDir + '/keyring.json', JSON.stringify(this.keyring));
                    return callback();
                    break;
                /*                case Smart.prototype.constructor.name:
                                    this.handleSmartBlock(blockData, block, callback);
                                    break;*/
                case 'Empty':
                    return callback();
                    break;
                default:
                    logger.info('Unexpected block type ' + block.index);
                    return callback();
            }
        } catch (e) {
            console.log(e);
            return callback();
        }


    }

    checkBlock(block, callback) {

    }


    /**
     * Обрабатывает блок создания кошелька
     * @param {WalletRegister} blockData
     * @param block
     * @param callback
     */
    handleWalletBlock(blockData, block, callback) {
        const that = this;
        let tempRegister = new WalletRegister(blockData.id);
        let testWallet = new Wallet();
        if(testWallet.verifyData(tempRegister.data, blockData.sign, blockData.pubkey)) {
            testWallet.id = blockData.id;
            testWallet.block = block.index;
            testWallet.keysPair.public = blockData.pubkey;
            testWallet.balance = 0;
            that.wallets.get(blockData.id, function (err, val) {
                if(err) {
                    that.wallets.del(blockData.id, {sync: true}, function (err) {
                        that.wallets.put(blockData.id, JSON.stringify(testWallet), {sync: true}, function (err) {
                            if(testWallet.id === that.wallet.id) {
                                that.wallet.block = block.index;
                                that.wallet.balance = testWallet.balance;
                                that.wallet.accepted = true;
                                that.wallet.update();
                            }
                            return callback();
                        });
                    });
                } else {
                    logger.error('Uhm... Wallet recreation? Block: ' + block.index);
                    return callback();
                }
            });


        } else {
            logger.error('Incorrect sign in block ' + block.index);
            return callback();
        }
    }


    /**
     * Обрабатывает блок транзанкции
     * Очень важно тщательно протестировать этот метод
     * A little callback hell
     * @param {Transaction} blockData
     * @param block
     * @param callback
     */
    handleTransaction(blockData, block, callback) {
        const that = this;
        if(blockData.amount <= 0) {
            logger.error('Negative or zero amount in block ' + block.index);
            callback();
            return false;
        }

        if(blockData.from === blockData.to && !that.isKeyFromKeyring(blockData.pubkey) && block.index >= keyEmissionMaxBlock) { //Пресекаем попытку самоперевода, за исключением эмиссии
            logger.error('Selfie in block ' + block.index);
            callback();
            return false;
        }

        that.wallets.get('transmutex_' + String(blockData.timestamp), function (err, val) {
            if(!err) {
                logger.error('Transaction clone in ' + block.index + '. Mutex: ' + String(blockData.timestamp));
                callback();
                return false;
            } else {
                that.wallets.put('transmutex_' + String(blockData.timestamp), true, function () {


                    let tempTransaction = new Transaction(blockData.from, blockData.to, blockData.amount, blockData.timestamp, blockData.fromTimestamp);
                    let testWallet = new Wallet();
                    try {
                        if(testWallet.verifyData(tempTransaction.data, blockData.sign, blockData.pubkey)) { //Проверка подписи с ключом переданным в сообщении
                            that.wallets.get(blockData.from, function (err, val) {
                                if(!err) {
                                    let fromWallet = JSON.parse(val);
                                    if(testWallet.verifyData(tempTransaction.data, blockData.sign, fromWallet.keysPair.public)) { //Проверка подписи с исходным ключом кошелька

                                        if(
                                            (fromWallet.balance >= blockData.amount && blockData.amount > 0) || //Если баланс отправителя позволяет и это положительная сумма
                                            block.index < keyEmissionMaxBlock || that.isKeyFromKeyring(fromWallet.keysPair.public) //стартовая эмиссия и тестовая эмиссия
                                        ) {
                                            blockData.amount = Math.round(blockData.amount);
                                            if(block.index >= keyEmissionMaxBlock /*&& !that.isKeyFromKeyring(fromWallet.keysPair.public)*/) { //Вычитаем из отправителя, если это не эмиссия
                                                fromWallet.balance -= blockData.amount;
                                            }

                                            that.wallets.get(blockData.to, function (err, val) {
                                                if(!err) {
                                                    let toWallet = JSON.parse(val);
                                                    let delayed = false;

                                                    if(blockData.fromTimestamp <= moment().utc().valueOf()) { //Если транзакция отложенная, и время еще не наступило, то баланс не увеличиваем
                                                        toWallet.balance += Math.round(blockData.amount);
                                                    } else {
                                                        delayed = true;
                                                    }

                                                    that.wallets.put(fromWallet.id, JSON.stringify(fromWallet), function () {
                                                        that.wallets.put(toWallet.id, JSON.stringify(toWallet), function () {

                                                            if(that.wallet.id === fromWallet.id || that.wallet.id === toWallet.id) { //Если один из задействованных кошельков это наш

                                                                if(that.wallet.id === fromWallet.id && !(toWallet.id === fromWallet.id)) { //Если транзанкция была выполнена нами
                                                                    that.log('Info: <<< Transaction to ' + toWallet.id + ' amount ' +
                                                                        formatToken(blockData.amount, that.config.precision) +
                                                                        ((block.index + that.options.acceptCount) > that.maxBlock ? ' (unaccepted)' : '') +
                                                                        (delayed ? ' delayed to ' + moment(blockData.fromTimestamp).format() : '')
                                                                    );
                                                                    that.wallet.balance = fromWallet.balance;
                                                                    that.ourWalletBlocks.outcome.push(block);
                                                                } else {                                                        //Если транзакция пришла нам или выполнена процедура Selfie
                                                                    that.log('Info: >>> Incoming transaction from ' + fromWallet.id + ' amount ' +
                                                                        formatToken(blockData.amount, that.config.precision) +
                                                                        ((block.index + that.options.acceptCount) > that.maxBlock ? ' (unaccepted)' : '') +
                                                                        (delayed ? ' delayed to ' + moment(blockData.fromTimestamp).format() : '')
                                                                    );
                                                                    that.wallet.balance = toWallet.balance;
                                                                    that.ourWalletBlocks.income.push(block);
                                                                }

                                                                that.wallet.update();
                                                            }

                                                            callback();
                                                            return true;
                                                        });
                                                    });

                                                } else {
                                                    logger.error('Recepient not found (' + blockData.to + ') in block ' + block.index);
                                                    callback();
                                                    return false;
                                                }
                                            });

                                        } else {
                                            if(fromWallet.balance >= blockData.amount) {
                                                logger.error('Incorrect transanction in block ' + block.index);
                                            } else {
                                                logger.error('Insufficient funds (Have ' + formatToken(fromWallet.balance, that.config.precision) + '  need ' + formatToken(blockData.amount, that.config.precision) + ' for ' + blockData.from + ') transanction in block ' + block.index);
                                            }

                                            callback();
                                            return false;
                                        }
                                    } else {
                                        logger.error('Fake level 2 transanction in block ' + block.index);
                                        callback();
                                        return false;
                                    }
                                } else {
                                    that.log(blockData);
                                    logger.error('Sender not found (' + blockData.from + ') in block ' + block.index);
                                    callback();
                                    return false;
                                }
                            });
                        } else {
                            logger.error('Fake transaction in block ' + block.index);
                            callback();
                            return false;
                        }
                    } catch (e) {
                        that.log(e);
                        logger.error('Fake transaction in block ' + block.index);
                        callback();
                        return false;
                    }
                });
            }
        });
    }

}

module.exports = BlockHandler;