/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


function log(type, log) {
    let message = type + ': ' + log;
    console.log((new Date()).toUTCString() + ' ' + message);
    return message;
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
                return log(type, data);
            }
            return '';
        },
        write: function (data) {
            return this.log('Info', data);
        },
        info: function (data) {
            return this.log('Info', data);
        },
        init: function (data) {
            return this.log('Init', data);
        },
        autofix: function (data) {
            return this.log('Autofix', data);
        },
        error: function (data) {
            return this.log('Error', data);
        },
        fatal: function (data) {
            return this.log('Fatal', data);
        },
        warning: function (data) {
            return this.log('Warning', data);
        }
    };
}


module.exports = Logger;