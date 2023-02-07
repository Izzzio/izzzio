/**
 iZ³ | Izzzio blockchain - https://izzz.io

 Copyright 2018 Izio LLC (OOO "Изио")

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */


const logger = new (require(global.PATH.mainDir + '/modules/logger'))("TEST");

/**
 * @type {{assert: module.exports.assert, lt: module.exports.lt, true: module.exports.true, false: module.exports.false, gt: module.exports.gt, defined: module.exports.defined}}
 */
const assert = require(global.PATH.mainDir + '/modules/testing/assert');

//const storj = require(global.PATH.mainDir + '/modules/instanceStorage');
const Wallet = require(global.PATH.mainDir + '/modules/wallet');

const DApp = require(global.PATH.mainDir + '/app/DApp');
const TokenContractConnector = require(global.PATH.mainDir + '/modules/smartContracts/connectors/TokenContractConnector');
const fs = require('fs');


let that;

const mainTokenContract = fs.readFileSync('../mainContract.js').toString();


/**
 * EDU DApp
 */
class App extends DApp {


    /**
     * Initialize
     */
    init() {
        that = this;

        process.on('SIGINT', () => {
            console.log('Terminating tests...');
            process.exit(1);
        });

        process.on('unhandledRejection', error => {
            logger.fatalFall(error);
        });

        //Preparing environment
        logger.info('Deploying contract...');
        that.contracts.ecmaContract.deployContract(mainTokenContract, 0, function (deployedContract) {
            assert.true(deployedContract.address === that.getMasterContractAddress(), 'Invalid master contract address');
            that.run();
        });


    }

    /**
     * Test standard token methods
     * @return {Promise<void>}
     */
    async tokenTest() {
        logger.info('Token test');
        const testRecipient = 'SOME_ADDR';
        let mainToken = new TokenContractConnector(that.ecmaContract, that.getMasterContractAddress());

        let contractInfo = await mainToken.contract;

        //Basic checks
        assert.true(contractInfo.owner === this.getCurrentWallet().id, 'Invalid owner address');
        assert.true(String(contractInfo.emission) === await mainToken.totalSupply(), 'Invalid total supply');
        assert.true(String(contractInfo.emission) === await mainToken.balanceOf(this.getCurrentWallet().id), 'Invalid owner balance');

        //Transfer checks
        assert.true(await mainToken.balanceOf(testRecipient) === '0', 'Empty balance check failed');

        await mainToken.transfer(testRecipient, 100);

        assert.true(await mainToken.balanceOf(testRecipient) === '100', 'Invalid recipient balance after transfer');
        assert.true(await mainToken.balanceOf(this.getCurrentWallet().id) === String(contractInfo.emission - 100), 'Invalid owner balance after transfer');

        //Burn test
        await mainToken.burn(100);
        assert.true(await mainToken.balanceOf(this.getCurrentWallet().id) === String(contractInfo.emission - 100 - 100), 'Invalid owner balance after burn');
        assert.true(String(contractInfo.emission - 100) === await mainToken.totalSupply(), 'Invalid total supply after burn');
    }

    /**
     * Test C2C methods
     * @return {Promise<void>}
     */
    async c2cTest() {
        logger.info('C2C test');
        const buyerCode = 'new ' + function () {
            const SELLER_ADDRESS = '8';

            class ByerContract extends Contract {

                init() {
                    super.init();
                    this._lastOrders = new BlockchainMap('lastOrders');
                    this._sellerConnector = new SellerContractConnector(SELLER_ADDRESS);
                    this._registerC2CResultCallback(SELLER_ADDRESS, this.c2cBuyingResult)
                }

                buySomeData() {
                    let orderId = this._sellerConnector.buy([2, 2]);
                    this._lastOrders.orderId = orderId;
                }

                c2cBuyingResult(result, orderId) {
                    assert.true(contracts.isChild() && contracts.caller() === contracts.getMasterContractAddress(), 'This method can be called only from master contract');
                    assert.true(result[0] === 4, 'Invalid order result');
                }


                /**
                 * Check result
                 */
                checkCustomResult() {

                    let customResultGet = this._sellerConnector.getResult(this._lastOrders.orderId);
                    assert.true(customResultGet[0] === 4, 'Invalid order result');
                }
            }

            global.registerContract(ByerContract);
        };

        const sellerCode = 'new ' + function () {

            class SellerContract extends Contract {

                init() {
                    super.init();
                    this._orders = new BlockchainArray('myOrders');
                }

                /**
                 * Get order price
                 * @param {*} args
                 * @return {string}
                 */
                getPrice(args) {
                    return '2';
                }

                /**
                 * Process income order
                 * @param {string} from
                 * @param {string} orderId
                 * @param {*} args
                 */
                processC2COrder(from, orderId, args) {
                    assert.true(contracts.isChild() && contracts.caller() === contracts.getMasterContractAddress(), 'This method can be called only from master contract');
                    this._orders.push({id: orderId, result: args[0] + args[1]});
                }

                /**
                 * Some external call
                 */
                externalCall() {
                    const order = this._orders.pop();
                    this._orderResponse(order.id, order.result);
                }
            }

            global.registerContract(SellerContract);
        };

        //Deploy buyer and seller
        const sellerBlock = await that.contracts.ecmaPromise.deployContract(sellerCode, 10);
        const buyerBlock = await that.contracts.ecmaPromise.deployContract(buyerCode, 10);

        //Connect to to main token
        let mainToken = new TokenContractConnector(that.ecmaContract, that.getMasterContractAddress());
        const masterInfo = await mainToken.contract;
        await mainToken.transfer(String(buyerBlock.address), 10);


        let result = await that.contracts.ecmaPromise.deployMethod(buyerBlock.address, "buySomeData", [], {});
        result = await that.contracts.ecmaPromise.deployMethod(sellerBlock.address, "externalCall", [], {});
        result = await that.contracts.ecmaPromise.deployMethod(buyerBlock.address, "checkCustomResult", [], {});


        assert.true(Number(await mainToken.balanceOf(9)) === 10 - 2, 'Invalid buyer balance 10-PRICE');
        assert.true(Number(await mainToken.balanceOf(8)) === 2 - (2 * masterInfo.c2cFee), 'Invalid seller balance PRICE - (PRICE * C2CFEE)');


    }

    /**
     * Vote contract test
     * @return {Promise<void>}
     */
    async voteContractTest() {
        logger.info('Vote contract test');
        let mainToken = new TokenContractConnector(that.ecmaContract, that.getMasterContractAddress());
        const voteContractCode = fs.readFileSync('../voteContract.js').toString();
        const newBlock = await that.contracts.ecmaPromise.deployContract(voteContractCode, 10);

        let lastBalance = Number(await mainToken.balanceOf(this.getCurrentWallet().id));

        let result = JSON.parse(await that.contracts.ecmaPromise.callMethodRollback(newBlock.address, 'getResultsOfVoting', [], {}));

        assert.true(result.results.first === 0 && result.results.second === 0 && result.results.third === 0, 'Invalid empty vote results');
        assert.true(result.state === 'waiting', 'Invalid empty vote state');

        result = await that.contracts.ecmaPromise.deployMethod(newBlock.address, "startVoting", [], {});

        result = JSON.parse(await that.contracts.ecmaPromise.callMethodRollback(newBlock.address, 'getResultsOfVoting', [], {}));
        assert.true(result.state === 'started', 'Invalid empty vote state');

        await mainToken.pay(newBlock.address, "processPayment", '1', ['1']);

        assert.true(lastBalance === Number(await mainToken.balanceOf(this.getCurrentWallet().id)), "Invalid balance change");


        result = JSON.parse(await that.contracts.ecmaPromise.callMethodRollback(newBlock.address, 'getResultsOfVoting', [], {}));
        assert.true(result.results.first === 0 && result.results.second === 1 && result.results.third === 0, 'Invalid empty vote results');
        assert.true(result.state === 'ended', 'Invalid empty vote state');

    }


    /**
     * Test voting for changing resources
     * @return {Promise<void>}
     */
    async voteContractChangeResources() {
        logger.info('Vote contract change resources test');

        let result;
        let oldResources;
        let newResources;
        let newBlock;
        let mainToken = new TokenContractConnector(that.ecmaContract, that.getMasterContractAddress());
        const voteContractCode = fs.readFileSync('../voteContract.js').toString();

        //change resources
        //logger.info('Vote for changing resources in 2(at least) times');
        //deploy voting
        newBlock = await that.contracts.ecmaPromise.deployContract(voteContractCode, 10);

        //check initial results of voting(native method)
        result = JSON.parse(await that.contracts.ecmaPromise.callMethodRollback(newBlock.address, 'getResultsOfVoting', [], {}));
        assert.true(result.results.first === 0 && result.results.second === 0 && result.results.third === 0, 'Invalid empty vote results');
        assert.true(result.state === 'waiting', 'Invalid empty vote state');

        //check initial results of voting(master contract method)
        result = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "processResults", [newBlock.address], {});
        assert.true(result === 0, 'Invalid empty vote state');

        //star voting for change resources(try to double resources)
        await that.contracts.ecmaPromise.deployMethod(that.getMasterContractAddress(), "startVotingForChangeResourcesPrice", [newBlock.address, 2], {});

        //check state of voting(should be started)
        result = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "processResults", [newBlock.address], {});
        assert.true(result === 1, 'Invalid started vote state');

        //make vote(pay 1 coin for it)
        await mainToken.pay(newBlock.address, "processPayment", '1', ['0']);

        //check if the voting stopped
        result = JSON.parse(await that.contracts.ecmaPromise.callMethodRollback(newBlock.address, 'getResultsOfVoting', [], {}));
        assert.true(result.state === 'ended', 'Invalid started vote state');

        //get old resources
        oldResources = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "getCurrentResources", [newBlock.address], {});

        //save new resources
        await that.contracts.ecmaPromise.deployMethod(that.getMasterContractAddress(), "processResults", [newBlock.address], {});

        //check saved resources
        newResources = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "getCurrentResources", [newBlock.address], {});
        assert.false(oldResources === newResources, 'Resources should been changed');

        //logger.info('old: ' + oldResources);
        //logger.info('new: ' + newResources);


        //vote against changing
        //logger.info('Vote against changing resources ');
        newBlock = await that.contracts.ecmaPromise.deployContract(voteContractCode, 10);

        result = JSON.parse(await that.contracts.ecmaPromise.callMethodRollback(newBlock.address, 'getResultsOfVoting', [], {}));

        assert.true(result.results.first === 0 && result.results.second === 0 && result.results.third === 0, 'Invalid empty vote results');
        assert.true(result.state === 'waiting', 'Invalid empty vote state');

        result = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "processResults", [newBlock.address], {});
        assert.true(result === 0, 'Invalid empty vote state');

        await that.contracts.ecmaPromise.deployMethod(that.getMasterContractAddress(), "startVotingForChangeResourcesPrice", [newBlock.address, 2], {});

        result = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "processResults", [newBlock.address], {});
        assert.true(result === 1, 'Invalid started vote state');

        await mainToken.pay(newBlock.address, "processPayment", '1', ['1']); ////vote against changing
        result = JSON.parse(await that.contracts.ecmaPromise.callMethodRollback(newBlock.address, 'getResultsOfVoting', [], {}));
        assert.true(result.state === 'ended', 'Invalid started vote state');

        oldResources = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "getCurrentResources", [newBlock.address], {});
        await that.contracts.ecmaPromise.deployMethod(that.getMasterContractAddress(), "processResults", [newBlock.address], {});
        newResources = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "getCurrentResources", [newBlock.address], {});

        assert.false(oldResources !== newResources, 'Resources should not been changed');
        //logger.info('old: ' + oldResources);
        //logger.info('new: ' + newResources);


        //change max contract length limits
        //deploy voting
        newBlock = await that.contracts.ecmaPromise.deployContract(voteContractCode, 10);

        //check initial results of voting(native method)
        result = JSON.parse(await that.contracts.ecmaPromise.callMethodRollback(newBlock.address, 'getResultsOfVoting', [], {}));
        assert.true(result.results.first === 0 && result.results.second === 0 && result.results.third === 0, 'Invalid empty vote results');
        assert.true(result.state === 'waiting', 'Invalid empty vote state');

        //check initial results of voting(master contract method)
        result = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "processResults", [newBlock.address], {});
        assert.true(result === 0, 'Invalid empty vote state');

        //star voting for change max contract length
        await that.contracts.ecmaPromise.deployMethod(that.getMasterContractAddress(), "startVotingForChangeMaxContractLength", [newBlock.address, 2000000], {});

        //check state of voting(should be started)
        result = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "processResults", [newBlock.address], {});
        assert.true(result === 1, 'Invalid started vote state');

        //make vote(pay 1 coin for it)
        await mainToken.pay(newBlock.address, "processPayment", '1', ['0']);

        //check if the voting stopped
        result = JSON.parse(await that.contracts.ecmaPromise.callMethodRollback(newBlock.address, 'getResultsOfVoting', [], {}));
        assert.true(result.state === 'ended', 'Invalid started vote state');

        //get old max contract length
        oldResources = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "getCurrentMaxContractLength", [newBlock.address], {});

        //save new max contract length
        await that.contracts.ecmaPromise.deployMethod(that.getMasterContractAddress(), "processResults", [newBlock.address], {});

        //check saved max contract length
        newResources = await that.contracts.ecmaPromise.callMethodRollback(that.getMasterContractAddress(), "getCurrentMaxContractLength", [newBlock.address], {});
        assert.false(oldResources === newResources, 'Resources should been changed');

    }



    /**
     * Run tests
     * @return {Promise<void>}
     */
    async run() {


        await this.tokenTest();
        await this.c2cTest();
        await this.voteContractTest();
        await this.voteContractChangeResources();

        console.log('');
        console.log('');
        console.log('');
        logger.info('Tests passed');
        process.exit();
    }

}

module.exports = App;