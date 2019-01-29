/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const ContractConnector = require('./ContractConnector');

/**
 * Contract can connects with any standard token contract
 */
class TokenContractConnector extends ContractConnector {
    constructor(ecmaContract, address) {
        super(ecmaContract, address);
        this.registerMethod('balanceOf', '_balanceOf');
        this.registerMethod('totalSupply', '_totalSupply');

        this.registerDeployMethod('transfer', '_transfer');
        this.registerDeployMethod('mint', '_mint');
        this.registerDeployMethod('burn', '_burn');

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
    get contract() {
        return this.getPropertyPromise('contract');
    }

    /**
     * Create payable transaction
     * @param {string} address
     * @param {string} method
     * @param {string} txAmount
     * @param {array} args
     * @return {Promise<Block>}
     */
    pay(address, method, txAmount, args) {
        let that = this;
        return new Promise((resolve, reject) => {
            that.ecmaContract.deployContractMethod(that.address, 'processPayableTransaction', [address, String(txAmount), method, args], that._getState(), function (newBlock) {
                resolve(newBlock);
            });
        });

    }

}

module.exports = TokenContractConnector;