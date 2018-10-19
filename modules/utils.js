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
    },
    /**
     * Преобразует 16 ричное число с длиной кратной 4 в строку символов UTF-8
     * @param str
     * @return {*}
     */
    hexString2Unicode: function (str) {
        if(str.length % 4 !== 0){
            return false;
        }
        str = str.toLowerCase();
        let code = '';
        str = str.match(/.{1,4}/g);
        for(let s of str){
            if(s.length === 4) {
                code += String.fromCharCode(parseInt(s, 16));
            }else{
                code += s;
            }
        }
        return code;
    },
    /**
     * Преобразует строку UTF-8 в строку с 16 ричным числом
     * @param uniStr
     * @return {string}
     */
    unicode2HexString: function (uniStr) {
        let str = '';
        for(let i = 0; i<uniStr.length; i++){
            str += uniStr.charCodeAt(i).toString(16);
        }
        return str;
    }
};