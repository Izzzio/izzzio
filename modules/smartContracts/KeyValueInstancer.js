/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Make sub key-value DB in other key-value DB. Works with KeyValue, TransactionalKeyValue and with itself
 */
class KeyValueInstancer {
    /**
     *
     * @param {KeyValue|KeyValueInstancer|TransactionalKeyValue} dbInstance
     * @param {string} namespace
     */
    constructor(dbInstance, namespace) {
        this.namespace = namespace;
        this.db = dbInstance;
    }

    /**
     * Converts key to namespace key
     * @param key
     * @return {string}
     * @private
     */
    _keyToInstanceKey(key) {
        return this.namespace + '.' + key;
    }

    /**
     * Put data
     * @param {string} key
     * @param {string} value
     * @param {Function} callback
     * @return {*|void}
     */
    put(key, value, callback) {
        return this.db.put(this._keyToInstanceKey(key), value, callback);
    }

    /**
     * Get data
     * @param {string} key
     * @param {Function} callback
     * @return {*|void}
     */
    get(key, callback) {
        return this.db.get(this._keyToInstanceKey(key), callback);
    }

    /**
     * Remove data
     * @param {string} key
     * @param {Function} callback
     * @return {*|void}
     */
    del(key, callback) {
        return this.db.del(this._keyToInstanceKey(key), callback);
    }

    /**
     * Deploy. Only for TransactionalKeyValue
     * @param callback
     * @return {*|void}
     */
    deploy(callback) {
        return this.db.deploy(callback);
    }

    /**
     * Rollback only for TransactionalKeyValue
     * @param callback
     * @return {*|void}
     */
    rollback(callback) {
        return this.db.deploy(callback);
    }

    /**
     * Get undeployed transactions. Only for TransactionalKeyValue
     * @return {*|{}}
     */
    get transactions(){
        return this.db.transactions;
    }
}

module.exports = KeyValueInstancer;