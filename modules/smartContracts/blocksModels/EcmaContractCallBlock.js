/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('../../blocksModels/signable');
let type = 'EcmaContractCallBlock';

const stableStringify = require('json-stable-stringify');

/**
 * EcmaContract block
 */
class EcmaContractCallBlock extends Signable {

    /**
     * Get block type
     * @return {string}
     */
    static get blockType() {
        return type;
    }

    /**
     * Create EcmaContract calling block
     * @param {string} address
     * @param {string} method
     * @param {Object} args
     * @param {Object} state
     * @param {NamedInstanceStorage} namedStorage
     */
    constructor(address, method, args, state, namedStorage) {
        super();

        this._cryptography = namedStorage.get('cryptography');

        this.type = type;
        this.address = address;
        this.state = state;
        this.method = method;
        this.args = args;
        this.generateData();
    }

    /**
     * Data hash for sign
     */
    generateData() {
        this.data = this._cryptography.hash(this.type + this.address + stableStringify(this.state) + stableStringify(this.args) + this.method).toString();

    }


}

module.exports = EcmaContractCallBlock;