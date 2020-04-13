/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('../signable');
const storj = require('../../instanceStorage');
const cryptography = storj.get('cryptography');
let type = 'KO-KEY-ISSUE';

/**
 * KeyPOA key delete block
 * @type {Signable}
 */
class KeyIssue extends Signable {

    /**
     *
     * @param {string} publicKey
     * @param {string} keyType
     */
    constructor(publicKey, keyType) {
        super();
        this.type = type;
        this.publicKey = publicKey;
        this.keyType = keyType;
        this.generateData();
    }

    /**
     * Создаёт строку данных для подписи
     */
    generateData() {
        this.data = this.type + cryptography.hash(this.publicKey + this.keyType);
    }


}

module.exports = KeyIssue;