/**
 iZ³ | Izzzio blockchain - https://izzz.io
 */

/**
 * Blockchain validators object
 * Provide list of validators and modules for checking blocks
 */


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
    
    /**
     * add new module description
     * @param {object} moduleName      
     * @param {string} version = '0.0' 
     */
    addModule(moduleName, version = '0.0'){
        this.validators.push(moduleName);       
        this.versions[moduleName] = version;
    };
    
    /**
     * delete information about module
     * @param {string} moduleName
     */
    deleteModule(moduleName){
        if (this.modules.hasOwnProperty(moduleName) === true){
            this.validators.splice(this.validators.indexOf(moduleName),1);
            delete this.modules[moduleName];
            delete this.versions[moduleName];
        } else {
            console.log(`Info: Can't delete ${moduleName} from validator's array: no such validator`)    
        };    
    };
    
};
    
module.exports = Validators;