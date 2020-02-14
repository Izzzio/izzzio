/**
 iZ³ | Izzzio blockchain - https://izzz.io
 */

/**
 * Blockchain validators object
 * Provide list of validators and modules for checking blocks
 */


'use strict';

class NodeMetaInfo {
    constructor(config) {
        let validators = [];
        if(config) {
            for (let validator of config.validators) {
                validators.push(validator.consensusName);
            }
        }
        this.validators = validators;
        this.modules = [];
        this.versions = {};
        this.messageBusAddress = config ? config.recieverAddress : '';
    }

    /**
     * Parse input meta message
     * @param {NodeMetaInfo} nodeMetaInfo
     * @return {NodeMetaInfo}
     */
    parse(nodeMetaInfo) {
        if(typeof nodeMetaInfo === 'string') {
            try {
                nodeMetaInfo = JSON.parse(nodeMetaInfo);
            } catch (e) {
                return this;
            }
        }

        this.validators = nodeMetaInfo.validators;
        this.modules = nodeMetaInfo.modules;
        this.messageBusAddress = nodeMetaInfo.messageBusAddress;

        return this;
    }


    /**
     * add new module description
     * @param {object} moduleName
     * @param {string} version = '0.0'
     */
    addModule(moduleName, version = '0.0') {
        this.modules.push(moduleName);
        this.versions[moduleName] = version;
    }

    /**
     * delete information about module
     * @param {string} moduleName
     */
    deleteModule(moduleName) {
        if(this.modules.indexOf(moduleName) !== -1) {
            this.modules.splice(this.modules.indexOf(moduleName), 1);
            delete this.versions[moduleName];
        }
    }

}

module.exports = NodeMetaInfo;