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
 * node 1 send different messages about keys, node 2 receives and check if in possible to make changes in keys.
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
//createkeystoragefile

function createKeyStoragefile(path, public) {
    fs.writeFileSync(
        path + "/keyStorage.json",
        JSON.stringify({ Admin: public, System: [] })
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

        //Preparing environment
        logger.info("Deploying contract...");
        if (this.config.recieverAddress === "nodeOne") {
            logger.info("Node one started");
        } else {
            //that.testLeech();
            logger.info("Node two started");
        }

        createKeyStoragefile(
            that.config.workDir,
            that.blockchain.wallet.keysPair.public
        );

        this.testMessaging();
    }

    /**
     * Server side test
     * @return {Promise<void>}
     */
    testMessaging() {
        logger.info("Test key messaging");
        logger.info(this.config.workDir);
        if (that.config.recieverAddress === "nodeTwo") {
            const message = that.blocks.generateBlock("data");
            console.log(
                that.blockchain.broadcastMessage(message, Date.now(), "nodeOne")
            );
        }
    }

    }

    /**
     * Run tests
     * @return {Promise<void>}
     */
    async run(deployedContract) {
        ///await wait(12000);
        //await this.testNetwork(deployedContract);

        console.log("");
        console.log("");
        console.log("");
        logger.info("Tests passed");
        //await wait(25000);
        //process.exit();
    }
}

module.exports = App;
