
const emission = 9999999999;
const tokenName = 'izzzio main';
const tickerName = 'ZZZ';
const contractOwner = '-----BEGIN RSA PUBLIC KEY-----\n' +
    'MIIBCgKCAQEApSJ2Lm6h26vHgiqB4VcyOZE+meRB6Jaow6Z+6cBn43fvcM57l8O2DfFTgo9R\n' +
    '4AUavuFJU8bekhcCWYC53RErumjHBrWVviGDOxRALfev8fOU6V+hm9E7FGiW5RXMew5729lt\n' +
    'rOxsyrayUtBLsd6BAEO5n/AtAI08Et403X/UX/7N/9zKu+F2E/fi1VlvJS07TtgPoRuT9vx6\n' +
    'ol7B0OcqGU0lIe84TasfX4pN9RIZe3+O8idBTg9aHbtuD2qSSQ9x1jpcD4wOtb+FhgBJ3dOI\n' +
    'eIC3eapWvK4HFtAtX1uIyod3LruSVssrNtLEqWOgD5MwOlv1KWAR0ZDZ3cYNL8Of8QIDAQAB\n' +
    '-----END RSA PUBLIC KEY-----\n';

class mainToken extends TokenContract {
    get contract() {
        return {name: tokenName, ticker: tickerName, owner: contractOwner};
    }

    init() {
        super.init(emission);
    }

    /**
     * Used whe payable method is called from the other contract
     * @param {string} contractAddress contract whose method is called
     * @param {number} txValue sending amounts
     * @param {string} methodName
     * @param {array} args method arguments
     */
    processPayableTransaction(contractAddress, txValue, methodName, args) {
        const state = global.getState();
        assert.false(contractAddress === state.contractAddress, 'You can\'t call payment method in token contract');

        contractAddress = String(contractAddress);
        txValue = String(txValue);

        const oldBalance = this.balanceOf(contractAddress);

        this._sendToContract(contractAddress, txValue);

        global.contracts.callDelayedMethodDeploy(contractAddress, methodName, args, {
            type: 'pay',
            amount: txValue,
            balance: this.balanceOf(contractAddress),
            oldBalance: oldBalance,
            ticker: this.contract.ticker,
            contractName: this.contract.name
        });
    }

    /* balanceOf(address){
         console.log('Get balance of ', address);
         return super.balanceOf(address);
     }*/

    /**
     * Private method, used for sending ZZZ tokens
     * @param {string} contractAddress contract whose method is called
     * @param {number} txValue sending amounts
     */
    _sendToContract(contractAddress, txValue) {
        assert.true(this.checkContractAddress(contractAddress), 'Invalid address');
        this.transfer(contractAddress, txValue);
    }

    transfer(to, amount) {
        console.log('Transfer ', amount, 'to', to, 'from', this._getSender());
        super.transfer(to, amount);
    }

    /**
     * Checks address type actuality
     * @param {string} address contract address
     */
    checkContractAddress(address) {
        return !isNaN(parseFloat(address)) && isFinite(address);
    }

}

global.registerContract(mainToken);