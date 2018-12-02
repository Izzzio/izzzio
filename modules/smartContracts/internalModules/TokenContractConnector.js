/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


/**
 * Contract can connects with any standard token contract inside contract
 */
class TokenContractConnector {
    constructor(address) {
        this.contracts = global.contracts;
        this.address = address;
        this.registerMethod('balanceOf', '_balanceOf');
        this.registerMethod('totalSupply', '_totalSupply');

        this.registerDeployMethod('transfer', '_transfer');
        this.registerDeployMethod('mint', '_mint');
        this.registerDeployMethod('burn', '_burn');
    }

    /**
     * Register new stateless method
     * @param method
     * @param alias
     */
    registerMethod(method, alias) {
        let that = this;
        alias = (typeof alias === 'undefined' ? method : alias);
        this[alias] = (...args) => {
            return that.contracts.callMethodRollback(that.address, method, args);
        }
    }

    /**
     * Register new deploying method. This call creates transaction
     * @param method
     * @param alias
     */
    registerDeployMethod(method, alias) {
        let that = this;
        alias = (typeof alias === 'undefined' ? method : alias);
        this[alias] = (...args) => {
            return that.contracts.callMethodDeploy(that.address, method, args);
        }
    }

    /**
     * Get balance of address
     * @param address
     * @return {string}
     */
    balanceOf(address) {
        return this['_balanceOf'](address);
    }

    /**
     * Get total supply
     * @return {string}
     */
    totalSupply() {
        return this['_totalSupply']();
    }

    /**
     * Transfer tokens
     * @param {string} to            Receiver address
     * @param {string|Number} amount Transfer amount
     * @return {Block}
     */
    transfer(to, amount) {
        return this['_transfer'](to, amount);
    }

    /**
     * Mint more tokens
     * @param {string|Number} amount Minting amount
     * @return {Block}
     */
    mint(amount) {
        return this['_mint'](amount);
    }

    /**
     * Burn tokens
     * @param {string|Number} amount Burning amount
     * @return {Block}
     */
    burn(amount) {
        return this['_burn'](amount);
    }

    /**
     * Get contract info constants
     * @return {Promise<object>}
     */
    /*get contract() {
        return this.getPropertyPromise('contract');
    }*/

}

module.exports = TokenContractConnector;