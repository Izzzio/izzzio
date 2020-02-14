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
 * @return {{disable: boolean, log: log, write: write, info: info, error: error, fatal: fatal, init:init, warning: warning, fatalFall:fatalFall}}
 * @constructor
 */
function Logger(prefix) {
    return {
        disable: false,
        getPrefix: function () {
            if(typeof prefix === 'string') {
                return " " + prefix + ': '
            }
            return "";
        },
        log: function (type, data) {
            if(!this.disable) {
                return log(type, this.getPrefix() + data);
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
            if(typeof data.stack !== 'undefined') {
                data = data.stack;
            }
            return this.log('Error', data);
        },
        fatal: function (data) {
            if(typeof data.stack !== 'undefined') {
                data = data.stack;
            }
            return this.log('Fatal', data);
        },
        /**
         * Prints fatal error end exit with error code
         * @param {string} data
         */
        fatalFall: function (data) {
            this.fatal(data);
            process.exit(1);
        },
        warning: function (data) {
            if(typeof data.stack !== 'undefined') {
                data = data.stack;
            }
            return this.log('Warning', data);
        }
    };
}


module.exports = Logger;