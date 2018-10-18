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
    return key.replace(new RegExp("\n\n", 'g'),"\n");
}

class Cryptography {
    constructor(config){
        this.config = config ? config : {};
        if (!config){
        } else {
            let ha = null;
            //настраиваем хэш
            switch (config.hashFunction) {
                case 'STRIBOG':
                    ha = {length: 256};
                    break;
                case 'STRIBOG512':
                    ha = {length: 512};
                    break;
            }
            let sa = null;

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
            if (ha) {
                this.gostDigest = new GostDigest(ha);
            }
            //проверяем параметры подписи и ключей
            if (sa) {
                this.gostSign = new GostSign(sa);
            }
            this.keyFormat = this.config.signFunction ? 'base64' : inputOutputFormat;
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
     * convert key from PEM format to base64 string
     * @param key PEM key
     * @param kind kind of the key: public or private
     * @returns {string} base64 encoded key
     * @constructor
     */
    static PEMToBase64(key, kind) {
        let coding = new GostCoding();
        let k = coding.PEM.decode(key, `rsa ${kind} key`);
        let base64 = coding.Base64.encode(k).replace(new RegExp("\r\n", 'g'),"");
        return base64;
    }

    /**
     * convert key from base64 string to PEM format
     * @param key
     * @param kind
     * @returns {*|String|string|CryptoOperationData|Uint8Array}
     * @constructor
     */
    static  Base64ToPem(key, kind) {
        let coding = new GostCoding();
        let k = coding.Base64.decode(key);
        let pem = coding.PEM.encode(k, `RSA ${kind} KEY`);
        return pem;
    }

    /**
     * generates pair of keys
     * @returns {{private: *, public: *}}
     */
    generateKeyPair() {
        let keyPair;
        switch (this.config.signFunction)  {
            case 'GOST':
            case 'GOST512':
                keyPair = this.gostSign.generateKey();
                //конвертируем в формат
                keyPair.public = Buffer.from(keyPair.publicKey).toString(this.keyFormat);
                keyPair.private = Buffer.from(keyPair.privateKey).toString(this.keyFormat);
                break;
            default:
                keyPair = keypair({bits: 2048});
                keyPair.private = repairKey(keyPair.private);
                keyPair.public = repairKey(keyPair.public);
                //converting format
                if (this.config.signFunction === 'RSAB64') {
                    //converting only public because private is used in pem format
                    keyPair.public = Cryptography.PEMToBase64(keyPair.public, 'public');
                }
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
            bKey = Buffer.from(key, this.keyFormat);

            signedData = this.gostSign.sign(bKey, bData);
            signedData = Buffer.from(signedData).toString(inputOutputFormat);
        } else {
            let k = repairKey(key);
            //if key is not in PEM, then convert it to PEM
            k = k.indexOf('RSA PRIVATE KEY') < 0 ? Cryptography.Base64ToPem(k,'private') : k;
            const _sign = crypto.createSign(SIGN_TYPE);
            _sign.update(data);
            signedData = _sign.sign(k).toString(inputOutputFormat); //sign in hex for compability with old versions
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
            bKey = Buffer.from(key, this.keyFormat);
            bSign = Buffer.from(sign, inputOutputFormat);   //sign in hex for compability with old versions
            result = this.gostSign.verify(bKey, bSign, bData);
        } else {
            let k = key;
            k = k.indexOf('RSA PUBLIC KEY') < 0 ? Cryptography.Base64ToPem(k,'PUBLIC') : k;
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
        let bData = Cryptography.data2Buffer(data);
        let hashBuffer;
        switch (this.config.hashFunction) {
            case 'STRIBOG':
            case 'STRIBOG512':
                hashBuffer = this.gostDigest.digest(bData);
                break;
        default:
            hashBuffer = CryptoJS.SHA256(data).toString();
            hashBuffer = Buffer.from(hashBuffer,'hex'); //make output independent to hash function type
        }
        return Buffer.from(hashBuffer).toString(inputOutputFormat);
    }
}

module.exports = Cryptography;

let cr = new Cryptography({signFunction:'RSAB64'});
//let cr = new Cryptography({signFunction:'GOST',hashFunction:'STRIBOG'});
let kp = cr.generateKeyPair();
let data = 'hello';
let s = cr.sign(data, kp.private).sign;
let v = cr.verify(data, s, kp.public);
console.log(v);
console.log(kp.public);
console.log(s);


//cr = new Cryptography({signFunction:'GOST',hashFunction:'STRIBOG'});
//kp = cr.generateKeyPair();
//console.log(kp);
//console.log(cr.hash(kp));
