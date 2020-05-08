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


const Signable = require('../modules/blocksModels/signable');
//const CryptoJS = require("crypto-js");
let cryptography = undefined;
let type = 'BenchmarkBlock';

/**
 * NewKey block
 * @type {Signable}
 */
class BenchmarkBlock extends Signable {
    /**
     * @param {String} blockData
     * @param {NamedInstanceStorage} namedStorage
     */
    constructor(blockData, namedStorage) {
        super();
        this.type = type;
        this.blockData = blockData;
        this.generateData();
        if (!cryptography) {
            cryptography = namedStorage.get('cryptography');
        }
    }

    /**
     * Создаёт строку данных для подписи
     */
    generateData() {
        //this.data =  CryptoJS.SHA256(this.type+JSON.stringify(this.blockData)).toString();
        this.data = cryptography.hash(this.type+JSON.stringify(this.blockData)).toString();
    }


}

module.exports = BenchmarkBlock;