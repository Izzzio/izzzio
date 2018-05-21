/**
 iZ³ | Izzzio blockchain - https://izzz.io
 BitCoen project - https://bitcoen.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const electron = require('electron');
const {app, Menu, BrowserWindow, Tray, dialog, shell} = electron;
//const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

let loaderWindow, walletWindow, trayIcon, core;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

let rpcAddress = null;
if(process.argv.length > 1) {
    rpcAddress = process.argv[1];
}

let shouldQuit = app.makeSingleInstance(function (commandLine, workingDirectory) {
    if(walletWindow) {
        walletWindow.show();
    }
});
if(shouldQuit) {
    app.quit();
    return;
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
                if(app.isQuiting) {
                    return;
                }
                if(walletWindow) {
                    walletWindow.show();
                } else {
                    if(loaderWindow) {
                        loaderWindow.show()
                    }
                }
            }
        },
        {
            label: 'Show data dir',
            click: function () {
                shell.showItemInFolder(app.getPath('userData'));
            }
        },
        {type: 'separator'},
        {
            label: 'Quit',
            click() {
                try {

                    app.isQuiting = true;
                    walletWindow.hide();
                    core.kill('SIGINT');
                    setTimeout(function () {
                        process.exit(0);
                    }, 5000);
                } catch (e) {
                    process.exit(0);
                }
            }
        }
    ]);
    trayIcon = new Tray(__dirname + (process.platform === 'linux' || process.platform === 'darwin' ? '/tray.png' : '/logo.ico'));
    trayIcon.setToolTip('Bitcoen Wallet');
    trayIcon.setContextMenu(contextMenu);
    trayIcon.on('click', function () {
        if(app.isQuiting) {
            return;
        }
        if(walletWindow && walletWindow.isVisible()) {
            return walletWindow.hide();
        }
        if(walletWindow) {
            walletWindow.show();
        } else if(loaderWindow) {
            loaderWindow.show()
        }


    });
    createLoaderWindow();

});

app.on('window-all-closed', function () {
    if(process.platform !== 'darwin') {
        process.exit();
    }
});

if(process.platform === 'darwin') {
    app.on('before-quit', function () {
        app.isQuiting = true;
        if(walletWindow) {
            walletWindow.hide();
        }
        core.kill('SIGINT');
        setTimeout(function () {
            process.exit(0);
        }, 5000);
    });
}

app.on('activate', function () {
    if(loaderWindow === null && walletWindow === null) {
        createLoaderWindow()
    } else {
        if(walletWindow && !app.isQuiting) {
            walletWindow.show();
        }
    }
});

/**
 * Creates wallet window
 * @param {string} address
 */
function createWalletWindow(address) {

    let width = process.platform === 'darwin' ? 840 : 860;
    let height = process.platform === 'darwin' ? 650 : 650;
    walletWindow = new BrowserWindow({
        width: width,
        height: height,
        show: false,
        icon: __dirname + '/Bitcoen.png',
        webPreferences: {
            zoomFactor: 0.8,
        }
    });

    walletWindow.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        const win = new BrowserWindow({
            show: false,
            width: 1024,
            height: 768,
        });
        win.setMenu(null);
        win.once('ready-to-show', () => win.show());
        win.loadURL(url);
        event.newGuest = win;
    });


    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    walletWindow.webContents.on('did-finish-load', function () {
        setTimeout(function () {
            try {
                walletWindow.show();
                loaderWindow.close();
            } catch (e) {
            }
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
        path = process.platform === 'darwin' ? __dirname + '/core/' : '../core/';
    }

    if(process.platform === 'darwin') {
        try {
            if(loaderWindow) {
                loaderWindow.webContents.send('log', '<b>If you are using a Mac and this message shows too long, try restarting the wallet.</b>');
            }
        } catch (e) {

        }
    }

    core = spawn('./node', ['main.js', '--autofix', '--work-dir', '--verbose', app.getPath('userData'), '--http-port', getRandomInt(3000, 6000)], {cwd: path});

    core.on('error', (code) => {
        dialog.showErrorBox('Core starting error',
            code + (process.platform === 'darwin' ? "\nIf you are using a Mac, try restarting the wallet." : '')
        );
        process.exit(1);
    });

    core.stdout.on('data', (data) => {
        try {
            if(loaderWindow) {
                loaderWindow.webContents.send('log', String(data));
            }
        } catch (e) {

        }

        try {
            if(walletWindow) {
                walletWindow.webContents.send('log', String(data));
            }
        } catch (e) {

        }
        console.log(String(data));
        detectCoreStarted(data);

        if(String(data).indexOf('>>> Incoming transaction from') !== -1 && trayIcon) {
            try {
                trayIcon.displayBalloon({
                    title: 'Income transaction',
                    content: 'Income transaction ' + (String(data).split('amount')[1].split("\n")[0].replace('(unaccepted)', '').trim()) + ' BEN'
                });
            } catch (e) {
            }
        }

    });

    core.stderr.on('data', (data) => {
        console.log(String(data));
        try {
            if(walletWindow) {
                walletWindow.webContents.send('log', String(data));
            }
        } catch (e) {

        }
    });

    core.on('close', (code) => {
        if(!app.isQuiting) {
            console.log(`Core exit code ${code}`);
            if(!loaderWindow) {
                createLoaderWindow();
            }
            try {
                walletWindow.close();
            } catch (e) {
            }
        }
    });

    function detectCoreStarted(data) {
        const detectionStr = 'Listening http on';
        data = String(data);
        if(data.indexOf(detectionStr) !== -1) {
            try {
                let server = data.split(detectionStr)[1].split("\n")[0].replace(':', '').trim();
                let password = server.split('@')[1];
                server = server.split('@')[0];

                app.on('login', function (event, webContents, request, authInfo, callback) {
                    event.preventDefault();
                    try {
                        callback(password, password);
                    } catch (e) {
                    }
                });

                createWalletWindow('http://' + server);
            } catch (e) {
                createWalletWindow('http://localhost:3001');
            }
        }

        if(data.indexOf("EADDRINUSE 127.0.0.1") !== -1) {
            app.isQuiting = true;
            try {
                core.kill('SIGINT');
            } catch (e) {

            }
            dialog.showErrorBox('Core starting error',
                'The core can not be started. Interface binding address is already in use.'
            );
            setTimeout(function () {
                process.exit(1);
            }, 2000);
        }
    }
}


const menuTemplate = [
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
                    walletWindow.hide();
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
                label: 'DevTools',
                click() {
                    walletWindow.webContents.openDevTools();
                }
            },
            {
                label: 'BitCoen website',
                click() {
                    require('electron').shell.openExternal('http://bitcoen.io/')
                }
            },
            {
                label: 'Block Explorer',
                click() {
                    let about = new BrowserWindow({
                        width: 1024,
                        height: 768,
                        show: true,
                        icon: __dirname + '/Bitcoen.png',
                        webPreferences: {
                            zoomFactor: 0.8,
                        }
                    });
                    about.loadURL('http://explorer.bitcoen.io/');
                    //about.webContents.openDevTools();
                    about.setMenu(null);
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




