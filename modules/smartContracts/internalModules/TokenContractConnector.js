/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Contract can connects with any standard token contract inside contract
 */
class TokenContractConnector extends ContractConnector {
    constructor(address) {
        super(address);
        this.registerMethod('balanceOf', '_balanceOf');
        this.registerMethod('totalSupply', '_totalSupply');
        this.registerMethod('contract', '_contract');

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
     * @returns {*}
     */
    get contract() {
        return this.getProperty('contract');
    }

}
