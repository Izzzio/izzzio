/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const express = require("express");
const Wallet = require("./wallet");
const storj = require('./instanceStorage');
const utils = require('./utils');

/**
 * Wallet and RPC interface
 *
 */
class Frontend {
    constructor(wallet, blockchain, transactor, blockHandler, app, blockchainObject, options, getLastBlock, getSomeInfo, transact, hardResync) {
        let that = this;
        this.app = app;
        this.wallet = wallet;
        this.blockchain = blockchain;
        this.transactor = transactor;
        this.getLastBlock = getLastBlock;
        this.getSomeInfo = getSomeInfo;
        this.blockHandler = blockHandler;
        this.transact = transact;
        this.hardResync = hardResync;
        this.options = options;
        this.blockchainObject = blockchainObject;

        app.use(express.static('frontend'));
        //app.get('/', this.index);
        app.get('/getInfo', function (req, res) {
            that.getInfo(req, res)
        });
        app.get('/getTransactions', function (req, res) {
            that.getTransactions(req, res)
        });

        app.get('/getWalletInfo/:id', function (req, res) {
            that.getWalletInfo(req, res)
        });

        app.get('/isReadyForTransaction', function (req, res) {
            that.isReadyForTransaction(req, res)
        });

        app.post('/createTransaction', function (req, res) {
            that.createTransaction(req, res)
        });

        app.post('/instantTransaction', function (req, res) {
            that.instantTransaction(req, res)
        });

        app.post('/createWallet', function (req, res) {
            that.createWallet(req, res)
        });

        app.post('/instantCreateWallet', function (req, res) {
            that.instantCreateWallet(req, res)
        });

        app.post('/resyncBlockchain', function (req, res) {
            that.resyncBlockchain(req, res)
        });

        app.post('/resyncAll', function (req, res) {
            that.resyncAll(req, res)
        });

        app.get('/downloadWallet', function (req, res) {
            that.downloadWallet(req, res)
        });

        app.post('/restoreWallet', function (req, res) {
            that.restoreWallet(req, res)
        });

        app.post('/changeWallet', function (req, res) {
            that.restoreWallet(req, res)
        });


        that.registerMessages();

        storj.put('httpServer', app);

    }

    registerMessages() {
        let that = this;
        utils.waitForSync(function () {
            const dispatcher = storj.get('messagesDispatcher');
            dispatcher.registerMessageHandler('getWalletInfo', function (message) {
                that.blockHandler.getWallet(message.data.id, function (wallet) {
                    dispatcher.broadcastMessage({
                        walletInfo: JSON.parse(wallet),
                        wallet: message.data.id,
                        mutex: message.mutex
                    }, 'getWalletInfo' + dispatcher.RESPONSE_SUFFIX, message.recepient);

                });
            });

        });
    }

    index(req, res) {
        res.send('Shalom');
    }

    getInfo(req, res) {
        let that = this;
        let data = {
            balance: that.wallet.balance,
            address: that.wallet.getAddress(false),
            tiny: that.wallet.getAddress(true)
        };

        that.getSomeInfo(function (miners, minerForce, peers) {
            that.getLastBlock(function (block, maxBlock) {
                data.block = block;
                data.maxBlock = maxBlock;
                data.miners = miners;
                data.minerForce = minerForce;
                data.peers = peers;
                data.syncInProgress = that.blockHandler.syncInProgress;
                data.recivingBlocks = storj.get('chainResponseMutex');
                data.isReadyForTransaction = that.blockchainObject.isReadyForTransaction();
                data.options = that.options;
                let wallet = JSON.parse(JSON.stringify(that.wallet));
                delete wallet.keysPair;
                data.wallet = wallet;
                res.send(data);
            });
        });

    }

    isReadyForTransaction(req, res) {
        let that = this;
        res.send(JSON.stringify(that.blockchainObject.isReadyForTransaction()));
    }

    getTransactions(req, res) {
        let that = this;

        utils.waitForSync(function () {
            res.send(that.blockHandler.ourWalletBlocks);
        });

    }

    getWalletInfo(req, res) {
        let that = this;

        utils.waitForSync(function () {

            that.blockHandler.getWallet(req.params.id, function (wallet) {
                res.send(JSON.parse(wallet));
            });
        });


    }

    createWallet(req, res) {
        let that = this;
        that.blockchainObject.createNewWallet(function (wallet) {
            wallet.status = 'ok';
            res.send(wallet);
        });

    }

    instantCreateWallet(req, res) {
        let that = this;

        utils.waitForSync(function () {
            that.blockchainObject.createNewWallet(function (wallet) {
                wallet.status = 'ok';
                res.send(wallet);
            }, true);
        });

    }

    createTransaction(req, res) {
        let that = this;

        utils.waitForSync(function () {
            if(!that.transact(req.body.id, Number(req.body.amount), Number(req.body.fromTimestamp), function (block) {
                res.send(block);
            })) {
                res.send('false');
            }
        });


    }


    resyncBlockchain(req, res) {
        let that = this;
        that.blockHandler.resync();
        res.send({status: 'ok'});
    }

    downloadWallet(req, res) {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="wallet.json"'
        });
        res.write(JSON.stringify(this.wallet));

        res.end();
    }

    resyncAll(req, res) {
        let that = this;
        that.hardResync();
        res.send();
    }

    restoreWallet(req, res) {
        let that = this;

        utils.waitForSync(function () {
            that.wallet.keysPair.public = req.body.public;
            that.wallet.keysPair.private = req.body.private;
            that.wallet.id = req.body.id;
            that.wallet.block = Number(req.body.block);
            that.wallet.balance = Number(req.body.balance);
            that.wallet.update();

            if(that.wallet.selfValidate()) {
                setTimeout(function () {
                    that.blockHandler.resync(function () {
                        res.send({status: 'ok'});
                    });
                }, 1000);
            } else {
                res.send({status: 'error', message: 'Incorrect wallet or keypair'});
            }
        });


    }

    instantTransaction(req, res) {
        let that = this;

        utils.waitForSync(function () {
            /**
             *
             * @type {Wallet}
             */
            let wallet = new Wallet();

            wallet.enableLogging = false;
            wallet.block = 0;
            wallet.balance = 1000000000000000;
            wallet.id = req.body.from;

            wallet.keysPair.public = req.body.public;
            wallet.keysPair.private = req.body.private;

            wallet.transanctions = [];

            if(!wallet.transact(req.body.id, Number(req.body.amount), Number(req.body.fromTimestamp))) {
                //return false;
            }

            let blockData = wallet.transanctions.pop();

            that.blockchainObject.transactor.transact(blockData, function (blockData, cb) {
                that.blockchainObject.generateNextBlockAuto(blockData, function (generatedBlock) {
                    that.blockchainObject.addBlock(generatedBlock);
                    that.blockchainObject.broadcastLastBlock();
                    cb(generatedBlock);
                });
            }, function (generatedBlock) {
                res.send(generatedBlock);
            });
        });


    }

}

module.exports = Frontend;
