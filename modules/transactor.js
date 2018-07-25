/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const storj = require('./instanceStorage');
const logger = new (require('./logger'))();


/**
 * Реализация тёщи, которая пилит блок, пока он не будет принят в сеть
 */
class Transactor {
    /**
     *
     * @param {Wallet} wallet
     * @param blockchain
     * @param options
     * @param blockchainObject
     * @param options
     */
    constructor(wallet, blockchain, options, blockchainObject) {

        this.wallet = wallet;
        this.blockchain = blockchain;
        this.blockchainObject = blockchainObject;
        this.options = options;
        this.maxBlock = -1;
        this.enableLogging = true;
        this.transactions = [];

        storj.put('transactor', this);

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
     * Запуск отслеживания
     * @param timeout
     */
    startWatch(timeout) {
        let that = this;

        function watcher() {
            that.watch(function () {
                that.watchTimer = setTimeout(watcher, timeout);
            }, timeout)
        }

        that.watchTimer = setTimeout(watcher, timeout);

    }


    /**
     * Проверка состояния блоков из списка слежения
     */
    watch(cb) {
        let that = this;
        let reactions = 0;
        if(that.transactions.length === 0) {
            return cb();
        }
        //console.log(that.transactions);
        for (let i of that.transactions) {

            //1.0 bug fix. Don't check transaction while sync!
            if(typeof i === 'undefined' || !i.block || !that.blockchainObject.isReadyForTransaction()) {
                continue;
            }
            reactions++;
            that.blockchain.get(i.block.index, function (err, block) {
                if(err) {
                    logger.warning('Transactor: Block ' + i.block.index + ' was rejected.');
                    i.repeats++;
                    if(i.repeats < that.blockchainObject.config.maxTransactionAtempts) {
                        i.generator(i.object, i.watchlist);
                    } else {
                        logger.error('Transactor: Block ' + i.block.index + ' failed.');
                    }
                    return;// cb();
                }
                block = JSON.parse(block);
                if(block.hash !== i.block.hash) {
                    logger.warning('Transactor: Block ' + i.block.index + ' was rejected and replaced.');
                    i.repeats++;
                    if(i.repeats < that.blockchainObject.config.maxTransactionAtempts) {
                        i.generator(i.object, i.watchlist);
                    } else {
                        logger.error('Transactor: Block ' + i.block.index + ' failed.');
                    }
                    return;// cb();
                }

                if((Number(block.index) + Number(that.options.acceptCount)) <= Number(that.maxBlock)) {
                    logger.info('Transactor: Block ' + i.block.index + ' was accepted to network.');
                    if(typeof that.transactions[i.index].accepted !== 'undefined') {
                        that.transactions[i.index].accepted(block);
                    }
                    delete that.transactions[i.index];
                    return;// cb();
                }

                //console.log('Transactor: Block ' + i.block.index + ' still not accepted.');

                // return cb();
            });
        }
        //  if(reactions === 0){
        return cb();
        //  }
    }

    /**
     * Генерация нового блока и добавление его в список слежения
     * @param object
     * @param {Function} generator
     * @param {Function} accepted
     */
    transact(object, generator, accepted) {
        let that = this;
        //console.log('Transactor: Create transaction');

        /*if(!that.blockchainObject.isReadyForTransaction()) {
            return false;
        }*/

        that.transactions.push({object: object, block: null, generator: generator, repeats: 0});
        let index = that.transactions.length - 1;
        logger.info('Transactor: Generating new block');

        let repeats = 0;

        function watchlist(block) {
            if(typeof block === 'undefined') {
                repeats++;
                if(repeats > that.blockchainObject.config.maxTransactionAtempts) {
                    logger.error('Transactor: Block generation failed.');
                    return false;
                }
                logger.warning('Transactor: Can\'t generate new block. Attempt generation again');
                setTimeout(function () {
                    generator(object, watchlist);
                }, 5000);
                return false;
            }
            /**
             * @var {Block} block
             */
            logger.info('Transactor: Block ' + block.index + ' generated. Addes to watch list');
            that.transactions[index].block = block;
            that.transactions[index].watchlist = watchlist;
            that.transactions[index].index = index;
            that.transactions[index].accepted = accepted;
        }

        generator(object, watchlist);
        return true;
    }

}

module.exports = Transactor;