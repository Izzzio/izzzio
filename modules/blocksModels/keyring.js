/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const Signable = require('./signable');
const fs = require('fs-extra');
const keypair = require('keypair');

let type = 'Keyring';

/**
 * Keyring
 * @type {Signable}
 */
class Keyring extends Signable {
    /**
     *
     * @param {Array} keys
     * @param {String} initiator
     * @param {NamedInstanceStorage} namedStorage
     */
    constructor(keys, initiator, namedStorage) {
        super();
        this._cryptography = namedStorage.get('cryptography');
        this.type = type;
        this.keys = keys;
        this.initiator = initiator;
        this.generateData();
    }

    /**
     * Создаёт строку данных для подписи
     */
    generateData() {
        this.data = this.type + JSON.stringify(this.keys) + this.initiator;
    }

    /**
     * Создаёт список доверенных ключей
     * @param {String} keyfile
     * @param {Number} keyCount
     * @param {Wallet} wallet
     */
    generateKeys(keyfile, keyCount, wallet) {
        let generatedKeys = [];
        console.log('Keyring: Generating keys for emission');
        generatedKeys.push(wallet.keysPair);
        this.keys.push(wallet.keysPair.public);
        for (let i = 1; i < keyCount; i++) {
            let key = this._cryptography.generateKeyPair();
            this.keys.push(key.public);
            generatedKeys.push(key);
        }

        fs.writeFileSync(keyfile, JSON.stringify(generatedKeys));

        console.log('Keyring: Saving generated keys to ' + keyfile);

        this.generateData();
    }
}

module.exports = Keyring;
