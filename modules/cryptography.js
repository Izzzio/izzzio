/**
 * Class realises universal functions for cryptography in project
 */

'use strict';
const CryptoJS = require('crypto-js');
const GOST = new (require('./gost'))();

class Cryptography{
    constructor(config){
        //в любой непонятной ситуации используем SHA256
        if (!config){
            this.hashFunction = CryptoJS.SHA256 ;
        } else {
            switch (config.hashFunction) {
                case 'SHA256':
                    this.hashFunction = CryptoJS.SHA256;
                    break;
                case 'STRIBOG':
                    this.hashFunction = GOST.digest2012;
                    break;
                case 'STRIBOG512':
                    GOST.hashbitLength = 512;
                    this.hashFunction = GOST.digest2012;
                    break;
                default:
                    this.hashFunction = CryptoJS.SHA256;
                    break;
            }
        }
    }

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