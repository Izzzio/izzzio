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

        await mainToken.burn(100);
        assert.true(await mainToken.balanceOf(this.getCurrentWallet().id) === String(contractInfo.emission - 100 - 100), 'Invalid owner balance after burn');
        assert.true(String(contractInfo.emission - 100) === await mainToken.totalSupply(), 'Invalid total supply after burn');
    }

    /**
     * Run tests
     * @return {Promise<void>}
     */
    async run() {

        await this.tokenTest();

        console.log('');
        console.log('');
        console.log('');
        logger.info('Tests passed');
        process.exit();
    }

}

module.exports = App;