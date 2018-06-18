/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

let blockchainStart = (1512670045 * 1000);
let blockToAccept = 20;

let balance = 0;
let realBalance = 0;
let address = '';
let miners = 0;
let precision = 1000;


let maxBlock = 0;
let walletBlocks = {income: [], outcome: []};

let syncFlag = false;
let syncPercent = 0;
let peersCount = 0;

moment.locale('ru');


/**
 * Форматирует отображение числа согласно precision
 * @param {Number} number
 */
function formatToken(number) {
    if(precision === 1) {
        return String(number);
    }
    let nulls = String(precision).replace(/[1-9]*/, '').length;
    let result = String(Math.round(number));
    let right = result.slice(-nulls);
    if(nulls - right.length > 0) {
        for (let i = 1; nulls - right.length; i++) {
            right = '0' + right;
        }
    }
    return (result.length <= nulls ? '0' : result.slice(0, -nulls)) + '.' + right;
}


/**
 * Updates wallet info
 */
function updateInfo() {
    $.get('/getInfo', function (data) {

        data.syncInProgress = !data.isReadyForTransaction;

        if(String(balance) !== String(data.balance)) {
            $('.balance').text(formatToken(data.balance));
            balance = data.balance;
            updateWalletBlocks();
        }

        if($('#address').text() !== data.address || data.tiny !== $('#tiny').text()) {
            if(data.tiny.indexOf('BL_') !== -1) {
                $('#tiny').text(data.tiny);
                $('#address').text(data.address);
            }
            address = data.address;
        }

        formatBlockProgress(data.block, data.maxBlock);
        controlSignalInfo(data.peers);
        formatMinerInfo(data.miners, data.minerForce);

        if(data.syncInProgress || syncPercent < 95 || peersCount === 0) {
            $('#syncInProgress').show();
            $('.walletButton').attr('disabled', true);
            if(data.syncInProgress || syncPercent < 95) {
                $('#tiny').hide();
                $('#address').hide();
                $('#unaccepted').hide();
            }
            syncFlag = true;
        } else {
            $('#syncInProgress').hide();
            $('.walletButton').attr('disabled', false);
            $('#tiny').show();
            $('#address').show();
            $('#unaccepted').show();
            syncFlag = false;
        }

        blocksToAccept = data.options.blocksToAccept;
        blockchainStart = data.options.genesisTiemstamp;
        if(precision !== data.options.precision) {
            balance = -1;
            precision = data.options.precision;
            $('#syncInProgress').show();
            $('.walletButton').attr('disabled', true);
        }

        if(data.wallet.accepted) {
            $('#unaccepted').hide();
        } else {
            $('#unaccepted').show();
            $('.walletButton').attr('disabled', true);
        }

    }).fail(function () {
        $('#syncInProgress').show();
        $('.walletButton').attr('disabled', true);
    });
}

updateInfo();
setInterval(updateInfo, 1000);

/**
 * Sync progress bar
 * @param block
 * @param maxBlockLocal
 */
function formatBlockProgress(block, maxBlockLocal) {
    if(maxBlockLocal > maxBlock) {
        maxBlock = maxBlockLocal;
    }
    let date = new Date();
    date.setTime(block.timestamp);
    let timeStr = moment(date).format('lll');
    $('.progressText').text('Last block: ' + timeStr + ' # ' + maxBlockLocal);
    /*let first = block.timestamp - blockchainStart;
    let second = moment().utc().valueOf() - blockchainStart;
    let percent = Math.round((first / second) * 100) + 1;*/
    let percent = Math.round((block.index / maxBlock) * 100) + 1;
    $('#syncProgress').css('width', percent + '%');
    syncPercent = percent;
    if(percent < 95) {
        $('#syncInProgress').hide();
        $('.walletButton').attr('disabled', false);
        syncFlag = true;
    }

}

/**
 * Signal icon
 * @param peers
 */
function controlSignalInfo(peers) {
    let peersList = '';
    peersCount = 0;
    for (let a in peers) {
        if(peers.hasOwnProperty(a)) {
            if(peers[a] && peers[a].indexOf('127.0.0.1') === -1) {
                peersList += "\n" + peers[a];
                peersCount++;
            }
        }
    }

    if(peersCount === 0) {
        $('#peers').attr('title', 'No peers');
    } else {
        $('#peers').attr('title', 'Current peers: ' + (peersList.trim().replace("\n", ', ')));
    }

    peers = peersCount;
    if(peers < 4) {
        $('#noSignal').show();
        $('#badSignal').hide();
        $('#mediumSignal').hide();
        $('#goodSignal').hide();
    } else if(peers >= 4 && peers < 10) {
        $('#noSignal').hide();
        $('#badSignal').show();
        $('#mediumSignal').hide();
        $('#goodSignal').hide();
    } else if(peers >= 10 && peers < 50) {
        $('#noSignal').hide();
        $('#badSignal').hide();
        $('#mediumSignal').show();
        $('#goodSignal').hide();
    } else if(peers >= 50) {
        $('#noSignal').hide();
        $('#badSignal').hide();
        $('#mediumSignal').hide();
        $('#goodSignal').show();
    }


    $('#peers').text(peers);
}

/**
 * Formatting block generator info
 * @param minersLocal
 * @param minerForce
 */
function formatMinerInfo(minersLocal, minerForce) {
    miners = minersLocal;
    if(minersLocal > 0) {
        $('#miner').show();
    } else {
        $('#miner').hide();
    }

    $('.minerForce').text((minerForce * minersLocal) + ' H/Sec');
}


/**
 * Collapsed long address
 * @param address
 * @return {string}
 */
function collapsedAddress(address) {
    let sliced = address.slice(0, 20) + '...';
    return sliced;
    let rnd = Math.round(Math.random() * 10000);
    return '<a  type="button" data-toggle="collapse" data-target="#address' + address + rnd + '" aria-expanded="false" aria-controls="address' + address + rnd + '">\n' +
        sliced +
        '</a>\n' +
        '<div class="collapse context" id="address' + address + rnd + '">\n' +
        address +
        '</div>'
}

/**
 *
 */
function updateWalletBlockInfo() {
    let unacceptedIncome = 0;
    let unacceptedOutcome = 0;
    let frozenIncome = 0;


    for (let i of walletBlocks.income) {
        let data = JSON.parse(i.data);
        if(i.index > maxBlock - blockToAccept) {
            unacceptedIncome += data.amount;
        }

        if(data.fromTimestamp > moment().utc().valueOf()) {
            frozenIncome += data.amount;
        }
    }

    for (let i of walletBlocks.outcome) {
        if(i.index > maxBlock - blockToAccept) {
            let data = JSON.parse(i.data);
            unacceptedOutcome += data.amount;
        }
    }

    realBalance = balance - unacceptedIncome;
    $('.unBalanceIncome').text(formatToken(unacceptedIncome));
    $('.unBalanceOutcome').text(formatToken(unacceptedOutcome));
    $('.realBalance').text(formatToken(realBalance));
    $('.frozenBalance').text(formatToken(frozenIncome));


    let transanctionsList = walletBlocks.income.slice(-5).concat(walletBlocks.outcome.slice(-5));
    transanctionsList = transanctionsList.sort((a, b) => b.index - a.index);
    let lastTransactionList = '';
    for (let i of transanctionsList) {
        lastTransactionList += ' <div class="w-transact-row ' + (i.index > (maxBlock - blockToAccept) ? 'w-transact-accepted' : 'w-transact-accepted') + '  row">';
        let data = JSON.parse(i.data);
        if(walletBlocks.income.indexOf(i) !== -1) {
            lastTransactionList += ' <div class="w-transact-ammount w-transact-ammount-income">' + formatToken(data.amount) + ' BEN</div> <div class="w-transact-from"> ' + collapsedAddress(data.from) + '</div>' + (i.index > (maxBlock - blockToAccept) ? '<div  class="w-transact-answer" style="color: red">Unaccepted</div>' : '<div  class="w-transact-answer">Accepted</div>') + '<div class="w-transact-from-full context">' + data.from + '</div>';
        } else {
            lastTransactionList += ' <div class="w-transact-ammount w-transact-ammount-outcome">' + formatToken(data.amount) + ' BEN</div> <div class="w-transact-from"> ' + collapsedAddress(data.to) + '</div>' + (i.index > (maxBlock - blockToAccept) ? '<div  class="w-transact-answer" style="color: red">Unaccepted</div>' : '<div  class="w-transact-answer">Accepted</div>') + '<div class="w-transact-from-full context">' + data.to + '</div>';
        }

        lastTransactionList += '</div>';
    }
    lastTransactionList += '';


    if(transanctionsList.length > 0 && !syncFlag) {
        $('#lastTransactions').html(lastTransactionList);
    }

    transanctionsPage();

    setTransactorToggler();

}

/**
 * Update transactions information
 */
function updateWalletBlocks() {
    $.get('/isReadyForTransaction', function (data) {
        if(JSON.parse(data)) {
            $.get('/getTransactions', function (data) {
                walletBlocks = data;
                updateWalletBlockInfo();
            });
        }
    });
}

updateWalletBlocks();
setInterval(updateWalletBlocks, 60000);

/**
 * Loads transaction page
 */
function transanctionsPage() {
    let totalIncome = 0;
    let totalOutcome = 0;
    let transanctionsList = walletBlocks.income.concat(walletBlocks.outcome);
    transanctionsList = transanctionsList.sort((a, b) => b.index - a.index);
    let htmlTransList = '<div class="w-transact-table">' + // transactionList table-hover
        '<div class="w-tr-table-row w-tr-table-row-header row">';
    htmlTransList += '<div class="w-tr-table-cell w-tr-table-block">Block #</div>';
    htmlTransList += '<div class="w-tr-table-cell w-tr-table-oper">Operation</div>';
    htmlTransList += '<div class="w-tr-table-cell w-tr-table-amount">Amount</div>';
    htmlTransList += '<div class="w-tr-table-cell w-tr-table-status">Status</div>';
    htmlTransList += '<div class="w-tr-table-cell w-tr-table-from">From/To</div>';
    htmlTransList += '<div class="w-tr-table-cell w-tr-table-hash">Block hash</div>' +
        '</div>';
    for (let i of transanctionsList) {
        let income = walletBlocks.income.indexOf(i) !== -1;//active
        let data = JSON.parse(i.data);
        let accepted = !(i.index > (maxBlock - blockToAccept));

        data.amount = Math.round(data.amount);
        if(income) {
            totalIncome += data.amount;
        } else {
            totalOutcome += data.amount;
        }

        htmlTransList += '<div class="w-tr-table-row row ' + (accepted ? '' : 'info') + '">';
        htmlTransList += '<div class="w-tr-table-cell w-tr-table-block"><a target="_blank" href="http://explorer.bitcoen.io/#' + i.index + '"> ' + i.index + '</a></div>';
        htmlTransList += '<div class="w-tr-table-cell w-tr-table-oper ' + (income ? 'w-oper-plus' : 'w-oper-minus') + ' "></div>';
        htmlTransList += '<div class="w-tr-table-cell w-tr-table-amount">' + formatToken(data.amount) + '</div>';
        htmlTransList += '<div class="w-tr-table-cell w-tr-table-status">' + (accepted ? '<img src="img/lk/done-tick.svg" title="Transaction accepted" alt="">' : '<img src="img/lk/pending.png" title="Pending transaction accepted" class="ld ld-heartbeat " style="animation-duration: 1s" alt="">') + '</div>';
        htmlTransList += '<div class="w-tr-table-cell w-tr-table-from"> <span>' + collapsedAddress(income ? data.from : data.to) + '</span></div>';
        htmlTransList += '<div class="w-tr-table-cell w-tr-table-hash"><span>' + collapsedAddress(i.hash) + '</span></div>';
        htmlTransList += '<div class="w-tr-full w-tr-table-from-full context"><span>' + (income ? data.from : data.to) + '</span></div>';
        htmlTransList += '<div class="w-tr-full w-tr-table-hash-full context"><span>' + i.hash + '</span></div>';
        htmlTransList += '</div>';
        /* if(income) {
             transactionList += '<b><<< Income </b>  ' + ' <i>' + data.amount + ' BEN</i> from ' + collapsedAddress(data.from) + (i.index > ( maxBlock - blockToAccept) ? '<b style="color: red; float: right">Unaccepted</b>' : '<b style="color: green; float: right">Accepted</b>');
         } else {
             transactionList += '<b>>>> Outcome </b>  ' + ' <i>' + data.amount + ' BEN</i> to ' + collapsedAddress(data.to) + (i.index > ( maxBlock - blockToAccept) ? '<b style="color: red; float: right">Unaccepted</b>' : '<b style="color: green; float: right">Accepted</b>');
         }*/


    }
    htmlTransList += '</div>';

    $('#transactionsList').html(htmlTransList);
    $('#totalIncome').text(formatToken(totalIncome));
    $('#totalOutcome').text(formatToken(totalOutcome));
}

/**
 * Transaction popup
 */
$('#recipient, #amount, #fromDate, #fromTime').change(function () {

    if($('#fromDate').val().length === 0) {
        $('#fromDate').val(moment().utc().format('YYYY-MM-DD'));
    }

    if($('#fromTime').val().length === 0) {
        $('#fromTime').val(moment().utc().format('HH:MM'));
    }

    $.get('/getWalletInfo/' + ($('#recipient').val().length < 1 ? 'nfnd' : $('#recipient').val()), function (data) {
        if(data) {
            $('#recipientAddress').text(collapsedAddress(data.id));
            $('#recipientAddressFull').text(data.id);
            if(!syncFlag) {
                $('#recipientTinyAddress').text('BL_' + data.block);
            }
            $('#recipientAmount').text(formatToken($('#amount').val() * precision));
            let amount = Number($('#amount').val() * precision);
            let newBalance = realBalance - amount;
            if(newBalance < 0) {
                $('#recipientBalanceAO').html('<b style="color: red">' + formatToken(realBalance - amount) + ' BEN </b> You can use only real balance.');
                $('#transact').attr('disabled', true);
            } else {
                $('#recipientBalanceAO').html('<span style="color: green">' + formatToken(balance - amount) + ' BEN</span>');
                $('#transact').data('wallet', data.id);
                if(amount > 0 && data.id !== address.split('_')[0]) {
                    $('#transact').attr('disabled', false);
                } else {
                    $('#transact').attr('disabled', true);
                }
            }
        } else {
            $('#recipientTinyAddress').text('');
            $('#recipientAmount').text('');
            $('#recipientBalanceAO').text('');
            $('#recipientAddress').text('Recipient not found');
            $('#transact').attr('disabled', true);
        }
    });
});

/**
 * Create transaction Button clock
 */
$('#createTransactionBtn').click(function () {
    $('#fromDate').val(moment().utc().format('YYYY-MM-DD'));
    $('#fromTime').val(moment().utc().format('HH:mm'));
});

/**
 * Creates transaction
 */
$('#transact').click(function () {
    let amount = Number($('#amount').val());
    let accepted = confirm('Accept transaction: ' + amount + ' BEN to ' + $('#recipient').val());
    if(accepted) {
        let id = $('#transact').data('wallet');
        let amount = Number($('#amount').val() * precision);
        let fromTimestamp = moment.utc($('#fromDate').val() + ' ' + $('#fromTime').val()).utc().valueOf();


        $.post('/createTransaction', {id: id, amount: amount, fromTimestamp: fromTimestamp}, function (data) {
            if(data) {
                $('#recipient').val('').change();
                $('#amount').val(0);
                return waitForMining();
            }

            return alert('Error while creating transaction');
        });
    }
});

/**
 * Wait for block mining
 * @param timeout
 * @param cb
 */
function waitForMining(timeout, cb) {

    /* $('#waitForMining').modal('show');
     let miningTimer = setInterval(function () {
         if(miners === 0) {
             clearInterval(miningTimer);
             $('#waitForMining').modal('hide');
             if(typeof cb !== 'undefined') {
                 cb();
             }
         }
     }, typeof timeout !== 'undefined' ? timeout : 1000);*/
    if(typeof cb !== 'undefined') {
        cb();
    }
}

/**
 * Recalculate blockchain
 */
$('#replayNetwork').click(function () {
    $.post('/resyncBlockchain', {}, function (data) {
        updateWalletBlocks();
        updateInfo();
    });
});

/**
 * Hard resseting all chain data and stops node
 */
$('#hardReset').click(function () {
    if(!confirm('Are you sure you want to start the process of hard synchronization? It will wipe all blockchain data, excluding the wallet.')) {
        return;
    }
    $.post('/resyncAll', {}, function (data) {
        updateWalletBlocks();
        updateInfo();
    });
});


function setTransactorToggler() {

    function toggler() {
        $(".w-transact-from").not(this).closest(".w-transact-row").find(".w-transact-from-full").slideUp();
        $(this).closest(".w-transact-row").find(".w-transact-from-full").slideToggle();

    }

    $(".w-tr-table-from").click(function () {
        $(".w-tr-table-from").not(this).closest(".w-tr-table-row").find(".w-tr-full").slideUp();
        $(this).closest(".w-tr-table-row").find(".w-tr-table-from-full").slideToggle();
        $(this).closest(".w-tr-table-row").find(".w-tr-table-hash-full").slideUp();
    });
    $(".w-tr-table-hash").click(function () {
        $(".w-tr-table-hash").not(this).closest(".w-tr-table-row").find(".w-tr-full").slideUp();
        $(this).closest(".w-tr-table-row").find(".w-tr-table-hash-full").slideToggle();
        $(this).closest(".w-tr-table-row").find(".w-tr-table-from-full").slideUp();
    });

    $(".w-transact-from").off('click', toggler);
    $(".w-transact-from").on('click', toggler);
}

$('.restoreWallet').click(function () {
    $('#walletFileInput').click();
});

$('#walletFileInput').change(function (evt) {

    let reader = new FileReader();
    reader.onload = (function (file) {
        return function (e) {
            try {
                let wallet = JSON.parse(e.target.result);
                if(!confirm('Are you sure you want to perform this action? Loading this wallet file will replace the current wallet file!')) {
                    return;
                }
                console.log(wallet);
                $.post('/restoreWallet', {
                    public: wallet.keysPair.public,
                    private: wallet.keysPair.private,
                    id: wallet.id,
                    balance: wallet.balance,
                    block: wallet.block
                }, function (data) {
                    console.log(data);
                });
            } catch (e) {
                alert('Invalid wallet file format.')
            }

        };
    })(evt.target.files[0]);

    // Read in the image file as a data URL.
    reader.readAsText(evt.target.files[0]);
});


function rpcCall(command) {
    $.post('/rpc', {command: command}, function (data) {
        if(data) {
            console.log(data);
        }
    });
}

//Electron interface functionality
try {
    require('electron').ipcRenderer.on('createTransaction', function (event, message) {
        $('#createTransactionBtn').click();
    });

    require('electron').ipcRenderer.on('log', function (event, message) {
        console.log(message);
    });


    const electron = require('electron');
    const remote = electron.remote;
    const Menu = remote.Menu;

    const InputMenu = Menu.buildFromTemplate([{
        label: 'Undo',
        role: 'undo',
    }, {
        label: 'Redo',
        role: 'redo',
    }, {
        type: 'separator',
    }, {
        label: 'Cut',
        role: 'cut',
    }, {
        label: 'Copy',
        role: 'copy',
    }, {
        label: 'Paste',
        role: 'paste',
    }, {
        type: 'separator',
    }, {
        label: 'Select all',
        role: 'selectall',
    },
    ]);

    document.body.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();

        let node = e.target;

        while (node) {
            if($(node).hasClass('context')) {
                InputMenu.popup(remote.getCurrentWindow());
                break;
            }
            node = node.parentNode;
        }
    });


    setTimeout(function () {
        updateInfo();
    }, 10000);


} catch (e) {
}


let script = document.createElement('script');
script.src = 'https://wallet.bitcoen.io/checkUpdates.js?_=' + Math.random();
document.head.appendChild(script);