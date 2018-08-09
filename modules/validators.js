/**
 iZ³ | Izzzio blockchain - https://izzz.io
 */

/**
 * Blockchain validators object
 * Provide list of validators and modules for checking blocks
 */


/*2. Добавить для объекта Blockchain объект, содержащий в себе массив консенсус (из конфига), и массив модулей и метод, который позволяет добавлять в этот массив модуль в формате название - версия, messageBusAddress*/
'use strict';
const fs = require('fs');
const path = require('path');
const validatorsDir = 'validators';
const validatorsPath = path.join(__dirname, validatorsDir);


class Validators {
    constructor (config){
        this.validators = [];
        this.modules = [];
        this.versions = [];
        for (let v of config.validators){
            this.addModule(v);
        }
        this.messageBusAddress = config.recieverAddress;
    };
    
   /* addModule(moduleName = '') {
        try {
            this.validators.push(moduleName);
            this.modules[moduleName] = require(validatorsPath + moduleName);
            console.log('Info: ' + moduleName + ' was added to validators array');
        } catch (e) {
            console.log(e);
            console.log('Info: Adding canceled becauseof error');
        }
    }; */
    
    /**
     * add new module description
     * @param {object} moduleName      
     * @param {string} version = '0.0' 
     */
    addModule(moduleName, version = '0.0'){
        let modulePath = path.join(validatorsPath, moduleName + '.js');
        //check is there such file in module directory. if not then we don't add this module
        try {
            fs.accessSync(modulePath, fs.constants.R_OK);
            this.validators.push(moduleName);       //array of validator's names
            this.modules[moduleName] = path.join(validatorsPath, moduleName); //array of modules
            this.versions[moduleName] = version;
        } catch (err) {
            console.log(err);
            console.log('Info: Adding canceled because of error');
        }
    };
};
    
module.exports = Validators;