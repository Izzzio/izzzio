/**
 * Class realises universal functions for external plugins in project
 */
const logger = new (require('./logger'))();
const asyncSuffix = '_async';

class Plugins {
    /**
     * add external function from plugin as private function of the class
     * @param {string} functionName 
     * @param {*} functionObject 
     * @param {*} async 
     * @param {*} namespace 
     */
    registerFunction(functionName, functionObject, async = false, namespace = 'common') {
        if (typeof (functionObject) === 'function') {
            if (async) {
                namespace += asyncSuffix;
            }
            if (namespace) {
                //check if we already have such namespace. if not, we create
                if (!this[namespace]) {
                    this[namespace] = {};    
                }
                this[namespace][`${functionName}`] = functionObject;
            } else {
                logger.warning(`You cannot register  without namespace`);
                return;
            }
        } else {
            logger.warning(`Object registered by name ${functionName} is not a function. It's registration canceled.`)
        }
    }

    /**
     * returns object of all registered plugins
     * @param {function} cb 
     */
    getAllRegisteredFunctionsAsObject(cb) {
        let obj = {};
        //look over all namespaces
        for(let prop in this) {
            if (prop !== 'getAllFunctionsAsObject' && prop !== 'registerFunction' && this.hasOwnProperty(prop)) {
                //if we find async suffix, then we add async callback for this function as the first element
                if (prop.lastIndexOf(asyncSuffix) === (prop.length - asyncSuffix.length)) {
                    //delete async suffix to save function in ordinary namespace
                    let propName = prop.substring(0, prop.lastIndexOf(asyncSuffix));
                    for (let funcName in this[prop]) {
                        if (this[prop].hasOwnProperty(funcName)) {
                            obj[propName][funcName] = function(...args) {
                                return this[prop][funcName](cb, args);
                            }    
                        }    
                    }
                //if function is not async then jut copy it to object
                } else {
                    obj[prop] = {...obj[prop], ...this[prop]};
                }
            }
        }
        return obj;
    }
}

module.exports = Plugins;