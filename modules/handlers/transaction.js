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