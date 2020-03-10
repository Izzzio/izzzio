/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const KeyValue = require('../keyvalue');

/**
 * Transactional key-value DB
 */
class TransactionalKeyValue {
    constructor(name, config) {
        /**
         * Содержит в себе транзакции, готовые к записи
         * @type {{}}
         */
        this.transactions = {};

        /**
         * Хранилище значений
         * @type {KeyValue}
         */
        this.db = new KeyValue(name, config);
    }

    /**
     * Получает данные из хранилища. Если есть не сохранённые данные, возвращает из них
     * @param {string} key
     * @param {Function} callback
     */
    get(key, callback = () => {
    }) {
        if(typeof this.transactions[key] !== 'undefined') {
            if(this.transactions[key] !== null) {
                callback(null, this.transactions[key]);
            } else {
                callback(true);
            }
        } else {
            this.db.get(key, function (err, val) {
                if(!err) {
                    callback(err, val.toString());
                } else {
                    callback(err);
                }
            });
        }
    }

    /**
     * Сохраняет данные во временное транзакционное хранилище
     * @param {string} key
     * @param {string} value
     * @param {Function} callback
     */
    put(key, value, callback = () => {
    }) {
        this.transactions[key] = String(value);
        callback(null);
    }

    /**
     * Сохраняет в транзакционное хранилище информацию об удалении значения
     * @param key
     * @param callback
     */
    del(key, callback = () => {
    }) {
        this.transactions[key] = null;
        callback(null);
    }

    /**
     * Сброс очереди транзакций
     * @param callback
     */
    rollback(callback = () => {
    }) {
        this.transactions = {};
        callback(null);
    }

    /**
     * Запись данных транзакций в БД
     * @param callback
     */
    deploy(callback = () => {
    }) {
        let that = this;

        function delPromised(key) {
            return new Promise(function (resolve) {
                that.db.del(key, function () {
                    resolve(true);
                })
            });
        }

        function putPromised(key, value) {
            return new Promise(function (resolve) {
                that.db.put(key, value, function () {
                    resolve(true);
                })
            });
        }

        async function deployAll() {
            for (let a in that.transactions) {
                if(that.transactions.hasOwnProperty(a)) {
                    if(that.transactions[a] === null) {
                        await delPromised(a);
                    } else {
                        await putPromised(a, that.transactions[a]);
                    }
                }
            }

            that.rollback(function () {
                callback(true);
            });

        }

        deployAll();
    }

    /**
     * Save DB. Saves only deployed data
     * @param cb
     */
    save(cb) {
        return this.db.save(cb);
    }

    /**
     * Clear DB
     * @param cb
     */
    clear(cb) {
        this.transactions = {};
        return this.db.clear(cb);
    }

    close(cb){
        this.transactions = {};
        return this.db.close(cb);
    }
}

module.exports = TransactionalKeyValue;