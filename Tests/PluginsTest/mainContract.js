/**
 *
 * iZ³ | IZZZIO blockchain - https://izzz.io
 *
 * iZ³ BigNet Master contract
 * Provides main token and platform functionality
 * Process payable transaction
 * Process resources rental
 * Backend for C2C ordering
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
const TOKEN_NAME = 'IZZZIO main token';

/**
 * Token ticker
 * @type {string}
 */
const TICKER = 'iZ3';

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

//Real net config
//const CONTRACT_OWNER = 'izM1Tr1nhKaeDMqUaZjHqaWzjZmCndnUhML';

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

/**
 * C2C Fee
 * @type {number}
 */
const C2C_FEE = 0.001;

/**
 * C2C Fee transfer address
 * @type {string}
 */
const FEE_ADDRESS = CONTRACT_OWNER;

/**
 * Max size of adding contract
 * @type {number}
 */
const MAX_CONTRACT_LENGTH = 10 * 1024 * 1024;

/**
 * Main IZZZIO token contract
 */
class mainToken extends TokenContract {

    /**
     * Contract info
     * @return {{owner: string, ticker: string, name: string}}
     */
    get contract() {
        return {
            name: TOKEN_NAME,
            ticker: TICKER,
            owner: CONTRACT_OWNER,
            emission: EMISSION,
            c2cFee: C2C_FEE,
            type: 'token',
        };
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
        this._resourceRents = new KeyValue('resourceRents');
        this._c2cOrders = new BlockchainMap('c2cOrders');
        this._resourcePrice = new BlockchainMap('resourcePrice');
        this._ResourcesCostChange = new Event('ResourcesCostChange', 'string', 'string');

        this._maxContractLength = new KeyValue('maxContractLength');
        this._MaxContractLengthChange = new Event('MaxContractLengthChange', 'string', 'number');
        
        if (contracts.isDeploy()) {
            this._resourcePrice['ram'] = RESOURCES_PRICE.ram;
            this._resourcePrice['callLimit'] = RESOURCES_PRICE.callLimit;
            this._resourcePrice['timeLimit'] = RESOURCES_PRICE.timeLimit;
            this._ResourcesCostChange.emit('initial',this.getCurrentResources());

            this._maxContractLength.put('maxContractLength', MAX_CONTRACT_LENGTH);
            this._MaxContractLengthChange.emit('initial', this.getCurrentMaxContractLength());
        }
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
     * @param {string} address contract address
     */
    checkContractAddress(address) {
        return !isNaN(parseFloat(address)) && isFinite(address);
    }

    /**
     * Creates C2C order
     * @param {string} sellerAddress
     * @param {*} args
     * @return {*}
     */
    processC2CBuyRequest(sellerAddress, args) {
        assert.true(this.checkContractAddress(sellerAddress), 'Invalid address');
        assert.true(contracts.isChild(), 'This method can be called only from other contract');

        const addressFrom = contracts.caller();
        sellerAddress = String(sellerAddress);

        const price = new BigNumber(global.contracts.callMethodDeploy(sellerAddress, 'getPrice', [args]));
        assert.false((new BigNumber(this.balanceOf(addressFrom))).lt(price), 'Insufficient funds for contract buy');

        const orderId = this._generateOrderId(sellerAddress, addressFrom, args);
        assert.false(this._c2cOrders[orderId], 'You already have same order');

        this._c2cOrders[orderId] = {
            buyerAddress: addressFrom,
            args: args,
            price: price.toFixed(),
            result: false,
        };

        contracts.callDelayedMethodDeploy(sellerAddress, 'processC2COrder', [addressFrom, orderId, args]);
        return orderId;
    }

    /**
     * Process C2C order
     * @param {string} orderId
     * @param {*} resultData
     */
    processC2CBuyResponse(orderId, resultData) {
        assert.true(contracts.isChild(), 'This method can be called only from other contract');
        assert.true(this._c2cOrders[orderId] !== null && this._c2cOrders[orderId].result === false, 'Order not found or already finished');

        const order = this._c2cOrders[orderId];
        order.buyerAddress = String(order.buyerAddress);
        const sellerAddress = String(contracts.caller());

        assert.true(this._generateOrderId(sellerAddress, order.buyerAddress, order.args) === orderId, "Order id validity checking error");

        const price = new BigNumber(order.price);
        assert.false((new BigNumber(this.balanceOf(order.buyerAddress))).lt(price), 'Insufficient funds for contract buy');

        //Saving result
        order.result = resultData;
        this._c2cOrders[orderId] = order;

        //Take price
        this._transferFromTo(order.buyerAddress, sellerAddress, price.toFixed());

        //Take comission
        const fee = price.times(C2C_FEE);
        this._transferFromTo(sellerAddress, FEE_ADDRESS, fee.toFixed());

        contracts.callDelayedMethodDeploy(order.buyerAddress, 'processC2COrderResult', [resultData, orderId, sellerAddress]);
    }

    /**
     * Get order result
     * @param {string} orderId
     * @return {*}
     */
    getC2CBuyResult(orderId) {
        assert.true(contracts.isChild(), 'This method can be called only from other contract');
        assert.true(this._c2cOrders[orderId] !== null, 'Order not found or already finished');
        assert.true(this._c2cOrders[orderId].result !== false, 'Order not ready yet');

        const order = this._c2cOrders[orderId];
        order.buyerAddress = String(order.buyerAddress);

        assert.true(order.buyerAddress === String(contracts.caller()), 'Access denied for this orderId');

        return JSON.stringify(order.result);
    }

    /**
     * Override transfer method
     * @param from
     * @param to
     * @param amount
     * @private
     */
    _transferFromTo(from, to, amount) {
        this._wallets.transfer(from, to, amount);
        this._TransferEvent.emit(from, to, new BigNumber(amount));
    }


    /**
     * Generate order Id by params
     * @param seller
     * @param buyer
     * @param args
     * @return {*}
     * @private
     */
    _generateOrderId(seller, buyer, args) {
        return crypto.hash(seller + '_' + buyer + '_' + args.toString());
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
            this._wallets.transfer(sender, CONTRACT_OWNER, resourceRent);
        }

        //Saving rent information
        this._resourceRents.put(String(contractAddress), resourceRent);
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

        let ram = this._resourcePrice['ram'] * amount;
        let timeLimit = this._resourcePrice['timeLimit'] * amount;
        let callLimit = this._resourcePrice['callLimit'] * amount;


        ram = (ram < MINIMAL_RESOURCES.ram) ? MINIMAL_RESOURCES.ram : ram;
        timeLimit = (timeLimit < MINIMAL_RESOURCES.timeLimit) ? MINIMAL_RESOURCES.timeLimit : timeLimit;
        callLimit = (callLimit < MINIMAL_RESOURCES.callLimit) ? MINIMAL_RESOURCES.callLimit : callLimit;

        return {ram: Math.round(ram), timeLimit: Math.round(timeLimit), callLimit: Math.round(callLimit)};
    }

    /**
     * Returns calculated resources as JSON
     * @param {string} amount
     * @return JSON {{callLimit: number, timeLimit: number, ram: number}}
     */
    getCalculatedResources(amount) {
        return JSON.stringify(this.calculateResources(amount));
    }

    /**
     * Returns calculated contracts limits
     * @param address
     */
    checkContractLimits(address) {
        let resourcesAmount = this._resourceRents.get(String(address));
        if(!resourcesAmount) {
            return false;
        }
        return JSON.stringify(this.calculateResources(resourcesAmount));
    }

    /**
     * accepting new resources cost after voting
     * @param amount
     */
    _acceptNewResources(newCost) {
        this._resourcePrice['ram'] = newCost.ram;
        this._resourcePrice['timeLimit'] = newCost.timeLimit;
        this._resourcePrice['callLimit'] = newCost.callLimit;
    }

    /**
     * accepting new contract size after voting
     * @param newValue
     */
    _acceptNewMaxContractLength(newValue) {
        this._maxContractLength.put('maxContractLength', +newValue);
    }

    /**
     * get results og voting contract by its address
     * @param voteContractAddress
     * @returns {any}
     * @private
     */
    _getResultsOfVoting(voteContractAddress) {
        return JSON.parse(contracts.callMethodDeploy(voteContractAddress, 'getResultsOfVoting',[]));
    }

    /**
     * Process results of change contract cost voting
     * @param voteContractAddress
     * @returns {number} result of processing: 0 - voting isn't started, 1 - voting hasn't been ended yet, 2 - old variant of cost wins, 3 - new variant of cost wins and accepted, 4 - old var of max contract size wins, 5 new var of max contract size wins and accepted
     */
    processResults(voteContractAddress) {
        const voteResults = this._getResultsOfVoting(voteContractAddress);
        switch (voteResults.state) {
            case 'waiting':
                return 0;
                break;
            case 'started':
                return 1;
                break;
            case 'ended':
                let winner = this._findMaxVariantIndex(voteResults.results);
                if (typeof JSON.parse(winner.index) === 'object'){
                    // if wins the same variant as we have now then do nothing
                    const curResourses = this.getCurrentResources();
                    if (winner.index === curResourses) {
                        this._ResourcesCostChange.emit('not change by voting',curResourses);
                        return 2;
                    } else {
                        this._acceptNewResources(JSON.parse(winner.index));
                        this._ResourcesCostChange.emit('change by voting', curResourses);
                        return 3;
                    }
                } else {
                    const curMaxLen = this.getCurrentMaxContractLength();
                    if ( +winner.index === curMaxLen) {
                        this._MaxContractLengthChange.emit('not change by voting', curMaxLen);
                        return 4;    
                    } else {
                        this._acceptNewMaxContractLength(JSON.parse(winner.index));
                        this._MaxContractLengthChange.emit('change by voting', curMaxLen);
                        return 5;
                    }
                }
        }
    }

    /**
     * find max element and returns winner's index and value
     * @param map
     * @returns {{index: string, value: number}}
     * @private
     */
    _findMaxVariantIndex(map) {
        let max = {
            index:'',
            value: -1,
        };
        for (let ind in map) {
            if(map.hasOwnProperty(ind)) {
                if (max.value <= map[ind]) {
                    max.index = ind;
                    max.value = map[ind];
                }
            }
        }
        return max;
    }

    /**
     * get current resources
     * @returns {string}
     */
    getCurrentResources() {
        return JSON.stringify({
            ram: this._resourcePrice['ram'],
            timeLimit: this._resourcePrice['timeLimit'],
            callLimit: this._resourcePrice['callLimit']
        });
    }

    /**
     * get current max contract size
     */
    getCurrentMaxContractLength() {
        return Number(this._maxContractLength.get('maxContractLength'));
    }

    /**
     * returns resources as string
     * @param obj
     * @returns {string}
     */
    resourcesObjectToString(obj) {
        return `ram:${obj.ram}, time limit:${obj.timeLimit}, call limit:${obj.callLimit}`
    }

    /**
     * starts voting contract by address to decide if we need new resouces price or not
     * @param voteContractAddress address of voting contract
     * @param newVariant multiplier for new resources cost (new = old * multiplier)
     */
    startVotingForChangeResourcesPrice(voteContractAddress, newVariant) {
        let newCost = JSON.stringify(this.calculateResources(newVariant));
        let oldCost = this.getCurrentResources();
        contracts.callMethodDeploy(voteContractAddress, 'startVoting',[newCost, oldCost]);
        return JSON.stringify([newCost, oldCost]);
    }

    /**
     * starts voting contract by address to decide if we need newMaxContractLength or not
     * @param voteContractAddress address of voting contract
     * @param newVariant multiplier for new resources cost (new = old * multiplier)
     */
    startVotingForChangeMaxContractLength(voteContractAddress, newVariant) {
        let newVal = newVariant;
        let oldVal = this.getCurrentMaxContractLength();
        contracts.callMethodDeploy(voteContractAddress, 'startVoting',[newVal, oldVal]);
        return JSON.stringify([newVal, oldVal]);
    }


    /**
     * TODO: Remove in release
     */
    test() {
        console.log('TEST CALL');
        console.log(contracts.callMethodDeploy('5', 'balanceOf', [CONTRACT_OWNER]));
        console.log(contracts.callMethodDeploy('5', 'checkContractLimits', ['6']));
        console.log('RESULT GRANTED');
    }
}

global.registerContract(mainToken);