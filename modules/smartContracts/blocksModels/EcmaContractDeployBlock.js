/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('../../blocksModels/signable');
let type = 'EcmaContractDeploy';

const stableStringify = require('json-stable-stringify');

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
     * @param {NamedInstanceStorage} namedStorage
     */
    constructor(ecmaCode, state, namedStorage) {
        super();
        this._cryptography = namedStorage.get('cryptography');
        
        this.type = type;
        this.ecmaCode = ecmaCode;
        this.state = state;
        this.state.codeHash = this._cryptography.hash(this.ecmaCode).toString();
        this.generateData();
    }

    /**
     * Data hash for sign
     */
    generateData() {
        this.data = this._cryptography.hash(this.type + this.ecmaCode + stableStringify(this.state)).toString();
    }


}

module.exports = EcmaContractDeployBlock;