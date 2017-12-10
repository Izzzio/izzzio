/**
 iZ³ | Izzzio blockchain - https://izzz.io
 BitCoen project - https://bitcoen.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const electron = require('electron');
const {app, Menu, BrowserWindow, Tray} = electron;
//const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

let loaderWindow, walletWindow, trayIcon, core;

let rpcAddress = null;
if(process.argv.length > 1) {
    rpcAddress = process.argv[1];
}

function createLoaderWindow() {

    loaderWindow = new BrowserWindow({
        width: 600,
        height: 430,
        frame: false,
        show: false,
        icon: __dirname + '/Bitcoen.png',
        // titleBarStyle: 'hidden',
        // transparent: true
        webPreferences: {
            zoomFactor: 0.8,
        }
    });
    // loaderWindow.webContents.setZoomFactor(0.8);

    loaderWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()


    loaderWindow.on('closed', function () {
        loaderWindow = null
    });

    loaderWindow.webContents.on('did-finish-load', function () {
        loaderWindow.show();
        if(rpcAddress === null) {
            startCore();
        } else {
            createWalletWindow(rpcAddress);
        }
    });
}

app.on('ready', function () {
    let contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Wallet',
            click: function () {
                walletWindow.show();
            }
        },
        {type: 'separator'},
        {
            label: 'Quit',
            click() {
                app.isQuiting = true;
                process.exit();
            }
        }
    ]);
    trayIcon = new Tray(__dirname + (process.platform === 'linux' || process.platform === 'darwin' ? '/logo.png' : '/logo.ico'));
    trayIcon.setToolTip('Bitcoen Wallet');
    trayIcon.setContextMenu(contextMenu);
    trayIcon.on('click', function () {
        if(walletWindow.isVisible()) {
            return walletWindow.hide();
        }
        walletWindow.show();
    });
    createLoaderWindow();

});

app.on('window-all-closed', function () {
    if(process.platform !== 'darwin') {
        process.exit();
    }
});

app.on('activate', function () {
    if(loaderWindow === null) {
        createLoaderWindow()
    }


});


function createWalletWindow(address) {

    let width = process.platform === 'darwin' ? 840 : 970;
    let height = process.platform === 'darwin' ? 650 : 703;
    walletWindow = new BrowserWindow({
        width: width,
        height: height,
        show: false,
        icon: __dirname + '/Bitcoen.png',
        webPreferences: {
            zoomFactor: 0.8,
        }
    });

    walletWindow.webContents.on('did-finish-load', function () {
        setTimeout(function () {
            walletWindow.show();
            loaderWindow.close();
        }, 2000);
    });

    walletWindow.loadURL(address);

    // Open the DevTools.
    //walletWindow.webContents.openDevTools();


    walletWindow.on('closed', function () {
        walletWindow = null
    });

    walletWindow.on('close', function (event) {
        if(!app.isQuiting) {
            event.preventDefault();
            walletWindow.hide();
        }
        return false;
    });
}

function startCore() {
    const {spawn} = require('child_process');
    const fs = require('fs');
    let path = '../';
    if(!fs.existsSync('../main.js')) {
        path = process.platform === 'darwin' ? '../../../../core/' : '../core/';
    }
    core = spawn('node', ['main.js'], {cwd: path});

    core.stdout.on('data', (data) => {
        try {
            loaderWindow.webContents.send('log', String(data));
        } catch (e) {

        }
        console.log(String(data));
        detectCoreStarted(data);
    });

    core.stderr.on('data', (data) => {
        console.log(String(data));
    });

    core.on('close', (code) => {
        if(!app.isQuiting) {
            console.log(`Core exit code ${code}`);
            createLoaderWindow();
            walletWindow.close();
        }
    });

    function detectCoreStarted(data) {
        const detectionStr = 'Listening http on';
        data = String(data);
        if(data.indexOf(detectionStr) !== -1) {
            try {
                let server = data.split(detectionStr)[1].split("\n")[0].replace(':', '').trim();
                createWalletWindow('http://' + server);
            } catch (e) {
                createWalletWindow('http://localhost:3001');
            }
        }
    }
}


const template = [
    {
        label: 'Wallet',
        submenu: [
            {
                label: 'Create transaction',
                click() {
                    walletWindow.webContents.send('createTransaction', '');
                }
            },
            {type: 'separator'},
            {
                label: 'Quit',
                click() {
                    app.isQuiting = true;
                    core.kill('SIGINT');
                    setTimeout(function () {
                        process.exit(0);
                    }, 5000);

                }
            },
        ]
    },
    {
        label: 'Edit',
        submenu: [
            {role: 'undo'},
            {role: 'redo'},
            {type: 'separator'},
            {role: 'cut'},
            {role: 'copy'},
            {role: 'paste'},
            {role: 'delete'},
            {role: 'selectall'}
        ]
    },
    {
        label: 'View',
        submenu: [
            {role: 'reload'},
            {type: 'separator'},
            {role: 'resetzoom'},
            {role: 'zoomin'},
            {role: 'zoomout'},
            {type: 'separator'},
            {role: 'togglefullscreen'}
        ]
    },
    {
        role: 'window',
        submenu: [
            {role: 'minimize'},
            {role: 'close'}
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'BitCoen website',
                click() {
                    require('electron').shell.openExternal('http://bitcoen.io/')
                }
            },
            {
                label: 'Block Explorer',
                click() {
                    require('electron').shell.openExternal('http://explorer.bitcoen.io/')
                }
            },
            {type: 'separator'},
            {
                label: 'About BitCoen Wallet',
                click() {
                    let about = new BrowserWindow({
                        width: 500,
                        height: 500,
                        show: true,
                        icon: __dirname + '/Bitcoen.png',
                        webPreferences: {
                            zoomFactor: 0.8,
                        }
                    });
                    about.loadURL('https://wallet.bitcoen.io/');
                    about.setMenu(null);

                }
            },
            {
                label: 'About iZ³',
                click() {
                    require('electron').shell.openExternal('http://izzz.io/')
                }
            },
        ]
    }
];

if(process.platform === 'darwin') {
    template.unshift({
        label: app.getName(),
        submenu: [
            {role: 'about'},
            {type: 'separator'},
            {role: 'services', submenu: []},
            {type: 'separator'},
            {role: 'hide'},
            {role: 'hideothers'},
            {role: 'unhide'},
            {type: 'separator'},
            {role: 'quit'}
        ]
    });

    // Edit menu
    template[2].submenu.push(
        {type: 'separator'},
        {
            label: 'Speech',
            submenu: [
                {role: 'startspeaking'},
                {role: 'stopspeaking'}
            ]
        }
    );

    // Window menu
    template[4].submenu = [
        {role: 'close'},
        {role: 'minimize'},
        {role: 'zoom'},
        {type: 'separator'},
        {role: 'front'}
    ]
}

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

