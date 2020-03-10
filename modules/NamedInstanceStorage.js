/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Instance and mutex storage - in process storage
 */


let storage = {};

class NamedInstanceStorage {

    /**
     * Creates named instance storage
     * @param {string|undefined} subInstance
     */
    constructor(subInstance) {
        if(subInstance) {
            this.assign(subInstance);
        }
    }

    /**
     * Assign named instance storage to name
     * @param {string} subInstance
     */
    assign(subInstance) {
        this.subInstance = subInstance;
        if(!storage[this.subInstance]) {
            storage[this.subInstance] = {};
        }
    }

    /**
     * Returns instance
     * @param {string} name - instance name
     * @param {*} defaultValue - default get value
     * @returns {*}
     */
    get(name, defaultValue = null) {

        if(!this.subInstance) {
            throw new Error('Instance storage not initialized');
        }

        if(typeof name === 'undefined') {
            return storage[this.subInstance];
        }

        if(typeof storage[this.subInstance][String(name)] !== 'undefined') {
            return storage[this.subInstance][String(name)];
        }

        return defaultValue;
    }

    /**
     * Saves instance in storage
     * @param {string} name
     * @param {*} value
     */
    put(name, value) {
        if(!this.subInstance) {
            throw new Error('Instance storage not initialized');
        }

        storage[this.subInstance][String(name)] = value;
    }

    /**
     * Clears current instance storage
     */
    clear() {
        if(!this.subInstance) {
            throw new Error('Instance storage not initialized');
        }

        storage[this.subInstance] = {};
    }
}

module.exports = NamedInstanceStorage;

