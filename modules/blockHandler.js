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

const levelup = require('level');

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
        fs.removeSync(config.workDir + '/wallets');
        this.wallets = levelup(config.workDir + '/wallets');
        this.options = options;
        this.maxBlock = -1;
        this.enableLogging = true;
        this.ourWalletBlocks = {income: [], outcome: []};
        this.syncInProgress = false;
        this.keyring = [];
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
            console.log(string);
        }
    }

    /**
     * Очищает базу с таблицей кошельков
     * @param cb
     */
    clearDb(cb) {
        let that = this;
        that.wallets.close(function () {
            setTimeout(function () {
                try {
                    fs.removeSync(that.config.workDir + '/wallets');
                    that.wallets = levelup(that.config.workDir + '/wallets');
                } catch (e) {
                    console.log(e);
                }
                cb();
            }, 100);

        });
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

        that.log('Info: Blockchain resynchronization started');
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
        that.enableLogging = false;
        that.wallet.enableLogging = false;
        Sync(function () {
            let prevBlock = null;
            for (let i = fromBlock; i < that.maxBlock + 1; i++) {
                let result;
                try {
                    result = that.exBlockhainGet.sync(that, i);
                    if(prevBlock !== null) {
                        if(JSON.parse(prevBlock).hash !== JSON.parse(result).previousHash) {
                            if(that.config.program.autofix) {
                                console.log('Info: Autofix: Delete chain data after ' + i + ' block');

                                for (let a = i; a < that.maxBlock + 1; a++) {
                                    that.blockchain.del.sync(that.blockchain, a);
                                }

                                console.log('Info: Autofix: Set new blockchain height ' + i);
                                that.blockchain.put.sync(that.blockchain, 'maxBlock', i - 1);
                                that.syncInProgress = false;
                                that.enableLogging = true;
                                that.wallet.enableLogging = true;
                                cb();
                                return;
                                break;
                            } else {
                                console.log(JSON.parse(prevBlock));
                                console.log(JSON.parse(result));
                                console.log('Fatal error: Saved chain corrupted in block ' + i + '. Remove wallets and blocks dirs for resync. Also you can use --autofix');
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
                        console.log('Fatal error: Saved chain corrupted. Remove wallets and blocks dirs for resync. Also you can use --autofix');
                        process.exit(1);
                    }
                    //continue;
                } //No important error. Ignore
                that.exBlockHandler.sync(that, result);
            }

            that.syncInProgress = false;
            that.enableLogging = true;
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
                this.log('Info: Not JSON block ' + block.index);
                return callback();
            }

            // that.log(blockData.type + block.index);

            if(block.index === keyEmissionMaxBlock) {
                if(this.keyring.length === 0) {
                    console.log('Warning: Network without keyring');
                }

                if(this.isKeyFromKeyring(this.wallet.keysPair.public)) {
                    console.log('Warning: THRUSTED NODE. BE CAREFUL.');
                }
            }

            switch (blockData.type) {
                case WalletRegister.prototype.constructor.name:
                    this.handleWalletBlock(blockData, block, callback);
                    break;
                case Transaction.prototype.constructor.name:
                    this.handleTransaction(blockData, block, callback);
                    break;
                case Keyring.prototype.constructor.name:
                    if(block.index >= keyEmissionMaxBlock || this.keyring.length !== 0) {
                        this.log('Warning: Fake keyring in block ' + block.index);
                        return callback();
                    }
                    this.log('Info: Keyring recived in block ' + block.index);
                    this.keyring = blockData.keys;
                    return callback();
                    break;
                /*                case Smart.prototype.constructor.name:
                                    this.handleSmartBlock(blockData, block, callback);
                                    break;*/
                case 'Empty':
                    return callback();
                    break;
                default:
                    this.log('Info: Unexpected block type ' + block.index);
                    return callback();
            }
        } catch (e) {
            console.log(e);
            return callback();
        }
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
                    that.log('Error: Uhm... Wallet recreation? Block: ' + block.index);
                    return callback();
                }
            });


        } else {
            that.log('Error: Incorrect sign in block ' + block.index);
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
            that.log('Error: Negative or zero amount in block ' + block.index);
            return callback();
        }

        if(blockData.from === blockData.to && !that.isKeyFromKeyring(blockData.pubkey) && block.index >= keyEmissionMaxBlock) { //Пресекаем попытку самоперевода, за исключением эмиссии
            that.log('Error: Selfie in block ' + block.index);
            return callback();
        }

        that.wallets.get('transmutex_' + String(blockData.timestamp), function (err, val) {
            if(!err) {
                that.log('Error: Transaction clone in ' + block.index);
                return callback();
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

                                                            return callback();
                                                        });
                                                    });

                                                } else {
                                                    that.log('Error: Recepient not found in block ' + block.index);
                                                    return callback();
                                                }
                                            });

                                        } else {
                                            that.log('Error: Incorrect transanction in block ' + block.index);
                                            return callback();
                                        }
                                    } else {
                                        that.log('Error: Fake level 2 transanction in block ' + block.index);
                                        return callback();
                                    }
                                } else {
                                    that.log(blockData);
                                    that.log('Error: Something strange in block ' + block.index);
                                    return callback();
                                }
                            });
                        } else {
                            that.log('Error: Fake transaction in block ' + block.index);
                            return callback();
                        }
                    } catch (e) {
                        that.log(e);
                        that.log('Error: Fake transaction in block ' + block.index);
                        return callback();
                    }
                });
            }
        });
    }

}

module.exports = BlockHandler;