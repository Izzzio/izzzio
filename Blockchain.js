/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

'use strict';

/**
 * Blockchain constructor
 * @param {object} config
 * @constructor
 */
function Blockchain(config) {


    /**
     * Self
     * @type {Blockchain}
     */
    let blockchainObject = null;

    /**
     * Genesis timestamp
     */
    const genesisTiemstamp = config.genesisTiemstamp;

    //Init first
    const logger = new (require('./modules/logger'))();
    const getid = require('./modules/getid');
    const fs = require('fs-extra');
    //Instance storage
    const storj = require('./modules/instanceStorage');

    //Cryptography
    const Cryptography = require('./modules/cryptography');
    const cryptography = new Cryptography(config);
    storj.put('cryptography', cryptography);
    //Crypto
    //const CryptoJS = require("crypto-js");

    //Plugins
    const Plugins = require('./modules/plugins');
    const plugins = new Plugins();
    storj.put('plugins', plugins);

    //Networking
    const express = require("express");
    const auth = require('http-auth');
    const bodyParser = require('body-parser');
    const WebSocket = require("ws");
    const dnssd = require('dnssd');
    let upnpAdvertisment, upnpBrowser;

    //Storages
    const levelup = require('level');

    //Utils
    const moment = require('moment');
    const url = require('url');
    const path = require('path');
    const stableStringify = require('json-stable-stringify');
    const CompareVersions = require('./modules/CompareVersions');

    //Blockchain
    const Block = require('./modules/block');
    const Signable = require('./modules/blocksModels/signable');
    const Wallet = require('./modules/wallet');
    const AccountManager = require('./modules/AccountManager');
    const BlockHandler = require('./modules/blockHandler');
    const Transactor = require('./modules/transactor');
    const MessagesDispatcher = require('./modules/messagesDispatcher');
    const Frontend = require('./modules/frontend');
    const app = express();

    storj.put('app', app);
    storj.put('config', config);

    //load DB plugin
    if(config.dbPlugins.length > 0) {
        logger.info("Loading DB plugins...\n");
        for (let plugin of config.dbPlugins) {
            let res = loadPlugin(plugin, blockchainObject, config, storj);
            if(typeof res === "object") {
                logger.fatal("Plugin fatal:\n");
                console.log(e);
                process.exit(1);
            }
        }
        logger.info("DB plugins loaded");
    }

    //Subsystems
    const blockController = new (require('./modules/blockchain'))();
    const NodeMetaInfo = require('./modules/NodeMetaInfo');
    const StarwaveProtocol = require('./modules/starwaveProtocol');
    let starwave = new StarwaveProtocol(config, blockchainObject);
    const BlockchainInfo = require('./modules/blockchainInfo');
    const blockchainInfo = new BlockchainInfo(blockchainObject);
    let lastBlockInfo = {}; //информация о последнем запрошенном блоке

    const EcmaContract = require('./modules/smartContracts/EcmaContract');


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

    const routes = {};
    const secretKeys = {};

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
    if(config.networkPassword) {
        console.log('Network with password access control');
        console.log('');
    }

    let wallet = Wallet(config.walletFile, config).init();
    storj.put('wallet', wallet);
    if(wallet.id.length !== 0) {
        logger.info('Wallet address ' + wallet.getAddress(false));
        if(wallet.block !== -1) {
            logger.info('Tiny address ' + wallet.getAddress(true));
            wallet.block = -1;
        }
    }
    console.log('');

    let nodeMetaInfo = new NodeMetaInfo(config);

    /**
     * База данных блоков
     */
        // let blockchain = levelup(config.workDir + '/blocks');
    let blockchain = blockController;
    storj.put('blocks', blockchain);


    /**
     * Типы сообщений в p2p сети
     * @type {{QUERY_LATEST: number, QUERY_ALL: number, RESPONSE_BLOCKCHAIN: number, MY_PEERS: number, BROADCAST: number, META: number}}
     */
    const MessageType = {
        QUERY_LATEST: 0,
        QUERY_ALL: 1,
        RESPONSE_BLOCKCHAIN: 2,
        MY_PEERS: 3,
        BROADCAST: 4,
        META: 5,
        SW_BROADCAST: 6,
        PASS: 7,
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
                cb(lastestBlock, lastestBlock.index);
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
         * @deprecated
         * @param reciever
         * @param amount
         * @param fromTimestamp
         * @param transactCallback
         * @return {boolean}
         */
        function transact(reciever, amount, fromTimestamp, transactCallback) {
            transactCallback(false);
            return false;
        },

        /**
         * Запускает принудительную пересинхронизацию сети
         * @deprecated
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


    //************************************************************************************

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
            storj.put('maxBlock', maxBlock);
        }
        blockHandler.changeMaxBlock(maxBlock);
        transactor.changeMaxBlock(maxBlock);

        blockchain.put(Number(index), JSON.stringify(block), function () {
            if(!noHandle) {
                blockHandler.handleBlock(block, cb);
            } else {
                if(cb) {
                    cb();
                }
            }
        });

        let subs = storj.get('newBlockSubscribers');
        if (subs !== null && subs.length > 0) {
            for (let subscriber of subs) {
                subscriber();
            }
        }
    }

    /**
     * Async version of addBlockToChainIndex
     * @param index
     * @param block
     * @param noHandle
     * @returns {Promise<unknown>}
     */
    function asyncAddBlockToChainIndex(index, block, noHandle) {
        return new Promise((resolve, reject) => {
            addBlockToChainIndex(index, block, noHandle, (err, result) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            })
        })
    }

    /**
     * Добавляет блок в конец цепочки
     * @param block
     * @param {Boolean} noHandle
     * @param {Function} cb
     */
    function addBlockToChain(block, noHandle, cb) {

        if(block.index > maxBlock) {
            maxBlock = block.index;
            blockchain.put('maxBlock', maxBlock);
            storj.put('maxBlock', maxBlock);
        }

        if(!noHandle) {
            noHandle = false;
        }

        addBlockToChainIndex(maxBlock, block, noHandle, cb);
    }


    /**
     * Async verstion of blockchain.get
     * @param index
     * @returns {Promise<unknown>}
     */
    function asyncBlockchainGet(index) {
        return new Promise((resolve, reject) => {
            blockchain.get(index, (err, result) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            })
        })
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
                    logger.fatalFall('Invalid genesis hash: ' + genesisBlock.hash);
                }
                addBlockToChain(getGenesisBlock());
                logger.info('New blockchain fork started');
                setTimeout(startBlockchainServers, 1000);
                cb();
            } else {
                logger.info('Checking saved chain...');
                let zeroBlock = {};
                try {
                    zeroBlock = JSON.parse(value);
                } catch (e) {
                    logger.fatalFall('Error on parsing 0 genesis block: ' + e);
                }

                let genesisBlock = getGenesisBlock();
                if(zeroBlock.hash !== genesisBlock.hash || !config.validators[0].isValidHash(zeroBlock.hash)) {
                    logger.fatalFall('Invalid genesis hash: ' + zeroBlock.hash + ' ' + genesisBlock.hash);
                }
                logger.info('Loading saved chain...');
                blockchain.get('maxBlock', function (err, value) {
                    if(err) {
                        logger.error('Database failure. Repair or resync database!');
                        return;
                    }
                    maxBlock = Number(value);
                    storj.put('maxBlock', maxBlock);
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
        app.get('/blocks', async (req, res) => {

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="blockchain.json"'
            });
            res.write('{');
            for (let i = 0; i < maxBlock + 1; i++) {
                let result;
                try {
                    result = await asyncBlockchainGet(i);
                } catch (e) {
                    continue;
                }

                if(Buffer.isBuffer(result)) {
                    result = JSON.stringify(String(result));
                } else {
                    result = JSON.stringify(result);
                }

                res.write('"' + i + '":' + result + ',');
            }
            res.write('"maxBlock":' + maxBlock + '');
            res.write('}');
            res.end();

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

        if(!config.program.leechMode) {
            let wss = null;
            if(config.sslMode) {
                const https = require('https');
                const server = https.createServer().listen(config.p2pPort);
                wss = new WebSocket.Server({server});
                console.log("\n!!!Warning: Node running in SSL mode. This mode can be used only by public nodes with correct certificate.\n")
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
        } else {
            logger.warning('P2P server disabled by leech mode');
        }

        if(config.upnp.enabled) {

            if(!config.program.leechMode) {
                //Node info broadcast
                upnpAdvertisment = new dnssd.Advertisement(dnssd.tcp(config.upnp.token), config.p2pPort, {
                    txt: {
                        GT: String(getGenesisBlock().timestamp),
                        RA: config.recieverAddress,
                        type: 'Generic iZ3 Node'
                    }
                });
                upnpAdvertisment.start();
            }

            //Detecting other nodes
            upnpBrowser = dnssd.Browser(dnssd.tcp(config.upnp.token))
                .on('serviceUp', function (service) {
                    if(service.txt) {
                        if(service.txt.GT !== String(getGenesisBlock().timestamp)) {
                            if(config.program.verbose) {
                                logger.info('UPnP: Detected service has invalid genesis timestamp ' + service.txt.GT);
                            }
                            return;
                        }

                        if(service.txt.RA === config.recieverAddress) {
                            if(config.program.verbose) {
                                logger.info('UPnP: Self detection');
                            }
                            return;
                        }
                    }


                    for (let a in service.addresses) {
                        if(service.addresses.hasOwnProperty(a)) {
                            service.addresses[a] = 'ws://' + service.addresses[a] + ':' + service.port;
                        }
                    }

                    if(config.program.verbose) {
                        logger.info('UPnP: Detected new peers ' + JSON.stringify(service.addresses));
                    }


                    connectToPeers(service.addresses);
                }).start();
        }

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
                if(
                    sockets[i]._socket.remoteAddress === ws._socket.remoteAddress &&
                    sockets[i]._socket.remotePort === ws._socket.remotePort &&
                    sockets[i].readyState === 1 &&
                    !sockets[i]._isServer &&
                    !config.program.ignoreDoubleConnections
                ) {
                    if(config.program.verbose) {
                        logger.info('Dublicated peer ' + ws._socket.remoteAddress);
                    }
                    ws.close();
                    return;
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
        if(config.checkExternalConnectionData) {
            blockchainInfo.onConnection(ws, write);
        }
        initMessageHandler(ws);

        if(config.networkPassword) {
            write(ws, passwordMsg());     //посылаем запрос на ключевое слово
        }

        write(ws, metaMsg());         //посылаем метаинформацию

        write(ws, queryChainLengthMsg());
        write(ws, queryChainLengthMsg());
        sendAllBlockchain(ws, maxBlock - 1);

    }

    /**
     * Обработчик сообщений P2P
     * @param ws
     */
    function initMessageHandler(ws) {
        ws.on('message', (data) => {


            //prevent multiple sockets on one busaddress
            if(!config.allowMultiplySocketsOnBus) {
                if(starwave.preventMultipleSockets(ws) === 0) {
                    data = null;
                    return;
                }
            }

            if(data.length > config.maximumInputSize) {
                if(config.program.verbose) {
                    logger.error('Input message exceeds maximum input size (' + data.length + ' > ' + config.maximumInputSize + ')');
                }
                data = null;
                return;
            }

            let message;
            try {
                message = JSON.parse(data);
            } catch (e) {
                if(config.program.verbose) {
                    logger.error(e);
                }
                data = null;
                return;
            }

            //не даем обрабатывать сообщения(кроме метаинформации), пока не проверили пароль входа в сеть
            if(config.networkPassword && !ws.passwordChecked && message.type !== MessageType.PASS && message.type !== MessageType.META) {
                return;
            }

            //не даем обрабатывать сообщения, пока не получили всю инфу о блокчейне от другого сокета(пропускаем только парольные)
            if(!ws.nodeMetaInfo && message.type !== MessageType.META && config.checkExternalConnectionData && message.type !== MessageType.PASS) {
                return;
            }

            //проверяем сообщения, содержащие информацию о блокчейне
            if(blockchainInfo.handleIncomingMessage(message, ws, lastBlockInfo, write)) {
                return;
            }

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
                    if(!storj.get('peerExchangeMutex')) { //Блокируем получение списка пиров на таймаут обмена

                        storj.put('peerExchangeMutex', true);
                        setTimeout(function () {
                            storj.put('peerExchangeMutex', false);
                        }, config.peerExchangeInterval);

                        connectToPeers(message.data);
                    }
                    break;
                case MessageType.META:    //Сохранение метаинформации о нодах
                    try {
                        let ind = sockets.indexOf(ws);
                        if(ind > -1) {
                            sockets[ind].nodeMetaInfo = (new NodeMetaInfo()).parse(message.data);
                        } else {
                            logger.error('Unexpected error occurred when trying to add validators');
                        }
                    } catch (err) {
                        logger.error(err);
                    }
                    break;
                case  MessageType.BROADCAST:

                    /**
                     * Проходимся по обработчикам входящих сообщений
                     */
                    for (let a in messagesHandlers) {
                        if(messagesHandlers.hasOwnProperty(a)) {
                            message._socket = ws;
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
                case MessageType.SW_BROADCAST:
                    lastMsgIndex = starwave.handleMessage(message, messagesHandlers, ws);
                    break;
                case MessageType.PASS:
                    passwordCheckingProtocol(ws, message);
                    break;

            }
        });
    }

    /**
     * есть ли пришедшее кодовое слово в списке отосланных нами
     * @param keyWord
     * @returns {boolean}
     */
    function checkKeyWordExistence(keyWord) {
        for (let socket of sockets) {
            if(socket.keyWord === keyWord) {
                return true;
            }
        }
        return false;
    }

    /**
     * процедура обмена паролями сокетов друг с другом
     * @param ws
     * @param message
     */
    function passwordCheckingProtocol(ws, message) {

        if(message.myName === config.recieverAddress) {
            ws.close();
            return;
        }

        //проверяем пароль только если он у нас самих есть в конфиге
        if(config.networkPassword) {
            if(message.data === '') {
                //данные пустые, значит, пришел запрос кодовой фразы
                let ourKeyWord = getid() + getid();
                write(ws, passwordMsg(ourKeyWord, true, config.recieverAddress));
                ws.keyWord = ourKeyWord;
                if(config.program.verbose) {
                    logger.info("Connection digest hash generated " + _getPassPhraseForChecking(ourKeyWord));
                }
            } else {
                //если нет, значит, либо пришел хэш для проверки, либо пришло сообщение с keyWord в ответ на запрос
                if(message.keyWordResponse) {
                    //проверяем, нет ли присланного слова в нашем списке сохраненных. если есть, то запрашиваем новое кодовое слово.
                    if(checkKeyWordExistence(message.data)) {
                        write(ws, passwordMsg(undefined, undefined, config.recieverAddress));
                        return;
                    }

                    //ответ на запрос кодового слова(посылаем хэш keyword + pass) с запрошенным кодовым словом в поле data
                    let externalKeyWord = message.data;
                    //складываем внешнее кодовое слово с нашим паролем и отправляем
                    let passMes = passwordMsg(_getPassPhraseForChecking(externalKeyWord), undefined, config.recieverAddress);

                    write(ws, passMes);
                } else {
                    //пришел хэш для проверки
                    if(ws.keyWord) {
                        //если есть кодовое слово, связанное с сокетом, то проверяем
                        if(message.data === _getPassPhraseForChecking(ws.keyWord)) {
                            ws.passwordChecked = true; //флаг того, что пароль правильный и этот пир может продолжать общаться с нодой
                        } else {
                            if(config.program.verbose) {
                                logger.error('Connection digest hash invalid ' + message.data + ' vs ' + _getPassPhraseForChecking(ws.keyWord) + ' from ' + ws._socket.remoteAddress);
                            }
                            //не прошел проверку.
                            //снимаем кодовое слово с этого сокета
                            ws.keyWord = undefined;
                            //разрываем соединение
                            ws.passwordChecked = undefined;
                            ws.close();
                        }
                    } else {
                        //непонятное сообщение. игнорируем его
                        return;
                    }
                }
            }
        }
    }

    /**
     * Добавляет обработчик сообщения
     * @param {string} id
     * @param {Function} handler
     */
    function registerMessageHandler(id, handler) {
        messagesHandlers.push({id: id, handle: handler});
        messagesHandlers.sort((a, b) => a.id > b.id);
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
        /*if(fromBlock <= 5) {
              limit = 3;
        }*/

        if(!limit) {
            limit = 5;
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
        (async function () {
            let limiter = 0;
            for (let i = fromBlock; i < limit + 1; i++) {
                let result;
                try {
                    result = await asyncBlockchainGet(i);
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
        })();
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
        return calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.startTimestamp, block.sign); //Was empty sign
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
        return cryptography.hash(String(index) + previousHash + String(timestamp) + String(startTimestamp) + String(sign) + stableStringify(data)).toString();
    }

    /**
     * Добавляет блок в цепочку с проверкой
     * @param newBlock
     * @param cb
     */
    function addBlock(newBlock, cb) {
        getLatestBlock(function (lastestBlock) {
            if(isValidNewBlock(newBlock, lastestBlock)) {
                addBlockToChain(newBlock, false, cb);
            } else {
                logger.error("Trying add invalid block");
                if(cb) {
                    cb();
                }
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

            if(peers.indexOf(peer) !== -1 || typeof peer !== 'string') {
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
                if(config.program.verbose) {
                    logger.error(e);
                }
            }
        });
    }


    /**
     * Получили новую цепочку блоков
     * @param message
     */
    function handleBlockchainResponse(message, preProcessedBlocks) {

        //We can't handle new blockchain while sync in progress
        if(blockHandler.syncInProgress) {
            return;
        }

        //Now we process some chain
        if(storj.get('chainResponseMutex')) {
            return;
        }

        //Set block for new chain responses
        storj.put('chainResponseMutex', true);


        let receivedBlocks = undefined;
        if (preProcessedBlocks !== undefined) {
            receivedBlocks = preProcessedBlocks;
        } else {
            receivedBlocks = JSON.parse(message.data);
        }

        if(receivedBlocks.length === 0 || receivedBlocks[0] === false) {
            storj.put('chainResponseMutex', false);
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
                storj.put('chainResponseMutex', false);
                return;
            }

            try {
                if(latestBlockReceived.timestamp > moment().utc().valueOf() + 60000) {
                    if(config.program.verbose) {
                        logger.error('Incorrect received block timestamp or local time ' + latestBlockReceived.timestamp + ' current ' + moment().utc().valueOf());
                    }
                    storj.put('chainResponseMutex', false);

                    return;
                }


                if(latestBlockReceived.index > latestBlockHeld.index || (blockHandler.keyring.length === 0 && latestBlockReceived.index < 5 && latestBlockReceived.index !== 0)) {
                    lastKnownBlock = latestBlockReceived.index;
                    if(receivedBlocks.length === 1) {
                        if(lastKnownBlock !== latestBlockReceived.index) {
                            logger.info('Synchronize: Received last chain block ' + latestBlockReceived.index);
                        } else {
                            logger.info('Synchronize: ' + latestBlockReceived.index);
                        }
                    } else {
                        if(config.program.verbose) {
                            logger.info('Synchronize: Received ' + latestBlockHeld.index + ' of ' + latestBlockReceived.index);
                        }
                    }
                    //console.log(latestBlockHeld.index, latestBlockReceived.index, latestBlockHeld.hash, latestBlockReceived.previousHash)
                    if(latestBlockHeld.hash === latestBlockReceived.previousHash /*&& latestBlockHeld.index > 5*/) { //когда получен один блок от того который у нас есть

                        if(isValidChain(receivedBlocks) && (receivedBlocks[0].index <= maxBlock || receivedBlocks.length === 1)) {
                            addBlockToChain(latestBlockReceived, true);
                            responseLatestMsg(function (msg) {

                                clearTimeout(replaceChainTimer);
                                replaceChainTimer = setTimeout(function () {
                                    //If receiving chain, no syncing
                                    if(storj.get('chainResponseMutex')) {
                                        return;
                                    }
                                    blockHandler.resync();
                                }, config.peerExchangeInterval + 2000); //2000 в качестве доп времени

                                storj.put('chainResponseMutex', false);
                                broadcast(msg);
                            });
                        }

                    } else if(receivedBlocks.length === 1 /*&& latestBlockHeld.index > 5*/) {
                        //console.log('HERE');

                        let getBlockFrom = latestBlockHeld.index - config.blockQualityCheck;

                        if(getBlockFrom < 0) {
                            getBlockFrom = 1;//maxBlock;
                            lastKnownBlock = maxBlock;
                        }
                        if(!blockHandler.syncInProgress) {
                            broadcast(queryAllMsg(getBlockFrom, config.maxBlockSend));
                        }

                        storj.put('chainResponseMutex', false);

                    } else {

                        if(receivedBlocks[0].index <= maxBlock && receivedBlocks.length > 1) {
                            replaceChain(receivedBlocks, function () {
                                storj.put('chainResponseMutex', false);
                            });
                        } else {
                            storj.put('chainResponseMutex', false);
                        }


                    }
                } else {
                    //console.log('received blockchain is not longer than received blockchain. Do nothing');
                    storj.put('chainResponseMutex', false);

                }
            } catch (e) {
                logger.info('Received chain corrupted error');
                storj.put('chainResponseMutex', false);
            }
        });

    }

    let replaceChainTimer = null;

    /**
     * Производим замену цепочки на обновлённую
     * @param {Block[]} newBlocks
     * @param {function} cb
     */
    function replaceChain(newBlocks, cb) {

        //Если мы пытаемся проверить цепочку больше, чем всего есть блоков, проверяем с genesis
        let fromBlock = newBlocks[0].index - 1;
        if(fromBlock < 0) {
            fromBlock = 0;
        }

        //Последний блок проверяемой цепочки
        let toBlock = newBlocks[newBlocks.length - 1].index + 1;


        getBlockById(toBlock, function (err, rBlock) {
            if(err) {
                rBlock = false;
            }


            //Получаем блок, с которого выполняется проверка
            getBlockById(fromBlock, function (err, lBlock) {
                if(err) {
                    let error = new Error('Can\'t get block no ' + newBlocks[0].index + ' ' + err);

                    logger.error(error);
                    if(typeof cb !== 'undefined') {
                        cb(error);
                    }
                    return;
                }


                let maxIndex = maxBlock - config.limitedConfidenceBlockZone;
                if(maxIndex < 0) {
                    maxIndex = 0;
                }

                let validChain = false;
                //Валидна ли переданная цепочка блоков
                if(rBlock) {
                    //Если новая цепочка должна встроится в существующую
                    validChain = isValidChain(([lBlock].concat(newBlocks)).concat([rBlock]));
                } else {
                    //Если новая цепочка добавляется в конец
                    validChain = isValidChain([lBlock].concat(newBlocks));
                }


                //Проверяем, что индекс первого блока в процеряемой цепочке не выходит за пределы Limited Confidence
                if(!(newBlocks[0].index >= maxIndex)) {

                    let error = new Error('LimitedConfidence: Invalid chain');
                    if(config.program.verbose) {
                        logger.error(error);
                    }

                    if(typeof cb !== 'undefined') {
                        cb(error);
                    }

                    return;
                }


                if(
                    validChain // &&  newBlocks[0].index >= maxIndex
                    /*&& newBlocks.length >= maxBlock*/
                ) {

                    //console.log(newBlocks);
                    //logger.info('Received blockchain is valid.');
                    logger.info('Synchronize: ' + newBlocks[0].index + ' of ' + newBlocks[newBlocks.length - 1].index);
                    (async function () {
                        for (let i of newBlocks) {
                            await asyncAddBlockToChainIndex(i.index, i, true);
                        }
                        responseLatestMsg(function (msg) {
                            broadcast(msg);
                        });

                        clearTimeout(replaceChainTimer);
                        replaceChainTimer = setTimeout(function () {
                            //If receiving chain, no syncing
                            if(storj.get('chainResponseMutex')) {
                                return;
                            }
                            blockHandler.resync();
                        }, config.peerExchangeInterval + 2000); //2000 в качестве доп времени

                        //All is ok
                        if(typeof cb !== 'undefined') {
                            cb();
                        }

                    })();

                } else {
                    let error = new Error('Received blockchain corrupted');
                    if(typeof cb !== 'undefined') {
                        cb(error);
                    }
                    logger.error(error);

                }

            })


        });
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
     * Запрос блоков цепочки
     * @returns {{type: number}}
     */
    function queryAllMsg(fromIndex, limit) {
        return {'type': MessageType.QUERY_ALL, data: typeof fromIndex === 'undefined' ? 0 : fromIndex, limit}
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
     * сообщение со списком консенсусов и messageBusAddress
     * @param   {object} v = validators объект с валидаторами
     * @returns {object} {{type: number, data: *}}
     */
    function metaMsg(v = nodeMetaInfo) {
        return {
            'type': MessageType.META, 'data': JSON.stringify(v)
        }
    }

    /**
     * message for initiating password procedure
     * @param data
     * @param keyWordResponse //ставится true ТОЛЬКО если в data посылается keyWord при ответе на запрос этого ключевого слова
     * @param myName идентефикатор ноды для обнаружения себя
     * @returns {{type: number, data: *, response }}
     */
    function passwordMsg(data = '', keyWordResponse, myName) {
        return {
            'type': MessageType.PASS, 'data': data, 'keyWordResponse': keyWordResponse, 'myName': myName,
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
                if(socketPasswordOk(socket)) {
                    write(socket, message);
                }
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
     * Прошёл-ли сокет проверку пароля
     * @param socket
     * @return {boolean}
     */
    function socketPasswordOk(socket) {
        if(config.networkPassword) {
            return !!socket.passwordChecked;
        } else {
            return true;
        }
    }

    /**
     * Возвращает адрес сокет по адресу шины сообщений
     * @param address
     * @return {*}
     */
    function getSocketByBusAddress(address) {
        const sockets = getCurrentPeers(true);
        for (let i in sockets) {
            if(sockets.hasOwnProperty(i)) {
                if(sockets[i] && sockets[i].nodeMetaInfo) {
                    if(sockets[i].nodeMetaInfo.messageBusAddress === address) {
                        return sockets[i];
                    }
                }
            }
        }

        return false;
    }

    /**
     * Запуск сети
     */
    function startBlockchainServers() {
        connectToPeers(peers);
        initHttpServer();
        initP2PServer();
        createWalletIfNotExsists();
        if(config.program.keyringEmission) {
            keyringEmission();
        }


        if(config.appEntry) {
            logger.info("Loading DApp...\n");
            try {
                /**
                 * @var {DApp} clientApplication
                 */
                let clientApplication = new (require(config.appEntry))(config, blockchainObject);
                clientApplication.init();
                storj.put("dapp", clientApplication);
            } catch (e) {
                logger.error("DApp fatal:\n");
                console.log(e);
                process.exit(1);
            }
        }

    }

    /**
     * Формирует список подключенных пиров
     * @returns {Array}
     */
    function getCurrentPeers(fullSockets) {
        return sockets.map(function (s) {
            if(s && s.readyState === 1 && socketPasswordOk(s)) {
                if(fullSockets) {
                    return s;
                } else {

                    if(!s._socket._isServer) {
                        return s.url;
                    }

                    return 'ws://' + s._socket.remoteAddress + ':' + /*s._socket.remotePort*/ config.p2pPort
                }
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
            index: index,
            mutex: getid() + getid() + getid(),
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
        if(wallet.accepted || config.disableWalletDeploy) {
            return;
        }
        wallet.create();
    }


    /**
     * Generates new sender address
     */
    function rotateAddress() {
        config.recieverAddress = getid() + getid() + getid();
    }

    /**
     * возвращает строку пароля для сравнения
     * @returns {string}
     * @private
     */
    function _getPassPhraseForChecking(keyWord) {
        return cryptography.hash(config.networkPassword + keyWord).toString();
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

        //Converts block data object to str
        if(typeof blockData === 'object') {
            blockData = stableStringify(blockData);
        }

        let validators = config.validators;
        /**
         * Модули консенсусов изначально расположены в порядке повышения приоритета.
         * Выбор консенсуса для генерации блока, должен идти в порядке убывания приоритета
         */
        /* validatorReversed.reverse();
         for (let a in validatorReversed) {
             if(validatorReversed.hasOwnProperty(a)) {
                 if(validatorReversed[a].isReady()) {
                     validatorReversed[a].generateNextBlock(blockData, cb, cancelCondition);
                     validatorReversed.reverse();
                     return;
                 }
             }
         }*/


        for (let a = validators.length - 1; a > -1; a--) {
            if(validators.hasOwnProperty(a)) {
                if(validators[a].isReady()) {
                    validators[a].generateNextBlock(blockData, cb, cancelCondition);
                    return;
                }
            }
        }

        //validatorReversed.reverse();
        return false;
    }

    /**
     * Check is blockchain ready for transaction
     * @return {boolean}
     */
    function isReadyForTransaction() {

        if(blockHandler.syncInProgress) {
            return false;
        }

        if(storj.get('chainResponseMutex')) {
            return false;
        }

        if(!config.newNetwork) {
            if(getCurrentPeers().length === 0) {
                return false;
            }

            //Technically we ready for transaction but this state is bad for normal mode
            if(maxBlock <= 5 || maxBlock === -1) {
                return false;
            }
        }

        return true;
    }


//**************************************************************************


    /**
     * Запускается всего один раз при старте цепочки, при условии, что кошелек утверждён
     */

    function keyringEmission() {
        if(
            maxBlock <= 5 &&
            maxBlock !== -1 &&
            miningNow === 0 &&
            blockHandler.keyring.length === 0 && config.newNetwork
        ) {
            logger.info('Starting keyring emission');

            let keyring = new (require('./modules/blocksModels/keyring'))([], wallet.id);
            keyring.generateKeys(config.workDir + '/keyringKeys.json', config.keyringKeysCount, wallet);
            transactor.transact(keyring, function (blockData, cb) {
                config.validators[0].generateNextBlock(blockData, function (generatedBlock) {
                    addBlock(generatedBlock);
                    broadcastLastBlock();
                    cb(generatedBlock);
                });
            }, function () {
                console.log('Keyring: Keyring accepted');
            });
        } else {
            logger.error('Cant generate keyring');
        }
    }


    /**
     * Starts node with config
     */
    function start() {

        if(config.validators.length === 0) {
            throw ('Error: No consensus validators loaded!');
        }

        //Loading validators
        for (let a in config.validators) {
            if(config.validators.hasOwnProperty(a)) {
                try { //Trying to load validator from path
                    config.validators[a] = (require('./modules/validators/' + config.validators[a]));
                } catch (e) { //If error trying to load validator from modules
                    try {
                        config.validators[a] = (require(config.validators[a]));
                    } catch (e) {
                        try {
                            config.validators[a] = (require('./plugins/' + config.validators[a]));
                        } catch (e) {
                            try {
                                config.validators[a] = (require(process.cwd() + '/' + config.validators[a]));
                            } catch (e) {
                                try {
                                    config.validators[a] = (require(process.cwd() + '/node_modules/' + +config.validators[a]));
                                } catch (e) {
                                    logger.fatalFall('Validator ' + config.validators[a] + ' not found');
                                }

                            }

                        }

                    }
                }

                config.validators[a] = new config.validators[a](blockchainObject);
            }
        }

        console.log('');
        startNode(function initilized() {
            setInterval(peerExchange, config.peerExchangeInterval);
            setInterval(broadcastLastBlock, config.hearbeatInterval);
            if(config.blocksSavingInterval) {
                setInterval(function () {
                    if(!storj.get('terminating')) {
                        blockchain.save();
                    }
                }, config.blocksSavingInterval);
            }
            lastBlockInfo = blockchainInfo.getOurBlockchainInfo()['lastBlockInfo'];
            transactor.startWatch(5000);

            process.on('SIGINT', () => {


                if(storj.get('terminateAttempts') === 1) {
                    logger.info('Terminating immediately.');
                    process.exit(1);
                    return;
                }

                if(storj.get('terminateAttempts') === 0) {
                    storj.put('terminateAttempts', 1);
                    logger.warning('Press the Ctrl+C again to exit without saving data.');
                    return;
                }

                storj.put('terminating', true);
                storj.put('terminateAttempts', 0);

                if(config.upnp.enabled) {
                    try {
                        upnpAdvertisment.stop();
                        upnpBrowser.stop();
                    } catch (e) {
                    }
                }

                console.log('');
                logger.info('Terminating...');
                blockHandler.syncInProgress = true;
                wallet.save();
                config.emptyBlockInterval = 10000000000;
                setTimeout(function () {

                    function terminate() {
                        if(config.ecmaContract.enabled) {
                            blockchainObject.ecmaContract.terminate(terminateBlockchain);
                        } else {
                            terminateBlockchain();
                        }
                    }

                    function terminateBlockchain() {
                        logger.info('Saving blockchain DB');
                        blockchain.close(function () {
                            setTimeout(function () {
                                process.exit();
                            }, 2000);
                        });
                    }

                    if(storj.get("dapp") !== null) {
                        storj.get("dapp").terminate(terminate);
                    } else {
                        terminate();
                    }

                }, 1000);

            });
        });


    }


    /**
     * Get block by id
     * @param {number} id
     * @param {function} cb
     */
    function getBlockById(id, cb) {
        blockchain.get(id, function (err, val) {
            if(err) {
                cb(err);
            } else {
                cb(err, JSON.parse(val));
            }
        })
    }


    blockchainObject = {
        config: config,
        validators: nodeMetaInfo,
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
        keyringEmission: keyringEmission,
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
        getSocketByBusAddress: getSocketByBusAddress,
        isReadyForTransaction: isReadyForTransaction,
        registerMessageHandler: registerMessageHandler,
        setMiningForce: function (miningNowP, miningForceP) {
            miningNow = miningNowP;
            miningForce = miningForceP;
        },
        MessageType: MessageType,
        routes: routes,
        messagesHandlers: messagesHandlers,
        secretKeys: secretKeys,
        lastBlockInfo: lastBlockInfo,
        /**
         * Get block by id
         * @param {Number} id
         * @param {Function} cb
         */
        getBlockById: getBlockById,
    };

    //Init2
    frontend.blockchainObject = blockchainObject;
    transactor.blockchainObject = blockchainObject;
    blockchainInfo.blockchain = blockchainObject;

    //Message dispatcher
    blockchainObject.messagesDispatcher = new MessagesDispatcher(config, blockchainObject);

    //StarWave messaging protocol
    starwave.blockchain = blockchainObject;

    //Plugins
    if(config.plugins.length > 0) {
        logger.info("Loading plugins...\n");
        for (let plugin of config.plugins) {
            let res = loadPlugin(plugin, blockchainObject, config, storj);
            if(typeof res === "object") {
                logger.fatal("Plugin fatal:\n");
                console.log(res);
                process.exit(1);
            }
        }
        logger.info("Plugins loaded");
    }

    /**
     * load custom plugin
     * @param {string} plugin name of the plugin module
     * @param {object} blockchainObject blockchain object
     * @param {object} config config object
     * @param {object} storj global storage object
     */
    function loadPlugin(plugin, blockchainObject, config, storj) {
        let pluginMod;
        let path = '';
        let isPathFull;
        try {
            //Direct module loading attempt
            try {
                path = plugin;
                pluginMod = require(path)(blockchainObject, config, storj);
                path = '/' + path;
                isPathFull = false;
            } catch (e) {

                //Plugins path
                try {
                    path = './plugins/' + plugin;
                    pluginMod = require(path)(blockchainObject, config, storj);
                    path = '/.' + path;
                    isPathFull = false;
                } catch (e) {

                    //Starting dir search
                    try {
                        path = process.cwd() + '/' + plugin;
                        pluginMod = require(path)(blockchainObject, config, storj);
                        isPathFull = true;
                    } catch (e) {

                        //Working dir search
                        try {
                            path = config.workDir + '/' + plugin;
                            pluginMod = require(path)(blockchainObject, config, storj);
                            isPathFull = false;
                        } catch (e) {

                            //Node modules in starting dir search
                            path = process.cwd() + '/node_modules/' + plugin;
                            pluginMod = require(path)(blockchainObject, config, storj);
                            isPathFull = true;
                        }
                    }
                }
            }
        } catch (e) {
            return e;
        }

        let checked = checkPluginEnginesVersion(path, isPathFull);
        if(true !== checked) {
            return new Error(checked);
        }

        return true;
    }

    function checkPluginEnginesVersion(path, isPathFull) {
        try {
            let compareVersions = new CompareVersions(isPathFull);
            let izzzioMinVersionNeed = compareVersions.readIzzzioMinVersionNeeded(path);
            if(!izzzioMinVersionNeed) {
            } else {
                if(!compareVersions.isMinimumVersionMatch(izzzioMinVersionNeed, config.program.version())) {
                    return 'need min version node: ' + izzzioMinVersionNeed + ' for plugin ' + path;
                }
            }
        } catch (e) {
            //return e;
        }
        return true;
    }

    //Wallet create
    if(wallet.id.length === 0) {
        wallet.generate();
    }

    //Account manager
    let accountManager = new AccountManager(config);
    accountManager.addAccountWallet('default', wallet);
    storj.put('accountManager', accountManager);

    //EcmaContract Smartcontracts
    if(typeof config.ecmaContract !== 'undefined' && config.ecmaContract.enabled) {
        blockchainObject.ecmaContract = new EcmaContract();
        storj.put('ecmaContract', blockchainObject.ecmaContract);
    }


    storj.put('blockchainObject', blockchainObject);
    return blockchainObject;
}


module.exports = Blockchain;

//Work