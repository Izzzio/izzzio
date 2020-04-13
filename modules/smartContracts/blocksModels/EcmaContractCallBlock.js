/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('../../blocksModels/signable');
let type = 'EcmaContractCallBlock';
const storj = require('../../instanceStorage');
const cryptography = storj.get('cryptography');

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
     */
    constructor(address, method, args, state) {
        super();
        this.type = type;
        this.address = address;
        this.state = state;
        this.method = method;
        this.args = args;
    }

    async updateHashes(){
        await this.generateData();
    }

    /**
     * Data hash for sign
     */
    async generateData() {
        this.data = (await cryptography.hash(this.type + this.address + stableStringify(this.state) + stableStringify(this.args) + this.method)).toString();

    }


}

module.exports = EcmaContractCallBlock;