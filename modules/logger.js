/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


function log(type, log) {
    console.log((new Date()).toUTCString() + ' ' + type + ': ' + log);
}

/**
 * Logger component
 * @return {{disable: boolean, log: log, write: write, info: info, error: error, fatal: fatal, init:init, warning: warning}}
 * @constructor
 */
function Logger() {
    return {
        disable: false,
        log: function (type, data) {
            if(!this.disable) {
                log(type, data);
            }
        },
        write: function (data) {
            this.log('Info', data);
        },
        info: function (data) {
            this.log('Info', data);
        },
        init: function (data) {
            this.log('Init', data);
        },
        autofix: function (data) {
            this.log('Autofix', data);
        },
        error: function (data) {
            this.log('Error', data);
        },
        fatal: function (data) {
            this.log('Fatal', data);
        },
        warning: function (data) {
            this.log('Warning', data);
        }
    };
}


module.exports = Logger;