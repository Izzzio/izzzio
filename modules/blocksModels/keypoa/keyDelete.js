/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('../signable');
let type = 'KO-KEY-DELETE';

/**
 * KeyPOA key issue block
 * @type {Signable}
 */
class KeyIssue extends Signable {

    /**
     *
     * @param {string} publicKey
     * @param {NamedInstanceStorage} namedStorage
     */
    constructor(publicKey, namedStorage) {
        super();
        this._cryptography = namedStorage.get('cryptography');
        this.type = type;
        this.publicKey = publicKey;
        this.generateData();
    }

    /**
     * Создаёт строку данных для подписи
     */
    generateData() {
        this.data = this.type + this._cryptography.hash(this.publicKey);
    }


}

module.exports = KeyIssue;