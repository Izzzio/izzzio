/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Instance and mutex storage - in process storage
 *
 */

const logger = new (require('./logger'))('InstanceStorage');

let storage = {};

module.exports = {
    /**
     * @deprecated
     * Put data to storage
     * @param {string} name
     * @param value
     */
    put: function (name, value) {
        storage[String(name)] = value;
    },

    /**
     * @deprecated
     * Get data from storage
     * @param {string} name
     * @return {*}
     */
    get: function (name) {

        logger.warning('instanceStorage deprecated and will be removed in new versions. Use NamedInstanceStorage instead');

        if(typeof name === 'undefined') {
            return storage;
        }

        if(typeof storage[String(name)] !== 'undefined') {
            return storage[String(name)];
        }

        return null;
    }
};

