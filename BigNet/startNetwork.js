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

/**
 * BigNet network starter
 */


const logger = new (require(global.PATH.mainDir + '/modules/logger'))("NetworkStart");

/**
 * @type {{assert: module.exports.assert, lt: module.exports.lt, true: module.exports.true, false: module.exports.false, gt: module.exports.gt, defined: module.exports.defined}}
 */
const assert = require(global.PATH.mainDir + '/modules/testing/assert');

//const storj = require(global.PATH.mainDir + '/modules/instanceStorage');
const Wallet = require(global.PATH.mainDir + '/modules/wallet');

const DApp = require(global.PATH.mainDir + '/app/DApp');
const fs = require('fs');


let that;

/**
 * Master contract
 */
const masterContract = fs.readFileSync('./mainContract.js').toString();


/**
 * Deploy master contracts APP
 */
class App extends DApp {


    /**
     * Initialize
     */
    init() {
        that = this;

        process.on('SIGINT', () => {
            console.log('Terminating deploy...');
            process.exit();
        });

        process.on('unhandledRejection', error => {
            logger.fatalFall(error);
        });

        //Preparing environment
        logger.info('Deploying contract...');
        that.contracts.ecmaContract.deployContract(masterContract, 0, async function (deployedContract) {
            assert.assert(deployedContract !== null && Object.keys(deployedContract).length !== 0, "Invalid deployed contract");
            assert.true(deployedContract.address === that.getMasterContractAddress(), 'Invalid master contract address ' + that.getMasterContractAddress());
            logger.info("Master contract deployed");
        });


    }


}

module.exports = App;