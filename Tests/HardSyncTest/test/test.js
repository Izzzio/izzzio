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


const logger = new (require(global.PATH.mainDir + '/modules/logger'))("NetworkTest");

/**
 * @type {{assert: module.exports.assert, lt: module.exports.lt, true: module.exports.true, false: module.exports.false, gt: module.exports.gt, defined: module.exports.defined}}
 */
const assert = require(global.PATH.mainDir + '/modules/testing/assert');

//const storj = require(global.PATH.mainDir + '/modules/instanceStorage');
const Wallet = require(global.PATH.mainDir + '/modules/wallet');

const DApp = require(global.PATH.mainDir + '/app/DApp');
const TokenContractConnector = require(global.PATH.mainDir + '/modules/smartContracts/connectors/TokenContractConnector');
const fs = require('fs');


const mainTokenContract = fs.readFileSync('./mainContract.js').toString();

let that;

function wait(time) {
    return new Promise(resolve => {
        setTimeout(resolve, time)
    })
}

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
        if(this.config.recieverAddress === "nodeOne") {
            // that.contracts.ecmaContract.deployContract(mainTokenContract, 0, function (deployedContract) {
            that.run();
            // });
        } else {
            that.testLeech();
        }


    }

    /**
     * Leech test
     * @returns {Promise<void>}
     */
    async testLeech() {
        logger.info('Test leech');
        await wait(20000); //Wait for test end
        let block = await this.blocks.getBlockAsync(7);
        assert.true(block.hash === '5b02811ab9b551f6953d56cc074211acc9932cf2cb7a829780f7e572a3ff0565', 'Invalid last block hash');
        logger.info('Tests passed');
        process.exit();
    }


    /**
     * Run tests
     * @return {Promise<void>}
     */
    async run(deployedContract) {
        await wait(12000);
        console.log('');
        console.log('');
        console.log('');
        logger.info('Tests passed');
        process.exit();
    }

}

module.exports = App;