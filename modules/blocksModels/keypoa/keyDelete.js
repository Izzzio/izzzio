/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('../signable');
const storj = require('../../instanceStorage');
const cryptography = storj.get('cryptography');
let type = 'KO-KEY-DELETE';

/**
 * KeyPOA key issue block
 * @type {Signable}
 */
class KeyIssue extends Signable {

    /**
     *
     * @param {string} publicKey
     */
    constructor(publicKey) {
        super();
        this.type = type;
        this.publicKey = publicKey;
        this.generateData();
    }

    /**
     * Создаёт строку данных для подписи
     */
    generateData() {
        this.data = this.type + cryptography.hash(this.publicKey);
    }


}

module.exports = KeyIssue;