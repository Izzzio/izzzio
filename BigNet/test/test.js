/**
 iZ³ | Izzzio blockchain - https://izzz.io

 Copyright 2018 Izio Ltd (OOO "Изио")

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

const storj = require(global.PATH.mainDir + '/modules/instanceStorage');
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
            process.exit();
        });

        process.on('unhandledRejection', error => {
            logger.fatal(error);
            process.exit();
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

    async instantC2CTest() {
        const buyerCode = 'new ' + function () {
            const SELLER_ADDRESS = '8';
            const MASTER_CONTRACT = '5';

            class ByerContract extends Contract {

                init() {
                    this._lastOrders = new BlockchainObject('lastOrders');

                }

                buySomeData() {
                    let orderId = contracts.callMethodDeploy(MASTER_CONTRACT, 'processC2CBuyRequest', [SELLER_ADDRESS, [2, 2]]);
                    this._lastOrders.orderId = orderId;
                }

                /**
                 * Receive order result
                 * @param {*} result
                 * @param {string} orderId
                 */
                processC2COrderResult(result, orderId) {
                    assert.true(contracts.isChild() && contracts.caller() === MASTER_CONTRACT, 'This method can be called only from master contract');
                    assert.true(result[0] === 4, 'Invalid order result');

                }

                /**
                 * Check result
                 */
                checkCustomResult() {
                    let customResultGet = contracts.callMethodDeploy(MASTER_CONTRACT, 'getC2CBuyResult', [this._lastOrders.orderId]);
                    assert.true(JSON.parse(customResultGet)[0] === 4, 'Invalid order result');
                }
            }

            global.registerContract(ByerContract);
        };

        const sellerCode = 'new ' + function () {
            const MASTER_CONTRACT = '5';

            class SellerContract extends Contract {

                init() {
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
                    assert.true(contracts.isChild() && contracts.caller() === MASTER_CONTRACT, 'This method can be called only from master contract');
                    this._orders.push({id: orderId, result: args[0] + args[1]});
                }

                /**
                 * Some external call
                 */
                externalCall() {
                    const order = this._orders.pop();
                    contracts.callMethodDeploy(MASTER_CONTRACT, 'processC2CBuyResponse', [order.id, [order.result]]);
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
     * Run tests
     * @return {Promise<void>}
     */
    async run() {

        await this.tokenTest();
        await this.instantC2CTest();

        console.log('');
        console.log('');
        console.log('');
        logger.info('Tests passed');
        process.exit();
    }

}

module.exports = App;