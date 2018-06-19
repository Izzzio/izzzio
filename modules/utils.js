/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const storj = require('./instanceStorage');

const waitForSyncDelay = 100;

module.exports = {
    /**
     * Wait for blockchsin synchronization ends
     * @param callback
     */
    waitForSync: function (callback) {
        function waitForSync() {
            if(!storj.get('blockchainObject').isReadyForTransaction()) {
                setTimeout(function () {
                    waitForSync();
                }, waitForSyncDelay);
                return;
            }

            callback();
        }

        setTimeout(function () {
            waitForSync();
        }, 10);
    }
};