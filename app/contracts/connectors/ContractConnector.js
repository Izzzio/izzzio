/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Simplify interactions with contracts
 */
class ContractConnector {
    /**
     *Simplify interactions with contracts
     * @param {EcmaContract} ecmaContract
     * @param address
     */
    constructor(ecmaContract, address) {
        this.ecmaContract = ecmaContract;
        this.address = address;
    }

    /**
     * Get property callback variant
     * @param property
     * @param cb
     */
    getProperty(property, cb) {
        this.ecmaContract.getContractProperty(this.address, property, cb);
    }

    /**
     * Get property promised
     * @param property
     * @return {Promise<*>}
     */
    getPropertyPromise(property) {
        let that = this;
        return new Promise(function (resolve, reject) {
            this.ecmaContract.getContractProperty(this.address, property, function (err, val) {
                if(!err) {
                    resolve(val);
                } else {
                    reject(err);
                }
            });
        })
    }

    /**
     * Register new method in ContractConnector. ContractConnector can calls only stateless methods
     * @param {string} method
     * @param {undefined|string} alias
     */
    registerMethod(method, alias) {
        let that = this;
        alias = typeof alias === undefined ? method : alias;
        this[alias] = function (...args) {
            return new Promise(function (resolve, reject) {
                that.ecmaContract.callContractMethodRollback(that.address, method, {}, function (err, val) {
                    if(err) {
                        reject(err);
                    } else {
                        resolve(val);
                    }
                }, ...args)
            });

        }
    }
}

module.exports = ContractConnector;