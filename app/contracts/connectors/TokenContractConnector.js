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
    }

    /**
     * Get balance of address
     * @param address
     * @return {*}
     */
    balanceOf(address) {
        return this['_balanceOf'](address);
    }

    /**
     * Get total supply
     * @return {*}
     */
    totalSupply() {
        return this['_totalSupply']();
    }

}

module.exports = TokenContractConnector;