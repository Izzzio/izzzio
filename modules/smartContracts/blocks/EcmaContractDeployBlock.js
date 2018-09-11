/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('../../blocks/signable');
const CryptoJS = require("crypto-js");
let type = 'EcmaContractDeploy';

/**
 * EcmaContract block
 */
class EcmaContractDeployBlock extends Signable {

    /**
     * Get block type
     * @return {string}
     */
    static get blockType() {
        return type;
    }

    /**
     * Create EcmaContract block
     * @param {string} ecmaCode
     * @param {Object} state
     */
    constructor(ecmaCode, state) {
        super();
        this.type = type;
        this.ecmaCode = ecmaCode;
        this.state = state;
        this.state.codeHash = CryptoJS.SHA256(this.ecmaCode).toString();
        this.generateData();
    }

    /**
     * Data hash for sign
     */
    generateData() {
        this.data = CryptoJS.SHA256(this.type + this.ecmaCode + JSON.stringify(this.state)).toString();
    }


}

module.exports = EcmaContractDeployBlock;