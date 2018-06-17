/**
 iZ³ | Izzzio blockchain - https://izzz.io
 BitCoen project - https://bitcoen.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

'use strict';

/**
 * Blockchain constructor
 * @param {object} config
 * @constructor
 */
function Blockchain(config) {

    const logger = new (require('./modules/logger'))();

    let blockchainObject = null;

    const fs = require('fs-extra');
    const getid = require('./modules/getid');

    const genesisTiemstamp = config.genesisTiemstamp;

    const CryptoJS = require("crypto-js");
    const express = require("express");
    const auth = require('http-auth');
    const bodyParser = require('body-parser');
    const WebSocket = require("ws");
    const levelup = require('level');
    const Sync = require('sync');
    const moment = require('moment');
    const url = require('url');


    const Block = require('./modules/block');
    const Signable = require('./modules/blocks/signable');
    const Wallet = require('./modules/wallet');
    const BlockHandler = require('./modules/blockHandler');
    const Transactor = require('./modules/transactor');
    const Frontend = require('./modules/frontend');
    const app = express();

    const storj = require('./modules/instanceStorage');
    storj.put('app', app);
    storj.put('config', config);

    const blockController = new (require('./modules/blockchain'))();


    const basic = auth.basic({
            realm: "RPC Auth"
        }, (username, password, callback) => {
            if(config.rpcPassword.length === 0) {
                callback(true);
                return;
            }
            callback(password === config.rpcPassword);
        }
    );

    if(config.rpcPassword.length !== 0) {
        app.use(auth.connect(basic));
    }

    app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
        extended: false
    }));

    app.use(bodyParser.json());


    console.log('Initialize...');
    console.log('');
    console.log('Message bus address: ' + config.recieverAddress);
    console.log('');


    let wallet = Wallet(config.walletFile, config).init();
    storj.put('wallet', wallet);
    logger.info('Wallet address ' + wallet.getAddress(false));
    if(wallet.block !== -1) {
        logger.info('Tiny address ' + wallet.getAddress(true));
        wallet.block = -1;
    }
    console.log('');

    /**
     * База данных блоков
     */
        // let blockchain = levelup(config.workDir + '/blocks');
    let blockchain = blockController;
    storj.put('blocks', blockchain);


    /**
     * Типы сообщений в p2p сети
     * @type {{QUERY_LATEST: number, QUERY_ALL: number, RESPONSE_BLOCKCHAIN: number, MY_PEERS: number, BROADCAST: number}}
     */
    const MessageType = {
        QUERY_LATEST: 0,
        QUERY_ALL: 1,
        RESPONSE_BLOCKCHAIN: 2,
        MY_PEERS: 3,
        BROADCAST: 4
    };

    let maxBlock = -1;
    let lastKnownBlock = -1;
    let peers = config.initialPeers;
    let peersBlackList = [];
    let lastMsgIndex = 0;
    let messagesHandlers = [];

    /**
     * Модуль, работающий с блоками разных типов
     * @type {BlockHandler}
     */
    const blockHandler = new BlockHandler(wallet, blockchain, blockchainObject, config, {acceptCount: config.blockAcceptCount});
    storj.put('blockHandler', blockHandler);

    /**
     * Модуль, следящий за прохождением транзакций
     * @type {Transactor}
     */
    const transactor = new Transactor(wallet, blockchain, {
        acceptCount: config.blockAcceptCount,
        blockHandler: blockHandler
    }, blockchainObject);
    storj.put('transactor', transactor);

    /**
     * Фронтенд с интерфейсом и RPC
     * @type {Frontend}
     */
    const frontend = new Frontend(
        wallet,
        blockchain,
        transactor,
        blockHandler,
        app,
        blockchainObject,
        {
            blocksToAccept: config.blockAcceptCount,
            genesisTiemstamp: genesisTiemstamp,
            precision: config.precision
        },

        /**
         * Позволяет фронтенду получить инфу о последнем блоке
         * @param {Function} cb
         */
        function getLastBlock(cb) {
            getLatestBlock(function (lastestBlock) {
                cb(lastestBlock, lastKnownBlock);
            });
        },

        /**
         * Просто передаёт всякую информацию во фронтенд
         * @param {Function} cb
         */
        function getSomeInfo(cb) {
            cb(miningNow, miningForce, getCurrentPeers());
        },

        /**
         * Запускает выполнение транзакции перевода
         * @param {string} reciever
         * @param {float} amount
         * @param {function} transactCallback
         * @return {boolean}
         */
        function transact(reciever, amount, fromTimestamp, transactCallback) {
            wallet.transanctions = [];
            if(!wallet.transact(reciever, amount, fromTimestamp)) {
                return false;
            }
            let blockData = wallet.transanctions.pop();

            transactor.transact(blockData, function (blockData, cb) {
                generateNextBlockAuto(blockData, function (generatedBlock) {
                    addBlock(generatedBlock);
                    broadcastLastBlock();
                    cb(generatedBlock);
                    transactCallback(generatedBlock);
                });
            }, function () {
                logger.info('Transaction accepted');
            });

            return true;
        },

        /**
         * Запускает принудительную пересинхронизацию сети
         */
        function hardResync() {
            //Hard resync
            logger.warning('Hard synchronization started!');
            blockchain.close(function () {
                fs.removeSync(config.workDir + '/blocks');
                blockchain = levelup(config.workDir + '/blocks');

                blockHandler.clearDb(function () {
                    maxBlock = -1;
                    addBlockToChain(getGenesisBlock());
                    process.exit();
                });


            });
        }
    );
    blockHandler.transactor = transactor;
    blockHandler.frontend = frontend;

    storj.put('frontend', frontend);

    const sockets = [];

    let miningNow = 0;
    let miningForce = '';

    /**
     * Порождающий блок
     * @returns {Block}
     */
    function getGenesisBlock() {
        let data = "New epoch begins here! *solemn music on the background* *loud applause*";
        let hash = calculateHash(0, 0, genesisTiemstamp, data);
        let genesisBlock = new Block(0, "0", genesisTiemstamp, data, hash, genesisTiemstamp, '');
        if(Math.round(new Date().getTime()) <= genesisTiemstamp) {
            logger.error('Whoops! Check the clock');
            process.exit();
        }
        return genesisBlock
    }

    /**
     * Добавляет блок в определенное место цепочки
     * @param index
     * @param block
     * @param {Boolean} noHandle
     * @param cb
     */
    function addBlockToChainIndex(index, block, noHandle, cb) {
        if(block.index > maxBlock) {
            maxBlock = block.index;
            blockchain.put('maxBlock', maxBlock);
        }
        blockHandler.changeMaxBlock(maxBlock);
        transactor.changeMaxBlock(maxBlock);
        blockchain.put(Number(index), JSON.stringify(block));
        if(!noHandle) {
            blockHandler.handleBlock(block, cb);
        } else {
            if(cb) {
                cb();
            }
        }
    }


    /**
     * Добавляет блок в конец цепочки
     * @param block
     * @param {Boolean} noHandle
     */
    function addBlockToChain(block, noHandle) {
        if(block.index > maxBlock) {
            maxBlock = block.index;
            blockchain.put('maxBlock', maxBlock);
        }

        if(!noHandle) {
            noHandle = false;
        }

        addBlockToChainIndex(maxBlock, block, noHandle);
    }

//Врапперы для модуля Sync, а то он любит портить this объекта
    function exBlockhainGet(index, callback) {
        blockchain.get(index, callback);
    }

    function exBlockHandler(result, callback) {
        blockHandler.handleBlock(JSON.parse(result), callback)
    }

    /**
     * Запуск ноды
     */
    function startNode(cb) {
        //Запуск новой цепочки
        blockchain.get(0, function (err, value) {
            if(err) {
                let genesisBlock = getGenesisBlock();
                if(!config.validators[0].isValidHash(genesisBlock.hash)) {
                    logger.error('Invalid genesis hash: ' + genesisBlock.hash);
                    process.exit();
                }
                addBlockToChain(getGenesisBlock());
                logger.info('New blockchain fork started');
                setTimeout(startBlockchainServers, 1000);
                cb();
            } else {
                logger.info('Loading saved chain...');
                blockchain.get('maxBlock', function (err, value) {
                    if(err) {
                        logger.error('Database failure. Reapir or resync database!');
                        return;
                    }
                    maxBlock = Number(value);
                    lastKnownBlock = maxBlock;
                    logger.info('Block count: ' + maxBlock);
                    blockHandler.changeMaxBlock(maxBlock);
                    transactor.changeMaxBlock(maxBlock);
                    blockHandler.enableLogging = false;
                    wallet.enableLogging = false;

                    if(config.program.fastLoad) {
                        blockHandler.enableLogging = true;
                        wallet.enableLogging = true;
                        wallet.update();
                        setTimeout(startBlockchainServers, 1000);
                        logger.info('Blocks database opened');
                        cb();
                    } else {

                        blockHandler.playBlockchain(0, function () {
                            logger.info('Blocks loaded!\n');
                            blockHandler.enableLogging = true;
                            wallet.enableLogging = true;
                            wallet.update();
                            setTimeout(startBlockchainServers, 1000);
                            cb();
                        });
                    }

                });
            }
        });

    }


    /**
     * Запуск сервера интерфейса
     */
    function initHttpServer() {
        app.get('/blocks', (req, res) => {
            Sync(function () {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Content-Disposition': 'attachment; filename="blockchain.json"'
                });
                res.write('[');
                for (let i = 0; i < maxBlock + 1; i++) {
                    let result;
                    try {
                        result = exBlockhainGet.sync(null, i);
                    } catch (e) {
                        continue;
                    }
                    res.write(JSON.stringify(result) + ',');
                }
                res.write(']');
                res.end();
            });
        });

        app.get('/peers', (req, res) => {
            res.send(getCurrentPeers());
        });
        app.post('/addPeer', (req, res) => {
            connectToPeers([req.body.peer]);
            res.send();
        });

        app.get('/broadcastPeers', (req, res) => {
            broadcastConnectedPeers();
            res.send('');
        });

        let server = app.listen(config.httpPort, config.httpServer, () => logger.init('Listening http on: ' + config.httpServer + ':' + config.httpPort + '@' + config.rpcPassword));
        server.timeout = 0;
    }


    /**
     * Запуск P2P сервера
     */
    function initP2PServer() {

        let wss = null;
        if(config.sslMode) {
            const https = require('https');
            const server = https.createServer().listen(config.p2pPort);
            wss = new WebSocket.Server({server});
            console.log("\n!!!Warning: Node running in SSL mode. This mode can be used only by public nodes with correct certeficate.\n")
        } else {
            wss = new WebSocket.Server({port: config.p2pPort, perMessageDeflate: false});
        }

        wss.on('connection', function (ws) {
            if(config.program.verbose) {
                logger.info('Input connection ' + ws._socket.remoteAddress);
            }
            initConnection(ws)
        });
        logger.init('Listening p2p port on: ' + config.p2pPort);

    }

    let connections = 0;

    /**
     * Инициализация p2p соединения
     * @param ws
     */
    function initConnection(ws) {

        if(peersBlackList.indexOf(ws._socket.remoteAddress) !== -1) {
            if(config.program.verbose) {
                logger.info('Blacklisted peer ' + ws._socket.remoteAddress);
            }
            ws.close();
            return;
        }


        for (let i in sockets) {
            if(sockets.hasOwnProperty(i)) {
                if(sockets[i]._socket.remoteAddress === ws._socket.remoteAddress && sockets[i].readyState === 1 && !sockets[i]._isServer) {
                    //TODO: Modify double connection handler
                    /* if(config.program.verbose) {
                         logger.info('Dublicated peer ' + ws._socket.remoteAddress);
                     }
                     ws.close();
                     return;*/
                }

                if(sockets[i].readyState !== 1) {
                    if(config.program.verbose) {
                        logger.info('Connection Not ready. Peer ' + ws._socket.remoteAddress);
                    }
                    ws.close();
                    return;
                }
            }
        }

        p2pErrorHandler(ws);
        sockets.push(ws);
        initMessageHandler(ws);
        write(ws, queryChainLengthMsg());
        write(ws, queryChainLengthMsg());
        sendAllBlockchain(ws, maxBlock - 1);

        /*write(ws, createMessage({
            address: config.recieverAddress,
            version: '1.0'
        }, config.recieverAddress, config.recieverAddress, 'VITAMIN_META', lastMsgIndex, config.TTL + 1));*/
    }

    /**
     * Обработчик сообщений P2P
     * @param ws
     */
    function initMessageHandler(ws) {
        ws.on('message', (data) => {
            if(data.length > config.maximumInputSize) {
                data = null;
                return;
            }

            let message;
            try {
                message = JSON.parse(data);
            } catch (e) {
                logger.error('' + e)
            }

            //console.log(message);

            switch (message.type) {
                case MessageType.QUERY_LATEST:
                    responseLatestMsg(function (msg) {
                        write(ws, msg);
                    });
                    break;
                case MessageType.QUERY_ALL:
                    sendAllBlockchain(ws, message.data, message.limit);
                    break;
                case MessageType.RESPONSE_BLOCKCHAIN:
                    handleBlockchainResponse(message);
                    break;
                case MessageType.MY_PEERS:
                    connectToPeers(message.data);
                    break;
                case  MessageType.BROADCAST:

                    /**
                     * Проходимся по обработчикам входящих сообщений
                     */
                    for (let a in messagesHandlers) {
                        if(messagesHandlers.hasOwnProperty(a)) {
                            if(messagesHandlers[a].handle(message)) {
                                lastMsgIndex = message.index;
                                break; //Если сообщение обработано, выходим
                            }
                        }
                    }

                    if(message.reciver !== config.recieverAddress && config.enableMessaging && message.TTL <= config.messagingMaxTTL /*&& lastMsgIndex < message.index*/) {
                        if(isNaN(message.TTL)) {
                            message.TTL = 1;
                        }
                        if(typeof message.ttlList === 'undefined') {
                            message.ttlList = [];
                        }
                        message.ttlList.push({TTL: message.TTL, host: config.recieverAddress + ':' + 'NODE'});
                        message.TTL++;
                        broadcast(message, ws._socket.remoteAddress);
                        message.data = '';
                    } else {

                        if(message.id === 'VITAMIN_META' && message.reciver !== config.recieverAddress && typeof message.yourIp === 'undefined') {
                            message.yourIp = ws._socket.remoteAddress;
                            message.modifer = 'iZ3 node ' + config.recieverAddress;
                            message.TTL++;
                            //broadcast(message);
                        } else if(message.reciver === config.recieverAddress && message.id === 'VITAMIN_META' && typeof message.yourIp !== 'undefined') {
                            if(peersBlackList.indexOf(message.yourIp) === -1 && config.blacklisting) {
                                logger.info('Add ip to blacklist ' + message.yourIp);
                                peersBlackList.push(message.yourIp);
                            }
                        } else {
                            /* if(lastMsgIndex >= message.index) {
                                 console.log(message);
                             }*/
                        }
                    }
                    lastMsgIndex = message.index;
                    break;
            }
        });
    }

    /**
     * Добавляет обработчик сообщения
     * @param {string} id
     * @param {Function} handler
     */
    function registerMessageHandler(id, handler) {
        messagesHandlers.push({id: id, handle: handler});
    }

    /**
     * Собирает из базы всю цепь блоков и отправляет её тому, кто запросил
     * @param ws
     * @param fromBlock
     * @param limit
     */
    function sendAllBlockchain(ws, fromBlock, limit) {
        /**
         * Если запрос идет с блока меньше 5, то разрешаем синхронизацию по 1 блоку
         * для корректной обработки блока с выпуском ключей
         * @type {number}
         */
        fromBlock = (typeof fromBlock === 'undefined' ? 0 : Number(fromBlock));
        if(fromBlock < 5) {
            limit = 3;
        }

        getAllChain(fromBlock, limit, function (blockchain) {
            write(ws, responseChainMsg(blockchain));
        });
    }

    /**
     * Собираем всю цепочку воедино
     * @param fromBlock
     * @param limit
     * @param cb
     */
    function getAllChain(fromBlock, limit, cb) {
        limit = typeof limit === 'undefined' ? maxBlock : fromBlock + limit;
        let blockchain = [];
        Sync(function () {
            let limiter = 0;
            for (let i = fromBlock; i < limit + 1; i++) {
                let result;
                try {
                    result = exBlockhainGet.sync(null, i);
                } catch (e) {
                    continue;
                }
                blockchain.push(JSON.parse(result));
                limiter++;
                if(limiter > config.maxBlockSend) {
                    break;
                }
            }

            cb(blockchain);
        });
    }

    /**
     * Отлов ошибок сети
     * @param ws
     */
    function p2pErrorHandler(ws) {
        let closeConnection = (ws) => {
            sockets.splice(sockets.indexOf(ws), 1);
            ws.close();
        };
        ws.on('close', () => closeConnection(ws));
        ws.on('error', () => closeConnection(ws));
    }


    /**
     * Считает хеш для объекта блока
     * @param block
     * @returns {*|string|a}
     */
    function calculateHashForBlock(block) {
        return calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.startTimestamp, '');
    }

    /**
     * Хеш блоков
     * @param index
     * @param previousHash
     * @param timestamp
     * @param startTimestamp
     * @param sign
     * @param data
     * @returns {*|string|a}
     */
    function calculateHash(index, previousHash, timestamp, data, startTimestamp, sign) {
        return CryptoJS.SHA256(String(index) + previousHash + String(timestamp) + String(startTimestamp) + String(sign) + JSON.stringify(data)).toString();
    }

    /**
     * Добавляет блок в цепочку с проверкой
     * @param newBlock
     */
    function addBlock(newBlock) {
        getLatestBlock(function (lastestBlock) {
            if(isValidNewBlock(newBlock, lastestBlock)) {
                addBlockToChain(newBlock, function (err) {
                    console.log(err);
                });
            }
        });

    }


    /**
     * Проверка нового блока на соответствие требованиям
     * @param {Block} newBlock
     * @param {Block} previousBlock
     * @returns {boolean}
     */
    function isValidNewBlock(newBlock, previousBlock) {

        let validatorReversed = config.validators;
        /**
         * Модули консенсусов изначально расположены в порядке повышения приоритета.
         * Выбор консенсуса должен идти в порядке убывания приоритета
         */
        validatorReversed.reverse();

        try {
            for (let a in validatorReversed) {
                if(validatorReversed.hasOwnProperty(a)) {
                    if(validatorReversed[a].isValidNewBlock(newBlock, previousBlock)) {
                        validatorReversed.reverse();
                        return true;
                    }
                }
            }
        } catch (e) {
            validatorReversed.reverse();
            throw e;
        }
        validatorReversed.reverse();
        return false;
    }


    /**
     * Подключаемся к пирам
     * @param newPeers
     */
    function connectToPeers(newPeers) {
        let peers = getCurrentPeers();

        if(peers.length >= config.maxPeers) {
            return;
        }
        newPeers = newPeers.filter((v, i, a) => a.indexOf(v) === i);

        newPeers.forEach((peer) => {
            if(peers.indexOf(peer) !== -1) {
                return;
            }

            try {
                if(peersBlackList.indexOf(url.parse(peer).hostname) !== -1) {
                    return;
                }

                let ws = new WebSocket(peer, {perMessageDeflate: false});
                ws.on('open', function () {
                    initConnection(ws);
                });
                ws.on('error', (error) => {
                    ws.close();
                });
            } catch (e) {
            }
        });
    }

    /**
     * Получили новую цепочку блоков
     * @param message
     */
    function handleBlockchainResponse(message) {

        //We can't handle new blockchain while sync in progress
        if(blockHandler.syncInProgress) {
            return;
        }

        let receivedBlocks = JSON.parse(message.data);

        if(receivedBlocks.length == 0 || receivedBlocks[0] === false) {
            return;
        }

        receivedBlocks = receivedBlocks.sort((b1, b2) => (b1.index - b2.index));
        /**
         * @type {Block}
         */
        const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];

        getLatestBlock(function (latestBlockHeld) {
            if(!latestBlockHeld) {
                if(config.program.autofix) {
                    maxBlock--;
                    logger.autofix('Reset blockchain height to ' + (maxBlock));
                } else {
                    logger.error('Can\'t receive last block. Maybe database busy?');
                }
                return;
            }

            try {
                if(latestBlockReceived.timestamp > moment().utc().valueOf() + 60000) {
                    if(config.program.verbose) {
                        logger.error('Incorrect received block timestamp or local time ' + latestBlockReceived.timestamp + ' current ' + moment().utc().valueOf());
                    }
                    return;
                }
                if(latestBlockReceived.index > latestBlockHeld.index || (blockHandler.keyring.length === 0 && latestBlockReceived.index < 5 && latestBlockReceived.index !== 0)) {
                    lastKnownBlock = latestBlockReceived.index;
                    logger.info('Synchronize: ' + latestBlockHeld.index + ' of ' + latestBlockReceived.index);
                    if(latestBlockHeld.hash === latestBlockReceived.previousHash && latestBlockHeld.index > 5) { //когда получен один блок от того который у нас есть

                        if(isValidChain(receivedBlocks) && (receivedBlocks[0].index <= maxBlock || receivedBlocks.length === 1)) {
                            addBlockToChain(latestBlockReceived);
                            responseLatestMsg(function (msg) {
                                broadcast(msg);
                            });
                        }

                    } else if(receivedBlocks.length === 1) {

                        let getBlockFrom = latestBlockHeld.index - config.blockQualityCheck;
                        if(getBlockFrom < 0) {
                            getBlockFrom = maxBlock;
                            lastKnownBlock = maxBlock;
                        }
                        if(!blockHandler.syncInProgress) {
                            broadcast(queryAllMsg(getBlockFrom));
                        }

                    } else {
                        if(receivedBlocks[0].index <= maxBlock && receivedBlocks.length > 1) {
                            replaceChain(receivedBlocks);
                        }
                    }
                } else {
                    //console.log('received blockchain is not longer than received blockchain. Do nothing');
                }
            } catch (e) {
                logger.info('Received chain corrupted error');
            }
        });

    }

    let replaceChainTimer = null;

    /**
     * Производим замену цепочки на обновлённую
     * @param {Block[]} newBlocks
     */
    function replaceChain(newBlocks) {

        let maxIndex = maxBlock - config.limitedConfidenceBlockZone;
        if(maxIndex < 0) {
            maxIndex = 0;
        }

        if(
            isValidChain(newBlocks) &&
            (newBlocks[0].index >= maxIndex) //ограничение доверия принимаемой цепочки блоков
        /*&& newBlocks.length >= maxBlock*/
        ) {
            //console.log(newBlocks);
            logger.info('Received blockchain is valid.');
            Sync(function () {
                for (let i of newBlocks) {
                    addBlockToChainIndex.sync(null, i.index, i, true);
                }
                responseLatestMsg(function (msg) {
                    broadcast(msg);
                });

                clearInterval(replaceChainTimer);
                replaceChainTimer = setTimeout(function () {
                    blockHandler.resync();
                }, config.peerExchangeInterval + 1000);

            });

        } else {
            logger.error('Received blockchain corrupted');
        }
    }

    /**
     * Проверяет корректность цепочки
     * @param {Array} blockchainToValidate
     * @returns {boolean}
     */
    function isValidChain(blockchainToValidate) {
        /*if(JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(getGenesisBlock())) {
         return false;
         }*/
        try {
            const tempBlocks = [blockchainToValidate[0]];
            for (let i = 1; i < blockchainToValidate.length; i++) {
                if(isValidNewBlock(blockchainToValidate[i], tempBlocks[i - 1])) {
                    try {
                        tempBlocks.push(blockchainToValidate[i]);
                    } catch (e) {
                        console.log(e);
                        return false;
                    }
                } else {
                    return false;
                }
            }
        } catch (e) {
            console.log(e);
            return false;
        }
        return true;
    }

    /**
     * Получаем последний загруженный блок цепочки
     * @param callback
     */
    function getLatestBlock(callback) {
        blockchain.get(maxBlock, function (err, val) {
            if(!err) {
                callback(JSON.parse(val));
            } else {
                callback(false);
            }
        });
    }

    /**
     * Запрос последнего блока цепочки
     * @returns {{type: number}}
     */
    function queryChainLengthMsg() {
        return {'type': MessageType.QUERY_LATEST}
    }

    /**
     * Запрос всех блоков цепочки
     * @returns {{type: number}}
     */
    function queryAllMsg(fromIndex) {
        return {'type': MessageType.QUERY_ALL, data: typeof fromIndex === 'undefined' ? 0 : fromIndex}
    }

    /**
     * Ответ всего блока цепочки
     * @param blockchain
     * @returns {{type: number, data}}
     */
    function responseChainMsg(blockchain) {
        return {
            'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(blockchain)
        }
    }

    /**
     * Ответ последнего блока цепочки
     * @param callback
     */
    function responseLatestMsg(callback) {
        getLatestBlock(function (block) {
            callback({
                'type': MessageType.RESPONSE_BLOCKCHAIN,
                'data': JSON.stringify([block])
            })
        });
    }

    /**
     * Сообщение со списком пиров
     * @param peers
     * @returns {{type: number, data: *}}
     */
    function peersBroadcast(peers) {
        return {
            type: MessageType.MY_PEERS, data: peers
        }
    }

    /**
     * Write to socket
     * @param ws
     * @param message
     */
    const write = function (ws, message) {
        try {
            ws.send(JSON.stringify(message))
        } catch (e) { //ошибка записи, возможно сокет уже не активен
            if(config.program.verbose) {
                logger.info('Send error ' + e + ' ' + ws._socket.remoteAddress)
            }
        }
    };

    /**
     * Broadcast message
     * @param message
     * @param excludeIp
     */
    const broadcast = function (message, excludeIp) {
        sockets.forEach(function (socket) {
            if(typeof excludeIp === 'undefined' || socket._socket.recieverAddress !== excludeIp) {
                write(socket, message)
            } else {

            }
        });
    };

    /**
     * Сообщаем всем адреса наших пиров
     */
    function broadcastConnectedPeers() {
        broadcast(peersBroadcast(getCurrentPeers()));
    }

    /**
     * Запуск сети
     */
    function startBlockchainServers() {
        connectToPeers(peers);
        initHttpServer();
        initP2PServer();
        createWalletIfNotExsists();

        if(config.appEntry) {
            console.log("Info: Loading DApp...\n");
            try {
                /**
                 * @var {DApp} clientApplication
                 */
                let clientApplication = new (require(config.appEntry))(config, blockchainObject);
                clientApplication.init();
            } catch (e) {
                console.log("Error: DApp fatal:\n");
                console.log(e);
                process.exit(1);
            }
        }

    }

    /**
     * Формирует список подключенных пиров
     * @returns {Array}
     */
    function getCurrentPeers() {
        return sockets.map(function (s) {
            if(s.readyState === 1) {
                return 'ws://' + s._socket.remoteAddress + ':' + /*s._socket.remotePort*/ config.p2pPort
            }
        }).filter((v, i, a) => a.indexOf(v) === i);
    }


    /**
     * Переодическая рассылка информации о доступных блоках
     */
    function broadcastLastBlock() {
        responseLatestMsg(function (msg) {
            broadcast(msg);
        });
    }


    /**
     * Переодический обмен пирами и переподключение к централньым нодам
     */
    function peerExchange() {
        broadcastConnectedPeers();
        let peersToConnect = getCurrentPeers();
        if(peersToConnect.length < 2) {
            peersToConnect = peers;
        }
        connectToPeers(peersToConnect);
    }


    /**
     * Создает сообщение
     * @param data
     * @param reciver
     * @param recepient
     * @param id
     * @param index
     * @param TTL
     * @return {{type: number, data: *, reciver: *, recepient: *, id: *, timestamp: number, TTL: number, index: number}}
     */
    function createMessage(data, reciver, recepient, id, index, TTL) {
        return {
            type: MessageType.BROADCAST,
            data: data,
            reciver: reciver,
            recepient: recepient,
            id: id,
            timestamp: moment().utc().valueOf(),
            TTL: typeof TTL !== 'undefined' ? TTL : 0, //количество скачков сообщения
            index: index
        };
    }

    /**
     * Рассылает широковещательное сообщение по системе
     * @param {object} msgData содержание сообщения
     * @param {string} id идентефикатор сообщения
     * @param {string} reciver получатель сообщения
     * @param {string} recepient отправитель сообщения
     * @param {int} TTL
     * @return {{type: number, data: *, reciver: *, recepient: *, id: *, timestamp: number, TTL: number, index: number}}
     */
    function broadcastMessage(msgData, id, reciver, recepient, TTL) {
        let message = createMessage(msgData, reciver, recepient, id, lastMsgIndex + 1, TTL);
        broadcast(message);
        return message;
    }


    /**
     * Создаёт кошелёк в блокчейне, если он не создан.
     */
    function createWalletIfNotExsists() {
        if(wallet.accepted) {
            return;
        }
        wallet.create();
        getLatestBlock(function (block) {
            if((!block || moment().utc().valueOf() - block.timestamp > config.generateEmptyBlockDelay) && !config.newNetwork) { //если сеть не синхронизирована то повторяем позже
                setTimeout(function () {
                    createWalletIfNotExsists();
                }, config.emptyBlockInterval * 5);
                return;
            }

            let blockData = wallet.transanctions.pop();
            transactor.transact(blockData, function (blockData, cb) {
                generateNextBlockAuto(blockData, function (generatedBlock) {
                    addBlock(generatedBlock);
                    broadcastLastBlock();
                    cb(generatedBlock);
                    setTimeout(keyringEmission, 10000);
                });
            }, function () {
                // wallet.accepted = true;
                logger.info('Wallet creation accepted');
            });
        });
    }

    /**
     * Creates new Wallet in blockchain
     * @param cb
     */
    function createNewWallet(cb, instant) {
        let wallet = new Wallet();
        wallet.generate();

        if(typeof instant !== 'undefined') {
            transactor.options.acceptCount = 1;
            rotateAddress();
        }

        getLatestBlock(function (block) {
            if((!block || moment().utc().valueOf() - block.timestamp > config.generateEmptyBlockDelay) && !config.newNetwork) { //если сеть не синхронизирована то повторяем позже
                setTimeout(function () {
                    createNewWallet(cb);
                }, config.emptyBlockInterval);
                return;
            }

            let blockData = wallet.transanctions.pop();
            transactor.transact(blockData, function (blockData, blockCb) {
                generateNextBlockAuto(blockData, function (generatedBlock) {
                    addBlock(generatedBlock);
                    broadcastLastBlock();
                    blockCb(generatedBlock);

                    //cb({id: wallet.id, block: generatedBlock.index, keysPair: wallet.keysPair});
                });
            }, function (generatedBlock) {
                wallet.accepted = true;
                if(typeof instant !== 'undefined') {
                    rotateAddress();
                }
                cb({id: wallet.id, block: generatedBlock.index, keysPair: wallet.keysPair});
            });
        });
    }

    /**
     * Generates new sender address
     */
    function rotateAddress() {
        config.recieverAddress = getid() + getid() + getid();
    }


    /**
     * Создаёт новый блок с помощью подходящего консенсуса
     * @param blockData
     * @param cb
     * @param cancelCondition
     */
    function generateNextBlockAuto(blockData, cb, cancelCondition) {
        if(config.program.enableAddressRotation) {
            rotateAddress();
        }
        let validatorReversed = config.validators;
        /**
         * Модули консенсусов изначально расположены в порядке повышения приоритета.
         * Выбор консенсуса для генерации блока, должен идти в порядке убывания приоритета
         */
        validatorReversed.reverse();
        for (let a in validatorReversed) {
            if(validatorReversed.hasOwnProperty(a)) {
                if(validatorReversed[a].isReady()) {
                    validatorReversed[a].generateNextBlock(blockData, cb, cancelCondition);
                    validatorReversed.reverse();
                    return;
                }
            }
        }

        validatorReversed.reverse();
        return false;
    }


//**************************************************************************


    /**
     * Запускается всего один раз при старте цепочки, при условии, что кошелек утверждён
     */

    function keyringEmission() {
        if(
            maxBlock <= 5 &&
            maxBlock !== -1 &&
            //wallet.accepted &&
            miningNow === 0 &&
            blockHandler.keyring.length === 0 && config.newNetwork
        ) {
            logger.info('Starting keyring emission');

            let keyring = new (require('./modules/blocks/keyring'))([], wallet.id);
            keyring.generateKeys(config.workDir + '/keyringKeys.json', 100, wallet);
            transactor.transact(keyring, function (blockData, cb) {
                config.validators[0].generateNextBlock(blockData, function (generatedBlock) {
                    addBlock(generatedBlock);
                    broadcastLastBlock();
                    cb(generatedBlock);
                    setTimeout(coinEmission, 2000);
                });
            }, function () {
                console.log('Keyring: Keyring accepted');
            });
        }
    }

    /**
     * Первичный выпуск монет
     * Заложенно config.initialEmission * precision
     * где precision это максимальная точность при операциях с не дробными монетами
     */
    function coinEmission() {
        if(!blockHandler.isKeyFromKeyring(wallet.keysPair.public)) {
            return;
        }

        logger.info('Starting coin emission ' + (config.initialEmission));

        wallet.transanctions = [];
        wallet.transact(wallet.id, config.initialEmission * config.precision, null, true);
        let blockData = wallet.transanctions.pop();

        transactor.transact(blockData, function (blockData, cb) {
            config.validators[0].generateNextBlock(blockData, function (generatedBlock) {
                addBlock(generatedBlock);
                broadcastLastBlock();
                setTimeout(function () {
                    config.validators[0].generateEmptyBlock(true);
                }, 1000);
                cb(generatedBlock);

            });
        }, function () {
            console.log('Emission: Emission accepted');
            blockHandler.resync();
        });
    }


    /**
     * Starts node with config
     */
    function start() {

        if(config.validators.length === 0) {
            throw ('Error: No consensus validators loaded!');
        }

        for (let a in config.validators) {
            if(config.validators.hasOwnProperty(a)) {
                config.validators[a] = new (require('./modules/validators/' + config.validators[a]))(blockchainObject);
            }
        }

        console.log('');
        startNode(function initilized() {
            setInterval(peerExchange, config.peerExchangeInterval);
            setInterval(broadcastLastBlock, config.hearbeatInterval);

            transactor.startWatch(5000);

            process.on('SIGINT', () => {
                console.log('');
                logger.info('Terminating...');
                blockHandler.syncInProgress = true;
                wallet.save();
                config.emptyBlockInterval = 10000000000;
                logger.info('Saving blockchain DB');
                blockchain.close(function () {
                    logger.info('Saving wallets cache');
                    blockHandler.wallets.close(function () {
                        setTimeout(function () {
                            process.exit();
                        }, 2000);
                    });
                });

            });
        });


    }


    blockchainObject = {
        config: config,
        start: start,
        getid: getid,
        write: write,
        getGenesisBlock: getGenesisBlock,
        addBlockToChainIndex: addBlockToChainIndex,
        addBlockToChain: addBlockToChain,
        startNode: startNode,
        initHttpServer: initHttpServer,
        initP2PServer: initP2PServer,
        initConnection: initConnection,
        initMessageHandler: initMessageHandler,
        sendAllBlockchain: sendAllBlockchain,
        getAllChain: getAllChain,
        p2pErrorHandler: p2pErrorHandler,
        generateNextBlockAuto: generateNextBlockAuto,
        calculateHashForBlock: calculateHashForBlock,
        calculateHash: calculateHash,
        addBlock: addBlock,
        //isValidHash: isValidHash,
        isValidNewBlock: isValidNewBlock,
        connectToPeers: connectToPeers,
        handleBlockchainResponse: handleBlockchainResponse,
        replaceChain: replaceChain,
        isValidChain: isValidChain,
        getLatestBlock: getLatestBlock,
        queryChainLengthMsg: queryChainLengthMsg,
        queryAllMsg: queryAllMsg,
        responseChainMsg: responseChainMsg,
        responseLatestMsg: responseLatestMsg,
        peersBroadcast: peersBroadcast,
        broadcast: broadcast,
        broadcastConnectedPeers: broadcastConnectedPeers,
        startBlockchainServers: startBlockchainServers,
        getCurrentPeers: getCurrentPeers,
        broadcastLastBlock: broadcastLastBlock,
        peerExchange: peerExchange,
        createMessage: createMessage,
        broadcastMessage: broadcastMessage,
        createWalletIfNotExsists: createWalletIfNotExsists,
        createNewWallet: createNewWallet,
        keyringEmission: keyringEmission,
        coinEmission: coinEmission,
        genesisTiemstamp: genesisTiemstamp,
        wallet: wallet,
        app: app,
        blockchain: blockchain,
        maxBlock: maxBlock,
        peers: peers,
        peersBlackList: peersBlackList,
        lastMsgIndex: lastMsgIndex,
        blockHandler: blockHandler,
        transactor: transactor,
        frontend: frontend,
        sockets: sockets,
        miningNow: miningNow,
        miningForce: miningForce,
        connections: connections,
        registerMessageHandler: registerMessageHandler,
        setMiningForce: function (miningNowP, miningForceP) {
            miningNow = miningNowP;
            miningForce = miningForceP;
        }

    };
    frontend.blockchainObject = blockchainObject;
    return blockchainObject;
}

module.exports = Blockchain;

//Work



