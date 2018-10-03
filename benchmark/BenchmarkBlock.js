/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('../modules/blocks/signable');
//const CryptoJS = require("crypto-js");
let type = 'BenchmarkBlock';

/**
 * NewKey block
 * @type {Signable}
 */
class BenchmarkBlock extends Signable {
    /**
     * @param {String} blockData
     */
    constructor(blockData) {
        super();
        this.type = type;
        this.blockData = blockData;
        this.generateData();
    }

    /**
     * Создаёт строку данных для подписи
     */
    generateData() {
        //this.data =  CryptoJS.SHA256(this.type+JSON.stringify(this.blockData)).toString();
        this.data =  cryptography.hash(this.type+JSON.stringify(this.blockData)).toString();
    }


}

module.exports = BenchmarkBlock;