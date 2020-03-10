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
     * @param {string} address
     * @param {string|boolean} accountName
     */
    constructor(ecmaContract, address, accountName = false) {
        this.ecmaContract = ecmaContract;

        //Assign named storage
        this.namedStorage = new (require('../../NamedInstanceStorage'))(this.ecmaContract.config.instanceId);

        this.address = address;
        this.blockchain = this.namedStorage.get('blockchainObject');
        this.state = {};
        this.accountName = accountName;

        /**
         * @var{AccountManager}
         */
        this.accountManager = this.namedStorage.get('accountManager');
    }

    /**
     * Get property callback variant
     * @param property
     * @param cb
     */
    getProperty(property, cb) {
        this.ecmaContract.getContractProperty(this.address, 'contract.' + property, cb);
    }

    /**
     * Get property promised
     * @param property
     * @return {Promise<*>}
     */
    getPropertyPromise(property) {
        let that = this;
        return new Promise(function (resolve, reject) {
            that.ecmaContract.getContractProperty(that.address, 'contract.' + property, function (err, val) {
                if(!err) {
                    resolve(val);
                } else {
                    reject(err);
                }
            });
        })
    }

    /**
     * Change state params
     * @param state
     */
    setState(state) {
        this.state = state;
    }

    /**
     * Get current state
     * @return {{}|*}
     * @private
     */
    async _getState() {
        let that = this;
        let state = this.state;
        let wallet = await this.accountManager.getAccountAsync(this.accountName);

        state.from = !state.from ? wallet.id : state.from;
        state.contractAddress = !state.contractAddress ? that.address : state.contractAddress;
        if(typeof state.block === 'undefined') {
            state.block = {};
        }

        state.block.index = !state.block.index ? that.blockchain.maxBlock : state.block.index;
        state.block.timestamp = !state.block.timestamp ? Number(new Date()) : state.block.timestamp;
        state.block.hash = !state.block.hash ? '' : state.block.hash;

        return state;
    }

    /**
     * Register new stateless method in ContractConnector
     * @param {string} method
     * @param {undefined|string} alias
     */
    registerMethod(method, alias) {
        let that = this;

        alias = (typeof alias === 'undefined' ? method : alias);
        this[alias] = function (...args) {
            return new Promise(async function (resolve, reject) {
                that.ecmaContract.callContractMethodRollback(that.address, method, await that._getState(), function (err, val) {
                    if(err) {
                        reject(err);
                    } else {
                        resolve(val);
                    }
                }, ...args)
            });

        }
    }

    /**
     * Register new deploying method in ContractConnector. This call creates transaction
     * @param method
     * @param alias
     */
    registerDeployMethod(method, alias) {
        let that = this;
        alias = (typeof alias === 'undefined' ? method : alias);
        this[alias] = function (...args) {
            return new Promise(async function (resolve, reject) {
                that.ecmaContract.deployContractMethod(that.address, method, args, await that._getState(), function (err, generatedBlock) {
                    if(err) {
                        reject(err);
                        return;
                    }
                    resolve(generatedBlock);
                }, that.accountName);
            });
        };
    }

    /**
     * Direct deploy contract method
     * @param {String} method Method name
     * @param {Array|Object} args Method args or signed block
     * @return {Promise<any>}
     */
    deployContractMethod(method, args){
        let that = this;
        return new Promise(async function (resolve, reject) {
            that.ecmaContract.deployContractMethod(that.address, method, args, await that._getState(), function (err, generatedBlock) {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(generatedBlock);
            }, that.accountName);
        });
    }
}

module.exports = ContractConnector;