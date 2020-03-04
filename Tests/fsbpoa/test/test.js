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
const fse = require("fs-extra");
const keyStorageFile = "keyStorage.json";
//const Buffer = require('Buffer')
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

        ///let pubkey = "-----BEGIN RSA PUBLIC KEY-----\nMIIBCgKCAQEApSJ2Lm6h26vHgiqB4VcyOZE+meRB6Jaow6Z+6cBn43fvcM57l8O2DfFTgo9R\n4AUavuFJU8bekhcCWYC53RErumjHBrWVviGDOxRALfev8fOU6V+hm9E7FGiW5RXMew5729lt\nrOxsyrayUtBLsd6BAEO5n/AtAI08Et403X/UX/7N/9zKu+F2E/fi1VlvJS07TtgPoRuT9vx6\nol7B0OcqGU0lIe84TasfX4pN9RIZe3+O8idBTg9aHbtuD2qSSQ9x1jpcD4wOtb+FhgBJ3dOI\neIC3eapWvK4HFtAtX1uIyod3LruSVssrNtLEqWOgD5MwOlv1KWAR0ZDZ3cYNL8Of8QIDAQAB\n-----END RSA PUBLIC KEY-----\n";
        //let hash = '69262c15d6c9d7612ab6a737857bd1edd03e444ecc7452a34bfbeb005c1e1bb1';
        //let sign = '4f9b4006fd24f5f6ef32d7b906638eaa3ed9fddf671d7bf6e3b22400f6c003995fa46fa06861db532d814b3c9420f0bbe4d3304b4c6d0ddd9f8effa8e6bf47d30939cb2fceb5bc1c2563340211eb21fbef84ca8f9936b2eba56056202adf4e3905db9b98154666ad0c076112b1a231c8dc8df7e547123f18848b4b521359dfcbd344b01f38cd40c24fa6c2c04a62c421d52693e4c669ff5b99d4e332588103566465e186439c60659b3832ee8e8458b63369a61ac7d8ef763871fe2507d996989d53d3371b869d8c8e26e8072c5be82d34c535f0b1c18328f040d84885d092135d67973a1cc7131ba06229d5503c5ff4a5f509c531cba9b53c2c18451c7beb51';

        //console.log(Buffer.from(fse.readFileSync(that.config.workDir + "/" + keyStorageFile)).toString());

        let blockData = {
            data: 'data',
            sign: '',
            pubkey: that.blockchain.wallet.keysPair.public,
            type: 'Empty',
        }
        this.generateAndAddBlock(blockData, console.log, false);

        if (that.config.recieverAddress === "nodeTwo") {

        }
    }

    /*createBlock(private, public, type) {
        let testWallet = new Wallet();
        return {
            data:
        }
               
    }
 
    createSigned(private, public, type){
        return {
            data:{public, type};
        }
    }*/


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
