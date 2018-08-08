/**
 iZ³ | Izzzio blockchain - https://izzz.io
 */

/**
 * Blockchain validators object
 * Provide list of validators and modules for checking blocks
 */


/*2. Добавить для объекта Blockchain объект, содержащий в себе массив консенсус (из конфига), и массив модулей и метод, который позволяет добавлять в этот массив модуль в формате название - версия, messageBusAddress*/
'use strict';
const validatorsPath = './validators/';
const fs = require('fs');

class Validators {
    constructor (config){
        this.validators = [];
        this.modules = [];
        for (let v of config.validators)
    };
    
    addModule(moduleName = '') {
        try {
            this.validators.push(moduleName);
            this.modules[moduleName] = require(validatorsPath + moduleName + '.js');
            console.log('Info: ' + moduleName + ' was added to validators array');
        } catch (e) {
            console.log(e);
            console.log('Info: Adding canceled becauseof error');
        }
    }; 
}