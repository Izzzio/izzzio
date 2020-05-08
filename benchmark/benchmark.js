/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 EDUCERT - blockchain certificates checker
 */

let DApp = require('../app/DApp');
let BenchmarkBlock = require('./BenchmarkBlock');
const namedStorage = new (require('../modules/NamedInstanceStorage'))();

class App extends DApp {
    init() {
        let that = this;

        const CONFIG = that.config;

        namedStorage.assign(CONFIG.instanceId);

        const TRANSACTIONS_PER_BLOCK = !CONFIG.benchmark || !CONFIG.benchmark.transactionsPerBlock ? 2500 : CONFIG.benchmark.transactionsPerBlock;

        /**
         * Makes simple transaction string
         * Ethereum ETH transfer trasnaction
         * @return {string}
         */
        function makeBinaryTransaction() {
            return "915b3779593a7c124b932063789297293f13625429d5527caa78f1946a409fa6acaf14a0a4a0274b37e11d6009f8281ac42992c5133bb17d25aae5bde0599dbd96face29ba1d671502a923754";
        }

        /**
         * Makes pack of transactions
         */
        function makeTransactionsList() {
            let list = [];
            for (let i = 0; i < TRANSACTIONS_PER_BLOCK; i++) {
                list.push(makeBinaryTransaction());
            }

            return list;
        }

        const TRANSACTION_LIST = makeTransactionsList();

        let newBLock = new BenchmarkBlock(TRANSACTION_LIST, namedStorage);

        /**
         * Creates new block
         * @param cb
         */
        function addNewBlock(cb) {


            that.generateAndAddBlock(newBLock, function blockGenerated(generatedBlock) {
                cb();
            });
        }

        console.log('iZ³ Speed Benchmark loaded');
        console.log();
        console.log('Benchmark configuration: ');
        console.log('TX per block: ' + TRANSACTIONS_PER_BLOCK);
        console.log();

        console.log('Starting in 10 seconds...');
        console.log();

        let blockCounter = 0;

        let lastTime = new Date();
        let lastBlocks = 0;

        let recordBlocks = 0;

        setTimeout(function () {
            function addBlock() {
                addNewBlock(function () {
                    blockCounter++;
                    setTimeout(function () {
                        addBlock();
                    }, 1);

                });
            }

            addBlock();

            setInterval(function () {

                let time = (new Date()).getTime() - lastTime.getTime();
                let blocks = blockCounter - lastBlocks;

                let blocksSec = (blocks / time) * 1000;

                console.log('\x1Bc');
                console.log('iZ³ Speed Benchmark');
                console.log();
                console.log('Benchmark: Perfomance: Generated blocks:  ' + blockCounter + ' Transactions: ' + (blockCounter * TRANSACTIONS_PER_BLOCK));
                console.log('Benchmark: Perfomance: Blocks per second: ' + (blocksSec) + ' TX per second: ' + (blocksSec * TRANSACTIONS_PER_BLOCK));
                console.log('Benchmark: Perfomance: Blocks max:     ' + (recordBlocks) + ' TX max: ' + (recordBlocks * TRANSACTIONS_PER_BLOCK));
                console.log();

                if(blocksSec > recordBlocks) {
                    recordBlocks = blocksSec;
                }

                lastTime = new Date();
                lastBlocks = blockCounter;
            }, 1000);

        }, 10000);


        process.on('SIGINT', () => {
            console.log('Terminating benchmark...');
            process.exit();
        });

    }
}

module.exports = App;