/**
 * Class realises universal functions for cryptography in project
 */

'use strict';
const CryptoJS = require('crypto-js');
//const GOST = new (require('./GOSTModules/gost'))();
const GostSign = require('./GOSTModules/gostSign');
const inputOutputFormat = 'hex';
const SIGN_TYPE = 'sha256';
const crypto = require('crypto');
const keypair = require('keypair');
const GostDigest = require('./GOSTModules/gostDigest');


/**
 * Repair bad generated key
 * @param key
 * @return {*}
 */
function repairKey(key) {
    if(key[key.length - 1] !== "\n") {
        key += "\n";
    }
    return key.replace(new RegExp("\n\n", 'g'),"\n");
}

class Cryptography {
    constructor(config){
        if (!config){
        } else {
            let ha = {};
            //настраиваем хэш
            switch (config.hashFunction) {
                case 'STRIBOG':
                    ha.length = 256;
                    break;
                case 'STRIBOG512':
                    ha.length = 512;
                    break;
            }
            let sa = {};

            //настраиваем подпись
            switch (config.signFunction) {
                case 'GOST':
                    sa = {hash: "GOST R 34.11", length: 256};
                    break;
                case 'GOST512':
                    sa = {hash: "GOST R 34.11", length: 512, namedCurve: "T-512-A"};
                    break;
            }
            //проверяем параметры хэша
            if (ha !== {}) {
                this.gostDigest = new GostDigest(ha);
            }
            //проверяем параметры подписи и ключей
            if (sa !== {}) {
                this.gostSign = new GostSign(sa);
            }

        }
    }

    /**
     * convert data data to buffer (all strings consider as utf8 format only)
     * @param data
     * @returns {Buffer}
     */
    static data2Buffer(data) {
        let bData;
        try{
            bData = Buffer.from(data);
        } catch (e) {
            bData = Buffer.from(JSON.stringify(data));
        }
        return bData;
    }

    /**
     * generates pair of keys
     * @returns {{private: *, public: *}}
     */
    generateKeyPair() {
        let keyPair;
        if (this.gostSign) {
            keyPair = this.gostSign.generateKey();
            //конвертируем в формат
            keyPair.public = Buffer.from(keyPair.publicKey).toString(inputOutputFormat);
            keyPair.private = Buffer.from(keyPair.privateKey).toString(inputOutputFormat);
        } else {
            keyPair = keypair({bits: 2048});
            keyPair.private = repairKey(keyPair.private);
            keyPair.public = repairKey(keyPair.public);
        }
        return {private: keyPair.private, public: keyPair.public};
    }

    /**
     * signs data
     * @param data
     * @param key
     * @returns {{data: *, sign: *}}
     */
    sign(data, key) {
        let signedData;
        if (this.gostSign) {
            let bData, bKey;
            //prepare data for processing
            bData = Cryptography.data2Buffer(data);
            bKey = Buffer.from(key, inputOutputFormat);

            signedData = this.gostSign.sign(bKey, bData);
            signedData = Buffer.from(signedData).toString(inputOutputFormat);
        } else {
            key = repairKey(key);
            const _sign = crypto.createSign(SIGN_TYPE);
            _sign.update(data);
            signedData = _sign.sign(key).toString(inputOutputFormat);
        }
        return {data: data, sign: signedData};
    }

    /**
     * verifies signed data
     * @param data
     * @param sign
     * @param key
     * @returns {boolean} true or false
     */
    verify(data, sign, key) {
        if(typeof  data === 'object') {
            sign = data.sign;
            data = data.data;
        }
        let result;
        if (this.gostSign) {
            let bData, bKey, bSign;
            bData = Cryptography.data2Buffer(data);
            bKey = Buffer.from(key, inputOutputFormat);
            bSign = Buffer.from(sign, inputOutputFormat);

            result = this.gostSign.verify(bKey, bSign, bData);
        } else {
            const verify = crypto.createVerify(SIGN_TYPE);
            verify.update(data);
            result = verify.verify(key, sign, inputOutputFormat);
        }
        return result;
    }

    /**
     * creates hash of the data
     * @param {string/ArrayBufferTypes}data
     * @returns {Buffer}
     */
    hash(data = '') {
        let bData = Cryptography.data2Buffer(data);
        let hashBuffer;
        if (this.gostDigest) {
            hashBuffer = this.gostDigest.digest(bData);
        } else {
            hashBuffer = CryptoJS.SHA256(data).toString();
            hashBuffer = Buffer.from(hashBuffer,'hex'); //make output independent to hash function type
        }
        return Buffer.from(hashBuffer).toString(inputOutputFormat);
    }
}

module.exports = Cryptography;