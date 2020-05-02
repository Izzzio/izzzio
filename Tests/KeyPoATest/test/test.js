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

const logger = new (require(global.PATH.mainDir + "/modules/logger"))("KeyPoA Test");

/**
 * node create different blocks using different keys
 */

/**
 * @type {{assert: module.exports.assert, lt: module.exports.lt, true: module.exports.true, false: module.exports.false, gt: module.exports.gt, defined: module.exports.defined}}
 */
const assert = require(global.PATH.mainDir + "/modules/testing/assert");

const storj = require(global.PATH.mainDir + "/modules/instanceStorage");
const Wallet = require(global.PATH.mainDir + "/modules/wallet");

const DApp = require(global.PATH.mainDir + "/app/DApp");
const TokenContractConnector = require(global.PATH.mainDir +
    "/modules/smartContracts/connectors/TokenContractConnector");
const fs = require("fs");
const fse = require("fs-extra");
const keyStorageFile = "poaKeyStorage.json";


function createKeyStoragefile(path, publicKey) {
    fs.writeFileSync(
        path + "/" + keyStorageFile,
        JSON.stringify({Admin: [publicKey], System: []})
    );
}


let that;

function wait(time) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    });
}

class App extends DApp {
    /**
     * Initialize
     */
    init() {
        that = this;

        this.keypoaInterface = storj.get('keypoa').interface;

        process.on("SIGINT", () => {
            console.log("Terminating tests...");
            process.exit(1);
        });

        process.on("unhandledRejection", error => {
            logger.fatalFall(error);
        });


        this.run();
    }

    /**
     * Server side test
     * @return {Promise<void>}
     */
    async testKeyOperations() {

        const TEST_KEY = 'ABSTRACT_KEY';

        logger.info('Replace keyring');

        let testKeyStorage = {};
        testKeyStorage[this.blockchain.wallet.keysPair.public] = {
            key: this.blockchain.wallet.keysPair.public,
            type: 'Admin'
        };

        this.keypoaInterface._replaceKeyStorage(testKeyStorage);
        assert.true(this.keypoaInterface.isKeyFromKeyStorage(this.blockchain.wallet.keysPair.public), 'Key not in storage?');

        logger.info('Issue test system key');
        await this.keypoaInterface.issueKey(TEST_KEY);

        assert.true(this.keypoaInterface.isKeyFromKeyStorage(TEST_KEY), 'Test key not present in storage');

        await this.keypoaInterface.deleteKey(TEST_KEY);

        assert.false(this.keypoaInterface.isKeyFromKeyStorage(TEST_KEY), 'Test key still stay in storage but shouldn\'t');

    }

    async testAdminKeys() {
        let testKeyStorage = {};
        testKeyStorage[this.blockchain.wallet.keysPair.public] = {
            key: this.blockchain.wallet.keysPair.public,
            type: 'System'
        };
        this.keypoaInterface._replaceKeyStorage(testKeyStorage);
        assert.true(this.keypoaInterface.isKeyFromKeyStorage(this.blockchain.wallet.keysPair.public), 'Key not in storage?');

        logger.info('Trying issue new key');

        try {
            await this.keypoaInterface.issueKey(TEST_KEY);
            assert.assert(false, 'Key issued but shouldn\'t ');
        } catch (e) {
            logger.info('Ok. I can\'t');
        }

        logger.info('Trying delete key');

        try {
            await this.keypoaInterface.deleteKey(TEST_KEY);
            assert.assert(false, 'Key deleted but shouldn\'t ');
        } catch (e) {
            logger.info('Ok');
        }

        assert.true(this.keypoaInterface.isKeyFromKeyStorage(this.blockchain.wallet.keysPair.public), 'Key not in storage? How It possible?');
    }

    /**
     * Run tests
     * @return {Promise<void>}
     */
    async run() {


        await this.testKeyOperations();
        await this.testAdminKeys();


        console.log("");
        console.log("");
        console.log("");

        logger.info("Tests passed");
        process.exit();
    }
}

module.exports = App;
