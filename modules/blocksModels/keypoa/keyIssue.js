/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('../signable');
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
     * @param {NamedInstanceStorage} namedStorage
     */
    constructor(publicKey, keyType, namedStorage) {
        super();
        this._cryptography = namedStorage.get('cryptography');
        this.type = type;
        this.publicKey = publicKey;
        this.keyType = keyType;
        this.generateData();
    }

    /**
     * Создаёт строку данных для подписи
     */
    generateData() {
        this.data = this.type + this._cryptography.hash(this.publicKey + this.keyType);
    }

}

module.exports = KeyIssue;