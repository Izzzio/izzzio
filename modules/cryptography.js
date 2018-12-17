/**
 * Class realises universal functions for cryptography in project
 */

'use strict';
const CryptoJS = require('crypto-js');
const GostSign = require('./GOSTModules/gostSign');
const inputOutputFormat = 'hex';
const SIGN_TYPE = 'sha256';
const crypto = require('crypto');
const keypair = require('keypair');
const GostDigest = require('./GOSTModules/gostDigest');
const GostCoding = require('./GOSTModules/gostCoding');

/**
 * Repair bad generated key
 * @param key
 * @return {*}
 */
function repairKey(key) {
    if(key[key.length - 1] !== "\n") {
        key += "\n";
    }
    return key.replace(new RegExp("\n\n", 'g'), "\n");
}

class Cryptography {
    constructor(config = {}) {
        this.utils = require('./utils');
        this.coding = new GostCoding();
        this.config = config;
        this.config.hashFunction = this.config.hashFunction ? this.config.hashFunction.toUpperCase() : this.config.hashFunction;
        this.config.signFunction = this.config.signFunction ? this.config.signFunction.toUpperCase() : this.config.signFunction;
        let ha, sa;
        if(config) {
            //настраиваем хэш
            switch (this.config.hashFunction) {
                case 'STRIBOG':
                    ha = {length: 256};
                    break;
                case 'STRIBOG512':
                    ha = {length: 512};
                    break;
            }
            //настраиваем подпись
            switch (this.config.signFunction) {
                case 'GOST':
                    sa = {hash: "GOST R 34.11", length: 256};
                    break;
                case 'GOST512':
                    sa = {hash: "GOST R 34.11", length: 512, namedCurve: "T-512-A"};
                    break;
            }
        }
        //проверяем параметры хэша
        if(ha) {
            this.gostDigest = new GostDigest(ha);
        }
        //проверяем параметры подписи и ключей
        if(sa) {
            this.gostSign = new GostSign(sa);
        }

    }

    /**
     * convert data data to buffer (all strings consider as utf8 format only)
     * @param data
     * @returns {Buffer}
     */
    data2Buffer(data) {
        let bData;
        try {
            bData = this.coding.Chars.decode(data, 'utf8');

        } catch (e) {
            bData = this.coding.Chars.decode(JSON.stringify(data), 'utf8');
        }
        return bData;
    }

    /**
     * convert key from PEM format to Hex string
     * @param key PEM key
     * @param kind kind of the key: public or private
     * @returns {string} base64 encoded key
     * @constructor
     */
    PEMToHex(key, kind = 'PUBLIC') {
        let k = this.coding.PEM.decode(key, `rsa ${kind} key`);
        let hex = this.coding.Hex.encode(k);
        hex = hex.replace(new RegExp(/\r\n/, 'g'), "");
        return hex;
    }

    /**
     * convert key from Hex string to PEM format
     * @param key
     * @param kind
     * @returns {*|String|string|CryptoOperationData|Uint8Array}
     * @constructor
     */
    hexToPem(key, kind = 'PUBLIC') {
        key = key.replace(new RegExp(/\r\n/, 'g'), "");
        let k = this.coding.Hex.decode(key);
        let pem = this.coding.PEM.encode(k, `RSA ${kind} KEY`);
        return pem;
    }

    /**
     * convert key from PEM format to Utf16 string
     * @param key PEM key
     * @param kind kind of the key: public or private
     * @returns {string} base64 encoded key
     * @constructor
     */
    PEMToUtf16(key, kind = 'PUBLIC') {
        let k = this.coding.PEM.decode(key, `rsa ${kind} key`);
        let hex = this.coding.Hex.encode(k);
        hex = hex.replace(new RegExp(/\r\n/, 'g'), "");
        return this.utils.hexString2Unicode(hex);
    }

    /**
     * convert key from Utf16 string to PEM format
     * @param key
     * @param kind
     * @returns {*|String|string|CryptoOperationData|Uint8Array}
     * @constructor
     */
    utf16ToPem(key, kind = 'PUBLIC') {
        key = this.utils.unicode2HexString(key).replace(new RegExp(/\r\n/, 'g'), "");
        let k = this.coding.Hex.decode(key);
        let pem = this.coding.PEM.encode(k, `RSA ${kind} KEY`);
        return pem;
    }

    /**
     * convert ArrayBuffer to unicode string
     * @param key {ArrayBuffer}
     * @returns {*|string}
     */
    bufferToUtf16(key) {
        let k = this.coding.Hex.encode(key).replace(new RegExp(/\r\n/, 'g'), "");
        k = this.utils.hexString2Unicode(k);
        return k;
    }

    /**
     * convert unicode string to ArrayBuffer
     * @param key {string} unicode string
     * @returns {*|string}
     */
    utf16ToBuffer(key) {
        let k = this.utils.unicode2HexString(key);
        k = this.coding.Hex.decode(k);
        return k;
    }


    /**
     * generates pair of keys
     * @returns {{private: *, public: *}}
     */
    generateKeyPair() {
        let keyPair;
        if(this.gostSign) {
            keyPair = this.gostSign.generateKey();
            keyPair.public = this.coding.Hex.encode(keyPair.publicKey).replace(new RegExp(/\r\n/, 'g'), "");
            keyPair.private = this.coding.Hex.encode(keyPair.privateKey);
        } else {
            keyPair = keypair({bits: 2048});
            keyPair.private = repairKey(keyPair.private);
            keyPair.public = repairKey(keyPair.public);
        }
        if(this.config.signFunction === 'NEWRSA') {
            //get old rsa key in PEM format and convert to utf-16
            keyPair.public = this.PEMToHex(keyPair.public);
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
        let signedDataOrigin;
        if(this.gostSign) {
            let bData, bKey;
            //prepare data for processing
            bData = this.data2Buffer(data);
            bKey = this.coding.Hex.decode(key);

            signedData = this.gostSign.sign(bKey, bData);
            signedData = this.coding.Hex.encode(signedData);
        } else {
            const _sign = crypto.createSign(SIGN_TYPE);
            _sign.update(data);
            signedData = _sign.sign(key).toString(inputOutputFormat);
        }
        signedData = signedData.replace('\r\n', ''); //delete wrong symbols

        signedDataOrigin = signedData;
        signedData = this.utils.hexString2Unicode(signedData);
        if(!signedData){
            signedData = signedDataOrigin;
        } else {
            signedData = '*'+signedData;
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

        if(sign.charAt(0) === '*'){
            //data compressed => need decompress
            sign = this.utils.unicode2HexString(sign.substr(1));
        }

        if(this.gostSign) {
            let bData, bKey, bSign;
            bData = this.data2Buffer(data);
            bKey = this.coding.Hex.decode(key);
            bSign = this.coding.Hex.decode(sign);
            result = this.gostSign.verify(bKey, bSign, bData);
        } else {
            let k = key;
            //convert key if it's not in PEM
            k = k.indexOf('RSA PUBLIC KEY') < 0 ? this.hexToPem(k, 'PUBLIC') : k;
            const verify = crypto.createVerify(SIGN_TYPE);
            verify.update(data);
            result = verify.verify(k, sign, inputOutputFormat);
        }
        return result;
    }

    /**
     * creates hash of the data
     * @param {string/ArrayBufferTypes}data
     * @returns {Buffer}
     */
    hash(data = '') {
        let bData = this.data2Buffer(data);
        let hashBuffer;
        if(this.gostDigest) {
            hashBuffer = this.gostDigest.digest(bData);
        } else {
            hashBuffer = CryptoJS.SHA256(data).toString();
            hashBuffer = this.coding.Hex.decode(hashBuffer); //make output independent to hash function type
        }
        return this.coding.Hex.encode(hashBuffer).replace('\r\n', '');
    }
}

module.exports = Cryptography;