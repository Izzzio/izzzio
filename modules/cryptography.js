/**
 * Class realises universal functions for cryptography in project
 */

'use strict';
const CryptoJS = require('crypto-js');

class Cryptography{
    constructor(config){
        //в любой непонятной ситуации используем SHA256
        if (typeof config === "undefined"){
            this.hashFunction = CryptoJS.SHA256 ;
        }
        switch (config.hashFunction){
            case 'SHA256':
                this.hashFunction = CryptoJS.SHA256;
                break;
            default:
                this.hashFunction = CryptoJS.SHA256;
                break;
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