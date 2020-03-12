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

const logger = new (require(global.PATH.mainDir + "/modules/logger"))(
    "key messaging test"
);

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
const keyStorageFile = "keyStorage.json";

const keyOperation = {
    add: "TYPE-KEY-ISSUE",
    delete: "KEY-DELETE"
};

function createKeyStoragefile(path, publicKey) {
    fs.writeFileSync(
        path + "/" + keyStorageFile,
        JSON.stringify({ Admin: publicKey, System: [] })
    );
}

const mainTokenContract = fs.readFileSync("./mainContract.js").toString();

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

        process.on("SIGINT", () => {
            console.log("Terminating tests...");
            process.exit(1);
        });

        process.on("unhandledRejection", error => {
            logger.fatalFall(error);
        });

        createKeyStoragefile(
            that.config.workDir,
            that.blockchain.wallet.keysPair.public
        );

        //Preparing environment
        logger.info("Deploying contract...");
        if (this.config.recieverAddress === "nodeOne") {
            logger.info("Node one started");
        } else {
            //that.testLeech();
            logger.info("Node two started");
        }
        this.run();
    }

    /**
     * Server side test
     * @return {Promise<void>}
     */
    async testKeyOperations() {
        logger.info("Test key Deploying");

        logger.info("Adding System key 1");
        let blockData = this.createSignableBlock(
            "test1",
            "System",
            keyOperation.add
        );
        this.generateAndAddBlock(blockData, () => {}, false);
        await wait(1000);

        logger.info("Adding System key 2");
        blockData = this.createSignableBlock(
            "test2",
            "System",
            keyOperation.add
        );
        this.generateAndAddBlock(blockData, () => {}, false);
        await wait(1000);

        logger.info("Adding Admin Key as System key");
        blockData = this.createSignableBlock(
            this.blockchain.wallet.keysPair.public,
            "System",
            keyOperation.add
        );
        this.generateAndAddBlock(blockData, () => {}, false);
        await wait(1000);

        logger.info("Deleting System key 2");
        blockData = this.createSignableBlock(
            "test2",
            "System",
            keyOperation.delete
        );
        this.generateAndAddBlock(blockData, () => {}, false);
        await wait(1000);

        logger.info("Replacing Admin Key");
        blockData = this.createSignableBlock(
            "NewAdminKey",
            "Admin",
            keyOperation.add
        );
        this.generateAndAddBlock(blockData, () => {}, false);
        await wait(1000);

        logger.info("Trying To add key");
        blockData = this.createSignableBlock(
            "newKey",
            "System",
            keyOperation.add
        );
        this.generateAndAddBlock(blockData, () => {}, false);
        await wait(1000);

        logger.info("Trying To delete key");
        blockData = this.createSignableBlock(
            "test1",
            "System",
            keyOperation.delete
        );
        this.generateAndAddBlock(blockData, () => {}, false);
        await wait(1000);
    }

    createSignableBlock(key, keytype, type) {
        return {
            data: { publicKey: key, keyType: keytype },
            sign: "",
            pubkey: "",
            type: type
        };
    }

    /**
     * Run tests
     * @return {Promise<void>}
     */
    async run() {
        if (this.config.recieverAddress === "nodeTwo") {
            await this.testKeyOperations();
        }
        const currentKeyStorage = Buffer.from(
            fs.readFileSync(this.config.workDir + "/" + keyStorageFile)
        ).toString();
        const currentKeyStorageObj = JSON.parse(currentKeyStorage);
        console.log("");
        console.log("");
        console.log("");
        if (
            !currentKeyStorageObj.Admin ||
            currentKeyStorageObj.System.length !== 2
        ) {
            throw "Wrong state of key storage";
        }
        logger.info("Tests passed");
        process.exit();
    }
}

module.exports = App;
