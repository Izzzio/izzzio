
class EcmaSmartRPC extends NodeRPC {
    
    constructor (RPCUrl = 'http://localhost:3001/', pass = '') {
        super(RPCUrl, pass);
        this.METHODS = {
            ...this.METHODS,
            'contracts/ecma/getInfo':'GET',
            'contracts/ecma/getContractInfo':'GET',
            'contracts/ecma/getContractProperty': 'GET',
            'contracts/ecma/callMethod': 'POST',
            'contracts/ecma/deployMethod': 'POST',
            'contracts/ecma/deployContract': 'POST',
        }
    }

    /**
     * Get ECMAScript Smart Contracts subsystem info
     * @returns {Promise}
     */
    ecmaGetInfo() {
        return this._request('contracts/ecma/getInfo');
    }

    /**
     * Get info about contract
     * @param {string} contractAddress 
     * @returns {Promise}
     */
    ecmaGetContractInfo(contractAddress) {
        return this._request('contracts/ecma/getContractInfo', [], '/' + contractAddress)
    }

    /**
     * Get contract property value
     * @param {string} contractAddress 
     * @param {string} property 
     * @returns {Promise}
     */
    ecmaGetContractProperty(contractAddress, property) {
        return this._request('contracts/ecma/getContractProperty', [], '/' + contractAddress + '/' + property);    
    }

    /**
     * Call contract method without deploy
     * @param {string} contractAddress 
     * @param {string} method 
     * @param {object} params 
     * @returns {Promise}
     */
    ecmaCallMethod(contractAddress, method, params) {
        return this._request('contracts/ecma/callMethod', ['argsEncoded=' + JSON.stringify(params)], '/' + contractAddress + '/' + method);    
    }

    /**
     * Deploy contract method
     * @param {string} contractAddress 
     * @param {string} method 
     * @param {object} params 
     * @returns {Promise}
     */
    ecmaDeployMethod(contractAddress, method, params) {
        return $this._request('contracts/ecma/deployMethod', ['argsEncoded=' + JSON.stringify(params)], '/' + contractAddress + '/' + method);
    }

    /**
     * Deploy new contract
     * @param {string} source 
     * @param {string} resourceRent 
     */
    ecmaDeployContract(source, resourceRent = '0') {
        return this._request('contracts/ecma/deployContract', ['source=' + source, 'resourceRent=' + resourceRent]);
    }

    /**
     * Deploy new contract with signed block
     * @param {object} block 
     * @param {string|number} resourceRent 
     * @returns {Promise}
     */
    ecmaDeployContractSignedBlock(block, resourceRent = '0') {
        return this._request('contracts/ecma/deployContract', ['source='+ JSON.stringify(block), 'resourceRent=' + resourceRent]);
    }

    /**
     * Deploy contract method with signed block
     * @param {string} contractAddress 
     * @param {object} block 
     * @returns {Promise}
     */
    ecmaDeployMethodSignedBLock(contractAddress, block) {
        return this._request('contracts/ecma/deploySignedMethod', ['source='+ JSON.stringify(block)], '/' + contractAddress );
    }

}
