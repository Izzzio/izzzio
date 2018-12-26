/**
 *
 * iZ³ | IZZZIO blockchain - https://izzz.io
 *
 * iZ³ BigNet Master contract
 * Provides main token and platform functionality
 * Process payable transaction
 * Process resources rental
 *
 */

/**
 * Token emission amount
 * @type {number}
 */
const EMISSION = 9999999999;

/**
 * Token full name
 * @type {string}
 */
const TOKEN_NAME = 'izzzio main';

/**
 * Token ticker
 * @type {string}
 */
const TICKER = 'ZZZ';

/**
 * Address of main contract owner
 * @type {string}
 */
const CONTRACT_OWNER = '-----BEGIN RSA PUBLIC KEY-----\n' +
    'MIIBCgKCAQEApSJ2Lm6h26vHgiqB4VcyOZE+meRB6Jaow6Z+6cBn43fvcM57l8O2DfFTgo9R\n' +
    '4AUavuFJU8bekhcCWYC53RErumjHBrWVviGDOxRALfev8fOU6V+hm9E7FGiW5RXMew5729lt\n' +
    'rOxsyrayUtBLsd6BAEO5n/AtAI08Et403X/UX/7N/9zKu+F2E/fi1VlvJS07TtgPoRuT9vx6\n' +
    'ol7B0OcqGU0lIe84TasfX4pN9RIZe3+O8idBTg9aHbtuD2qSSQ9x1jpcD4wOtb+FhgBJ3dOI\n' +
    'eIC3eapWvK4HFtAtX1uIyod3LruSVssrNtLEqWOgD5MwOlv1KWAR0ZDZ3cYNL8Of8QIDAQAB\n' +
    '-----END RSA PUBLIC KEY-----\n';

/**
 * Minimal zero-cost resources
 * @type {{timeLimit: number, callLimit: number, ram: number}}
 */
const MINIMAL_RESOURCES = {
    ram: 8,         //MB
    timeLimit: 500, //Milliseconds
    callLimit: 1,   //per minute
};

/**
 * Maximum possible resources
 * @type {number}
 */
const MAX_RESOURCES_COST = 120; //Tokens

/**
 * Default resources price
 * @type {{timeLimit: number, callLimit: number, ram: number}}
 */
const RESOURCES_PRICE = {
    ram: 2,
    timeLimit: 100,
    callLimit: 1
};

class mainToken extends TokenContract {

    /**
     * Contract info
     * @return {{owner: string, ticker: string, name: string}}
     */
    get contract() {
        return {name: TOKEN_NAME, ticker: TICKER, owner: CONTRACT_OWNER};
    }

    /**
     * Initialization and emission
     */
    init() {
        super.init(EMISSION);
        /**
         * Resource rents info
         * @type {KeyValue}
         */
        this.resourceRents = new KeyValue('resourceRents');
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

    /**
     * Private method, used for sending ZZZ tokens
     * @param {string} contractAddress contract whose method is called
     * @param {number} txValue sending amounts
     */
    _sendToContract(contractAddress, txValue) {
        assert.true(this.checkContractAddress(contractAddress), 'Invalid address');
        this.transfer(contractAddress, txValue);
    }

    /**
     * Checks address type actuality
     * TODO: Check block aviable
     * @param {string} address contract address
     */
    checkContractAddress(address) {
        return !isNaN(parseFloat(address)) && isFinite(address);
    }

    /**
     * Process new contract deployment
     */
    processDeploy() {
        const state = global.getState();
        const contractAddress = state.contractAddress;
        const sender = state.deployState.from;
        const resourceRent = state.deployState.resourceRent;

        assert.true(Number(resourceRent) >= 0, 'Good plan');
        assert.true(Number(resourceRent) <= MAX_RESOURCES_COST, 'You can\'t rent more than possible for ' + MAX_RESOURCES_COST + ' tokens');

        if(Number(resourceRent) !== 0) {
            //Transfer rent payment for system account
            this.wallets.transfer(sender, CONTRACT_OWNER, resourceRent);
        }

        //Saving rent information
        this.resourceRents.put(String(contractAddress), resourceRent);
    }

    /**
     * Returns calculated resources
     * @param {string} amount
     * @return {{callLimit: number, timeLimit: number, ram: number}}
     */
    calculateResources(amount) {
        amount = Math.abs(Number(amount));

        if(amount > MAX_RESOURCES_COST) {
            amount = MAX_RESOURCES_COST;
        }

        let ram = RESOURCES_PRICE.ram * amount;
        let timeLimit = RESOURCES_PRICE.timeLimit * amount;
        let callLimit = RESOURCES_PRICE.callLimit * amount;


        ram = (ram < MINIMAL_RESOURCES.ram) ? MINIMAL_RESOURCES.ram : ram;
        timeLimit = (timeLimit < MINIMAL_RESOURCES.timeLimit) ? MINIMAL_RESOURCES.timeLimit : timeLimit;
        callLimit = (callLimit < MINIMAL_RESOURCES.callLimit) ? MINIMAL_RESOURCES.callLimit : callLimit;

        return {ram: Math.round(ram), timeLimit: Math.round(timeLimit), callLimit: Math.round(callLimit)};
    }

    /**
     * Returns calculated contracts limits
     * @param address
     */
    checkContractLimits(address) {
        let resourcesAmount = this.resourceRents.get(String(address));
        if(!resourcesAmount) {
            return false;
        }
        return JSON.stringify(this.calculateResources(resourcesAmount));
    }


    test(){
        console.log('TEST CALL');
        console.log(contracts.callMethodDeploy('5','balanceOf',[CONTRACT_OWNER]));
        console.log(contracts.callMethodDeploy('5','checkContractLimits',['6']));
        console.log('RESULT GRANTED');
    }
}

global.registerContract(mainToken);