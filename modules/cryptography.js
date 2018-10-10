/**
 * Class realises universal functions for cryptography in project
 */

'use strict';
const CryptoJS = require('crypto-js');
const GOST = new (require('./gost'))();
const GostSign = require('./gostSign');
const inputOutputFormat = 'hex';
const SIGN_TYPE = 'sha256';
const crypto = require('crypto');


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



class Cryptography{
    constructor(config){
        if (!config){
            this.hashFunction = CryptoJS.SHA256 ; // используем SHA256 как хэш по умолчанию
        } else {
            //настраиваем хэш
            switch (config.hashFunction) {
                case 'SHA256':
                    this.hashFunction = CryptoJS.SHA256;
                    break;
                case 'STRIBOG':
                    this.hashFunction = GOST.digest2012();
                    break;
                case 'STRIBOG512':
                    this.hashFunction = GOST.digest2012(512);
                    break;
                default:
                    this.hashFunction = CryptoJS.SHA256;
                    break;
            }
            let a = {};
           /* //настраиваем генерацию ключей

            switch (config.keyGenerationFunction){
                case 'GOST':
                    a = {hash: "GOST R 34.11", length: 256};
                    break;
                case 'GOST512':
                    a = {hash: "GOST R 34.11", length: 512, namedCurve: "T-512-A"};
                    break;
            }*/
            //настраиваем подпись
            switch (config.signFunction) {
                case 'GOST':
                    a = {hash: "GOST R 34.11", length: 256};
                    break;
                case 'GOST512':
                    a = {hash: "GOST R 34.11", length: 512, namedCurve: "T-512-A"};
                    break;
            }
            if (a !== {}){
                this.gostSign = new GostSign(a);
            }
        }
    }

    /**
     * generates pair of keys
     * @returns {{private: *, public: *}}
     */
    generateKeyPair(){
        let keyPair;
        if (this.gostSign) {
            keyPair = this.gostSign.generateKey();
            //конвертируем в формат
            keyPair.public = Buffer.from(keypair.publiKey).toString(inputOutputFormat);
            keyPair.private = Buffer.from(keypair.privateKey).toString(inputOutputFormat);
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
    sign(data, key){
        let signedData;
        if (this.gostSign) {
            let bData, bKey;
            try{
                bData = Buffer.from(data);
            } catch (e) {
                bData = Buffer.from(JSON.stringify(data));
            }
            bKey = Buffer.from(key, inputOutputFormat);
            signedData = this.gostSign.sign(bKey, bData);
            signedData = Buffer.from(signedData).toString(inputOutputFormat);
        } else {
            key = repairKey(key);
            const _sign = crypto.createSign(SIGN_TYPE);
            _sign.update(data);
            let signedData = _sign.sign(key).toString(inputOutputFormat);
        }
        return {data: data, sign: signedData};
    }

    /**
     * creates hash of the data
     * @param data
     * @param hashFunction
     * @returns {*}
     */
    hash(data, hashFunction){
        if (!data){
            return false;
        }
        //если не указана функция хэширования, то используем установленную в классе
        let functionForHash = typeof hashFunction === 'function' ? hashFunction : this.hashFunction;
        let dataForHash;
        //преобразуем в строку данные, если еще не преобразованы
        if (typeof data !== 'string'){
            try {
                dataForHash = JSON.stringify(data);
            } catch (e) {
                return false;
            }
        } else {
            dataForHash = data;
        }
        let computedHash;
        //пробуем преобразовать полученные данные в хэш
        try {
            computedHash = functionForHash(dataForHash);
        } catch (e) {
            return false;
        }
        return computedHash;
    }
}

module.exports = Cryptography;