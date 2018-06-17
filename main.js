/**
 iZ³ | Izzzio blockchain - https://izzz.io
 BitCoen project - https://bitcoen.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

'use strict';


let program = require('commander');
program
    .version(require('./package.json').version)
    .description(' iZ3 blockchain core.')
    .option('-a, --autofix', 'Fix saved chain if possible. WARNING: You can lose important data')
    .option('--clear', 'Clear all saved chain and deletes wallet. WARNING: You can lose important data')
    .option('--clear-db', 'Clear all saved chain and calculated wallets.')
    .option('-c, --config [path]', 'Core config path', 'config.json')
    .option('--work-dir [path]', 'Working directory', false)
    .option('--generate-wallets [keyring path]', 'Generate wallets from keyring file', false)
    .option('--new-chain', 'Generates keyring and token emission if possible', false)
    .option('--fall-on-errors', 'Allow stop node on uncaught exceptions', false)
    .option('--block-accept-count [count]', 'Number of blocks to confirm transaction')
    .option('--http-port [port]', 'Interface and RPC binding port')
    .option('--disable-rpc-password', 'Disable RPC password', false)
    .option('--disable-mining', 'Completely disables mining', false)
    .option('--fast-load', 'Don\'t checking databased on startup', false)
    .option('--verbose', 'More logging info', false)
    .option('--enable-address-rotation', 'Activates the rotation of the addresses', false)
    .parse(process.argv);

const getid = require('./modules/getid');

const config = {

    //Networking
    httpPort: 3001,                     //Порт биндинга RPC и интерфейса
    p2pPort: 6013,                      //Порт p2p (лучше везде оставить одинаковым)
    sslMode: false,                     //Включить режим SSL
    httpServer: 'localhost',            //Адрес биндинга RPC и интерфейса
    rpcPassword: getid() + getid(),
    initialPeers: [                     //Стартовые узлы, для синхронизации с сетью
        'ws://node1.bitcoen.io:6013',
        'wss://bitcoen.io/blockchain',
        'ws://node2.bitcoen.io:6013',
        'ws://node3.bitcoen.io:6013',
        'ws://node4.bitcoen.io:6013',
        'ws://node5.bitcoen.io:6013',
        'ws://node6.bitcoen.io:6013',
        'ws://node7.bitcoen.io:6013',
        'ws://node8.bitcoen.io:6013',
        'ws://node9.bitcoen.io:6013',
        'ws://node10.bitcoen.io:6013',
        //'ws://localhost:6013',
    ],
    allowMultipleConnectionsFromIp: true,//False - если в сети много зацикливаний, True - если используется прокси для коннекта
    maxPeers: 80,                       //Рекомендуемое число 15-20


    //Blockchain
    blockAcceptCount: 20,               //Количеств блоков подтверждения транзакции
    hearbeatInterval: 10000,             //Внутренний таймер ноды
    peerExchangeInterval: 5000,        //Частота обновления пиров
    maxBlockSend: 600,                  //Должно быть больше blockQualityCheck
    blockQualityCheck: 100,             //Количество блоков "сверх", которое мы запрашиваем для проверки валидности цепочки
    limitedConfidenceBlockZone: 288,    //Зона "доверия". Цепочку ранее этой зоны менять нельзя. Должно быть больше blockQualityCheck
    generateEmptyBlockDelay: 300 * 1000,//5 минут - С какой частотой необхдимо выпускать пустые блоки в сеть при простое сети
    blockHashFilter: {                  //Фильтр корректных блоков для LCPoA
        blockEndls: [                   //4 символа в коце блока. Сюда должен попасть Genesis
            'f3c8',
            'a000',
            '0000',
            '7027'
        ]
    },
    genesisTiemstamp: 1492004951 * 1000, //2017-07-23 01:00:00 Vitamin blockchain first started
    newNetwork: false,                   //Если будет обнаружен запуск новой сети блокчейн, будет произведена автоматическая эмиссия ключей и денег
    lcpoaVariantTime: 1,                //Количество милилсекунд, требуемое на генерацию одного хеша блока
    validators: [                       //"Валидаторы" - дополнительные проверяющие блоков, для введения дополнительных консенсусов, кроме LCPoA
        'lcpoa',                        //БЕЗ КОНСЕНСУСА БЕЗ КЛЮЧЕЙ АВТОМАТИЧЕСКАЯ ЭМИССИЯ НЕВОЗМОЖНА
        'thrusted'
    ],
    emptyBlockInterval: 10000,          //Интервал проверки необходимости выпуска пустого блока
    blacklisting: false,


    //Tokens
    precision: 10000000000,                  //Точность вычислений для кошелька
    initialEmission: 100000000,         //Сумма первоначальной эмиссии (нужна только при эмиссии)

    //Messaging Bus
    enableMessaging: false,              //Разрешить использование шины сообщений (необходима для некоторых консенсусов)
    recieverAddress: getid() + getid() + getid(), //Адрес ноды в сети
    messagingMaxTTL: 3,                 //Максимальный предел скачков сообщения
    //maximumInputSize: 15 * 1024 * 1024, //Максимальный объем сообщения (здесь 15 мегабайт)
    maximumInputSize: 2 * 1024 * 1024,

    //Wallet
    walletFile: './wallet.json',         //Адрес файла кошелька
    workDir: '.',

    //Database
    walletsDB: 'wallets',               // false - для хранения в ОЗУ, mem://wallets.json для хранения в ОЗУ и записи на ПЗУ при выгрузке
    blocksDB: 'blocks',                 // false - для хранения в ОЗУ, mem://blocks.json для хранения в ОЗУ и записи на ПЗУ при выгрузке

    //Application
    appEntry: false       //Точка входа в "приложение". False - если не требуется
};

//*********************************************************************
const fs = require('fs-extra');
const Blockchain = require('./Blockchain');
Array.prototype.remove = function (from, to) {
    let rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

try {
    let loadedConfig = JSON.parse(fs.readFileSync(program.config));
    for (let i in config) {
        if(typeof loadedConfig[i] !== 'undefined') {
            config[i] = loadedConfig[i];
        }
    }
    /*   try {
           fs.writeFileSync('config.json', JSON.stringify(config));
       } catch (e) {
           console.log('Info: Can\'t save config');
       }*/
} catch (e) {
    console.log('Info: No configure found. Using standard configuration.');
}


config.program = program;

require('./modules/splash')();


if(program.clear) {
    console.log('Info: Clear up.');
    fs.removeSync('wallets');
    fs.removeSync('blocks');
    fs.removeSync(config.walletFile);
    console.log('Info: End');
}

if(program.newChain) {
    config.newNetwork = true;
}

if(program.httpPort) {
    config.httpPort = program.httpPort;
}

if(program.disableRpcPassword) {
    config.rpcPassword = '';
}

if(program.blockAcceptCount) {
    config.blockAcceptCount = program.blockAcceptCount;
}

if(program.workDir) {
    config.workDir = program.workDir;
    config.walletFile = config.workDir + '/wallet.json';
}

if(program.clearDb) {
    fs.removeSync(config.workDir + '/wallets');
    fs.removeSync(config.workDir + '/blocks');
    console.log('Info: DB cleared');
}


if(program.generateWallets) {
    const Wallet = require('./modules/wallet');

    console.log('Info: Generating wallets from keyring ' + program.generateWallets);

    fs.ensureDirSync(config.workDir + '/keyringWallets');

    let keyring = JSON.parse(fs.readFileSync(program.generateWallets));
    for (let i in keyring) {
        if(keyring.hasOwnProperty(i)) {
            let wallet = new Wallet(config.workDir + '/keyringWallets/wallet' + i + '.json');
            wallet.enableLogging = false;
            wallet.keysPair = keyring[i];
            wallet.createId();
            wallet.update();
            wallet.save();
        }
    }

    console.log('Info: Wallets created');
    process.exit();
}


const blockchain = new Blockchain(config);
blockchain.start();

if(!program.fallOnErrors) {
    process.on('uncaughtException', function (err) {
        console.log('Uncaught exception: ' + err);
    });
}

