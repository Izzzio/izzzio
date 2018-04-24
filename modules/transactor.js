const Transaction = require("./blocks/transaction");
const WalletRegister = require("./blocks/walletRegister");

const levelup = require('levelup');
const storj = require('./instanceStorage');


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
            if(typeof i === 'undefined' || !i.block || storj.get('blockHandler').syncInProgress) {
                continue;
            }
            reactions++;
            that.blockchain.get(i.block.index, function (err, block) {
                if(err) {
                    console.log('Transactor: Block ' + i.block.index + ' was rejected.');
                    i.generator(i.object, i.watchlist);
                    return;// cb();
                }
                block = JSON.parse(block);
                if(block.hash !== i.block.hash) {
                    console.log('Transactor: Block ' + i.block.index + ' was rejected and replaced.');
                    i.generator(i.object, i.watchlist);
                    return;// cb();
                }

                if((Number(block.index) + Number(that.options.acceptCount)) <= Number(that.maxBlock)) {
                    console.log('Transactor: Block ' + i.block.index + ' was accepted to network.');
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

        that.transactions.push({object: object, block: null, generator: generator});
        let index = that.transactions.length - 1;
        console.log('Transactor: Generating new block');

        function watchlist(block) {
            if(typeof block === 'undefined') {
                console.log('Transactor: Can\'t generate new block. Attempt generation again');
                setTimeout(function () {
                    generator(object, watchlist);
                }, 5000);
                return false;
            }
            /**
             * @var {Block} block
             */
            console.log('Transactor: Block ' + block.index + ' generated. Addes to watch list');
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