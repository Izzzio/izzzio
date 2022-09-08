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
    const cors = require('cors');

    app.use(cors());

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

    app.use(bodyParser.json({limit: '550mb'}));

    console.log('Initialize...');
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
        config.recieverAddress = wallet.getAddress(false);
        console.log('');
        console.log('Message bus address: ' + config.recieverAddress);
    }
    console.log('');

    /**
     * Block Database
     */
        // let blockchain = levelup(config.workDir + '/blocks');
    let blockchain = blockController;
    storj.put('blocks', blockchain);


    /**
     * Types of messages in the p2p network
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
        RESPONSE_BLOCKS_BLOCKCHAIN: 8,
    };

    let maxBlock = -1;
    let lastKnownBlock = -1;
    let peers = config.initialPeers;
    let peersBlackList = [];
    let lastMsgIndex = 0;
    let messagesHandlers = [];

    /**
     * Module that works with blocks of different types
     * @type {BlockHandler}
     */
    const blockHandler = new BlockHandler(wallet, blockchain, blockchainObject, config, {acceptCount: config.blockAcceptCount});
    storj.put('blockHandler', blockHandler);

    /**
     * Transaction tracking module
     * @type {Transactor}
     */
    const transactor = new Transactor(wallet, blockchain, {
        acceptCount: config.blockAcceptCount,
        blockHandler: blockHandler
    }, blockchainObject);
    storj.put('transactor', transactor);

    /**
     * Frontend with interface and RPC
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
         * Allows the interface to get information about the last block
         * @param {Function} cb
         */
        function getLastBlock(cb) {
            getLatestBlock(function (lastestBlock) {
                cb(lastestBlock, lastestBlock.index);
            });
        },

        /**
         * Just passes all the information to the frontend
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
         * Triggers a forced network resync
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
     * Generating block
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
     * Adds a block to a specific location in the chain
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
     * Adds a block to the end of the chain
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
     * Node launch
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
     * Starting the Interface Server
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
     * Starting a P2P server
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
     * P2p connection initialization
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
            write(ws, passwordMsg());     //sending a request for a keyword
        }

        write(ws, metaMsg());         //sending meta information

        write(ws, queryChainLengthMsg());
        write(ws, queryChainLengthMsg());
        sendAllBlockchain(ws, maxBlock - 1);

    }

    /**
     * P2P message handler
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

            //do not allow messages to be processed (except meta-information) until the network login password has been checked
            if(config.networkPassword && !ws.passwordChecked && message.type !== MessageType.PASS && message.type !== MessageType.META) {
                return;
            }

            //do not allow messages to be processed until we have received all the information about the blockchain from another socket (we skip only password ones)
            if(!ws.nodeMetaInfo && message.type !== MessageType.META && config.checkExternalConnectionData && message.type !== MessageType.PASS) {
                return;
            }

            //check messages containing information about the blockchain
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
                    sendAllBlockchain(ws, message.data, message.limit, message.offset, message.hideEmptyBlocks, message.contractAddress);
                    break;
                case MessageType.RESPONSE_BLOCKCHAIN:
                    handleBlockchainResponse(message);
                    break;
                case MessageType.MY_PEERS:
                    if(!storj.get('peerExchangeMutex')) { //Blocking the receipt of the list of peers for the exchange timeout

                        storj.put('peerExchangeMutex', true);
                        setTimeout(function () {
                            storj.put('peerExchangeMutex', false);
                        }, config.peerExchangeInterval);

                        connectToPeers(message.data);
                    }
                    break;
                case MessageType.META:    //Saving meta information about nodes
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
                     * Going through the incoming message handlers
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
                    starwave.handleMessage(message, messagesHandlers, ws);
                    lastMsgIndex = 0;
                    break;
                case MessageType.PASS:
                    passwordCheckingProtocol(ws, message);
                    break;

            }
        });
    }

    /**
     * is there a code word that came in the list sent by us
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
     * procedure for exchanging socket passwords with each other
     * @param ws
     * @param message
     */
    function passwordCheckingProtocol(ws, message) {

        if(message.myName === config.recieverAddress) {
            ws.close();
            return;
        }

        //check the password only if we ourselves have it in the config
        if(config.networkPassword) {
            if(message.data === '') {
                //the data is empty, so the request for a passphrase has arrived
                let ourKeyWord = getid() + getid();
                write(ws, passwordMsg(ourKeyWord, true, config.recieverAddress));
                ws.keyWord = ourKeyWord;
                if(config.program.verbose) {
                    logger.info("Connection digest hash generated " + _getPassPhraseForChecking(ourKeyWord));
                }
            } else {
                //if not, it means that either a hash has arrived for verification, or a message with a keyWord has arrived in response to the request
                if(message.keyWordResponse) {
                    //check if the word you sent is in our saved list. if yes, then request a new code word.
                    if(checkKeyWordExistence(message.data)) {
                        write(ws, passwordMsg(undefined, undefined, config.recieverAddress));
                        return;
                    }

                    //response to a codeword request (we send a hash of keyword + pass) with the requested codeword in the data field
                    let externalKeyWord = message.data;
                    //add an external code word with our password and send
                    let passMes = passwordMsg(_getPassPhraseForChecking(externalKeyWord), undefined, config.recieverAddress);

                    write(ws, passMes);
                } else {
                    //came hash to verify
                    if(ws.keyWord) {
                        //if there is a code word associated with the socket, then check
                        if(message.data === _getPassPhraseForChecking(ws.keyWord)) {
                            ws.passwordChecked = true; //flag that the password is correct and this peer can continue to communicate with the node
                        } else {
                            if(config.program.verbose) {
                                logger.error('Connection digest hash invalid ' + message.data + ' vs ' + _getPassPhraseForChecking(ws.keyWord) + ' from ' + ws._socket.remoteAddress);
                            }
                            //failed verification.
                            //remove the code word from this socket
                            ws.keyWord = undefined;
                            //break the connection
                            ws.passwordChecked = undefined;
                            ws.close();
                        }
                    } else {
                        //incomprehensible message. ignore it
                        return;
                    }
                }
            }
        }
    }

    /**
     * Adds a message handler
     * @param {string} id
     * @param {Function} handler
     */
    function registerMessageHandler(id, handler) {
        messagesHandlers.push({id: id, handle: handler});
        messagesHandlers.sort((a, b) => a.id > b.id);
    }

    /**
     * Collects the entire chain of blocks from the database and sends it to the one who requested
     * @param ws
     * @param fromBlock
     * @param limit
     * @param hideEmptyBlocks
     */
    function sendAllBlockchain(ws, fromBlock, limit, offset, hideEmptyBlocks, contractAddress) {
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

        getAllChain(fromBlock, limit, offset, hideEmptyBlocks, contractAddress, function (blockchain) {
            if (typeof hideEmptyBlocks !== 'undefined') {
                write(ws, responseBlocksChainMsg(blockchain));
            } else {
                write(ws, responseChainMsg(blockchain));
            }
        });
    }

    /**
     * Putting the whole chain together
     * @param fromBlock
     * @param limit
     * @param offset
     * @param hideEmptyBlocks
     * @param cb
     */
    function getAllChain(fromBlock, limit, offset=0, hideEmptyBlocks, contractAddress, cb) {
        limit = typeof limit === 'undefined' ? config.maxBlockSend : limit;

        async function getAllBlocks() {
            let limiter = 0;
            const blocks = [];

            for (let blockIndex = fromBlock - offset; blockIndex > 0; blockIndex--) {
                let binaryBlock;
                try {
                    binaryBlock = await asyncBlockchainGet(blockIndex);
                } catch (e) {
                    continue;
                }

                const blockData = JSON.parse(binaryBlock);
                if (contractAddress) {
                    const data = JSON.parse(blockData.data);

                    if (data.state.contractAddress != contractAddress) {
                        continue;
                    }
                }

                if (hideEmptyBlocks) {
                    const data = JSON.parse(blockData.data);
                    if (data.type === 'Empty') {
                        continue;
                    }
                }

                blocks.push(blockData);

                limiter++;
                if(limiter > config.maxBlockSend) {
                    break;
                }

                if (blocks.length > limit) {
                    break;
                }
            }

            return blocks;
        }

        (async function() {
            const blockchain = await getAllBlocks();
            cb(blockchain);
        })();
    }

    /**
     * Catching network errors
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
     * Calculates the hash for the block object
     * @param block
     * @returns {*|string|a}
     */
    function calculateHashForBlock(block) {
        return calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.startTimestamp, block.sign); //Was empty sign
    }

    /**
     * Hash of blocks
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
     * Adds a block to the chain with verification
     * @param newBlock
     * @param cb
     */
    function addBlock(newBlock, cb) {
        getLatestBlock(async function (lastestBlock) {
            if(await isValidNewBlock(newBlock, lastestBlock)) {
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
     * Checking the new block for compliance with the requirements
     * @param {Block} newBlock
     * @param {Block} previousBlock
     * @returns {boolean}
     */
    async function isValidNewBlock(newBlock, previousBlock) {

        let validatorReversed = config.validators;
        /**
         * Consensus modules are initially arranged in order of increasing priority.
         * The choice of consensus should go in descending order of priority
         */
        validatorReversed.reverse();

        try {
            for (let a in validatorReversed) {
                if(validatorReversed.hasOwnProperty(a)) {
                    if(await validatorReversed[a].isValidNewBlock(newBlock, previousBlock)) {
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
     * Connecting to the peers
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
     * Got a new block chain
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

        getLatestBlock(async function (latestBlockHeld) {
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

                if(latestBlockReceived.index > latestBlockHeld.index || (blockHandler.keyring.length === 0 && latestBlockReceived.index < 5 && latestBlockReceived.index !== 0 && !config.isPosActive)) {
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
                    // console.log(latestBlockHeld.index, latestBlockReceived.index, latestBlockHeld.hash, latestBlockReceived.previousHash)
                    if(latestBlockHeld.hash === latestBlockReceived.previousHash /*&& latestBlockHeld.index > 5*/) { //when one block is received from the one we have

                        if(await isValidChain(receivedBlocks) && (receivedBlocks[0].index <= maxBlock || receivedBlocks.length === 1)) {
                            addBlockToChain(latestBlockReceived, true);
                            responseLatestMsg(function (msg) {

                                clearTimeout(replaceChainTimer);
                                replaceChainTimer = setTimeout(function () {
                                    //If receiving chain, no syncing
                                    if(storj.get('chainResponseMutex')) {
                                        return;
                                    }
                                    blockHandler.resync();
                                }, config.peerExchangeInterval + 2000); //2000 as additional time

                                storj.put('chainResponseMutex', false);
                                broadcast(msg);
                            });
                        }

                    } else if(receivedBlocks.length === 1 /*&& latestBlockHeld.index > 5*/) {
                        //console.log('HERE');

                        let getBlockFrom = latestBlockReceived.index;

                        if(getBlockFrom < 0 || maxBlock == 0) {
                            console.log('maxBlock', maxBlock);
                            getBlockFrom = 1;//maxBlock;
                            lastKnownBlock = maxBlock;
                        }

                        if(!blockHandler.syncInProgress) {
                            console.log('sync', getBlockFrom, config.maxBlockSend);
                            broadcast(queryAllMsg(getBlockFrom, config.maxBlockSend));
                        }

                        storj.put('chainResponseMutex', false);

                    } else {
                        console.log('receivedBlocks[0].index', receivedBlocks[0].index, maxBlock + 1, receivedBlocks.length);
                        if(receivedBlocks[0].index <= maxBlock + 1 && receivedBlocks.length > 1) {
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
     * Replace the chain with an updated one
     * @param {Block[]} newBlocks
     * @param {function} cb
     */
    function replaceChain(newBlocks, cb) {

        //If we are trying to check the chain more than there are blocks in total, we check with genesis
        let fromBlock = newBlocks[0].index - 1;
        if(fromBlock < 0) {
            fromBlock = 0;
        }

        //The last block of the chain being checked
        let toBlock = newBlocks[newBlocks.length - 1].index + 1;


        getBlockById(toBlock, function (err, rBlock) {
            if(err) {
                rBlock = false;
            }


            //Get the block from which the check is performed
            getBlockById(fromBlock, async function (err, lBlock) {
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
                //Is the transmitted block chain valid
                if(rBlock) {
                    //If a new chain needs to be integrated into an existing one
                    validChain = await isValidChain(([lBlock].concat(newBlocks)).concat([rBlock]));
                } else {
                    //If a new chain is added to the end
                    validChain = await isValidChain([lBlock].concat(newBlocks));
                }


                //We check that the index of the first block in the chain being checked does not exceed the limits of Limited Confidence
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
     * Checks the correctness of the chain
     * @param {Array} blockchainToValidate
     * @returns {boolean}
     */
    async function isValidChain(blockchainToValidate) {
        /*if(JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(getGenesisBlock())) {
         return false;
         }*/
        try {
            const tempBlocks = [blockchainToValidate[0]];
            for (let i = 1; i < blockchainToValidate.length; i++) {
                if(await isValidNewBlock(blockchainToValidate[i], tempBlocks[i - 1])) {
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
     * Get the last loaded block of the chain
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
     * Request for the last block of the chain
     * @returns {{type: number}}
     */
    function queryChainLengthMsg() {
        return {'type': MessageType.QUERY_LATEST}
    }

    /**
     * Request for Chain Blocks
     * @returns {{type: number}}
     */
    function queryAllMsg(fromIndex, limit) {
        return {'type': MessageType.QUERY_ALL, data: typeof fromIndex === 'undefined' ? 0 : fromIndex, limit}
    }

    /**
     * The response of the entire block of the chain
     * @param blockchain
     * @returns {{type: number, data}}
     */
    function responseChainMsg(blockchain) {
        return {
            'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(blockchain)
        }
    }

    /**
     * Response of the whole chain block
     * @param blockchain
     * @returns {{type: number, data}}
     */
    function responseBlocksChainMsg(blockchain) {
        return {
            'type': MessageType.RESPONSE_BLOCKS_BLOCKCHAIN, 'data': JSON.stringify(blockchain)
        }
    }

    /**
     * Response of the last block in the chain
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
     * Peer list message
     * @param peers
     * @returns {{type: number, data: *}}
     */
    function peersBroadcast(peers) {
        return {
            type: MessageType.MY_PEERS, data: peers
        }
    }

    /**
     * message with list of consensuses and messageBusAddress
     * @param   {object} v = validators object with validators
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
     * @param keyWordResponse //set to true ONLY if a keyWord is sent to data when responding to a request for this keyword
     * @param myName node ID to discover itself
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
        } catch (e) { //write error, perhaps the socket is no longer active
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
     * Tell everyone the addresses of our peers
     */
    function broadcastConnectedPeers() {
        broadcast(peersBroadcast(getCurrentPeers()));
    }

    /**
     * Has the socket passed password verification
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
     * Returns the socket address to the message bus address
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
     * Network launch
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
     * Generates a list of connected peers
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
     * Periodic distribution of information about available blocks
     */
    function broadcastLastBlock() {
        responseLatestMsg(function (msg) {
            broadcast(msg);
        });
    }


    /**
     * Periodic exchange of peers and reconnection to central nodes
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
     * Creates a message
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
            TTL: typeof TTL !== 'undefined' ? TTL : 0, //number of message jumps
            index: index,
            mutex: getid() + getid() + getid(),
        };
    }

    /**
     * Sends a broadcast message through the system
     * @param {object} msgData message content
     * @param {string} id message id
     * @param {string} reciver message recipient
     * @param {string} recepient message sender
     * @param {int} TTL
     * @return {{type: number, data: *, reciver: *, recepient: *, id: *, timestamp: number, TTL: number, index: number}}
     */
    function broadcastMessage(msgData, id, reciver, recepient, TTL) {
        let message = createMessage(msgData, reciver, recepient, id, lastMsgIndex + 1, TTL);
        broadcast(message);
        return message;
    }


    /**
     * Creates a wallet on the blockchain if it hasn't been created yet.
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
     * returns the password string for comparison
     * @returns {string}
     * @private
     */
    function _getPassPhraseForChecking(keyWord) {
        return cryptography.hash(config.networkPassword + keyWord).toString();
    }


    /**
     * Creates a new block using a suitable consensus
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
         * Consensus modules are initially arranged in order of increasing priority.
         * The choice of consensus for block generation should go in descending order of priority
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
     * Runs only once at the start of the chain, provided that the wallet is approved
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
                                config.validators[a] = (require(process.cwd() + '/plugins/' + config.validators[a]));
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
                    //Plugins full path
                    console.log('__dirname', __dirname);
                    try {
                        path = __dirname + '/plugins/' + plugin;
                        pluginMod = require(path)(blockchainObject, config, storj);
                        isPathFull = true;
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

    // Wallet create
    if(wallet.id.length === 0) {
        wallet.generate();
        config.recieverAddress = wallet.getAddress(false);
        console.log('');
        console.log('Message bus address: ' + config.recieverAddress);
    }

    let nodeMetaInfo = new NodeMetaInfo(config);
    blockchainObject.validators = nodeMetaInfo;

    // StarWave messaging protocol
    let starwave = new StarwaveProtocol(config, blockchainObject);

    // Account manager
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