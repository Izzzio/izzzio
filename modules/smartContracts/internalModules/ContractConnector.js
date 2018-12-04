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
    constructor(address) {
        this.contracts = global.contracts;
        this.address = address;
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
     * Returns property value
     * @param property
     * @return {*}
     */
    getProperty(property){
        return this.contracts.getContractProperty(this.address, property);
    }
}
