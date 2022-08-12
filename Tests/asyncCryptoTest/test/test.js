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
    "SyncAsyncCrypto"
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
const fs = require("fs");
const { PerformanceObserver, performance } = require('perf_hooks');


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

        this.run();
    }

    /**
     * Server side test
     * @return {Promise<void>}
     */
    async testOperations() {
        logger.info("start crypto operations");
        let time;
        const crypto = storj.get('cryptography');
        logger.info("generateKeyPair");
        time = performance.now();
        let keypair = crypto.generateKeyPair();
        logger.info('generateKeyPair: ' + (performance.now() - time));



        logger.info("sign");
        time = performance.now();
        let sign = crypto.sign("data", keypair.private).sign;
        logger.info('sign: ' + (performance.now() - time));

        logger.info("hash");
        time = performance.now();
        let hash = crypto.hash("data");
        logger.info('hash: ' + (performance.now() - time));


        logger.info("verify");
        time = performance.now();
        let verify = crypto.verify("data", sign, keypair.public);
        logger.info('verify: ' + (performance.now() - time));
    }



    /**
     * Run tests
     * @return {Promise<void>}
     */
    async run() {
        await this.testOperations();
        console.log("");
        console.log("");
        console.log("");
        logger.info("Tests passed");
        process.exit();
    }
}

module.exports = App;
