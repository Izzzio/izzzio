/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const storj = require('../../instanceStorage');

/**
 * actions inside contract
 */
class InnerContractConnector {
    /**
     *Simplify interactions with contracts
     * @param {contracts} contracts
     * @param address
     */
    constructor(contracts = global.contracts, address) {
        this.ecmaContract = ecmaContract;
        this.address = address;
        this.blockchain = storj.get('blockchainObject');
        this.state = {};
        this.contracts = contracts;
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
    _getState() {
        let that = this;
        let state = this.state;

        state.from = !state.from ? that.blockchain.wallet.id : state.from;
        state.contractAddress = !state.contractAddress ? that.address : state.contractAddress;
        if(typeof  state.block === 'undefined') {
            state.block = {};
        }

        state.block.index = !state.block.index ? that.blockchain.maxBlock : state.block.index;
        state.block.timestamp = !state.block.timestamp ? Number(new Date()) : state.block.timestamp;
        state.block.hash = !state.block.hash ? 'nohash' : state.block.hash;

        return state;
    }

    /**
     * Get parent caller address
     * @return {*}
     */
    caller(){
        return this.contracts.caller();
    }

    /**
     * Is called from another contract?
     * @return {boolean}
     */
    isChild(){
        return this.contracts.isChild();
    }

    /**
     * Is deploying now or just method call
     * @return {boolean}
     */
    isDeploy(){
        return this.contracts.isDeploy();
    }

    /**
     * Get index of contract calling chain
     * @return {number}
     */
    callingIndex(){
        return this.contracts.callingIndex();
    }

    /**
     * Register new Call another contract method with deploy
     * @param method
     * @param alias
     */
    registerDeployMethod(method, alias) {
        let that = this;
        alias = (typeof alias === 'undefined' ? method : alias);
        this[alias] = function (...args) {
            return new Promise(function (resolve, reject) {
                resolve(that.contracts.callMethodDeploy(that.address, method, args));
            });
        };
    }

    /**
     * Register new Call another contract method with rollback
     * @param {string} method
     * @param {undefined|string} alias
     */
    registerMethod(method, alias) {

        let that = this;
        alias = (typeof alias === 'undefined' ? method : alias);
        this[alias] = function (...args) {
            return new Promise(function (resolve, reject) {
                resolve(that.contracts.callMethodRollback(that.address, method, args));
            });
        }
    }

}

module.exports = InnerContractConnector;