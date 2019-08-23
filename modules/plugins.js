/**
 * Class realises universal functions for external plugins in project
 */
const logger = new (require('./logger'))();
let that;

class Plugins {

    constructor() {
        that = this;
        /**
         * object to store registered functions
         */
        this.functions = {};
        this.injectedScripts = [];
    }

    

    /**
     * add external function from plugin as private function of the class
     * @param {string} functionName 
     * @param {function} functionObject 
     */
    registerFunction(functionName, functionObject) {
        if (typeof (functionObject) === 'function') {
                this.functions[`_${functionName}`] = functionObject;
        } else {
            logger.warning(`Object registered by name ${functionName} is not a function. It's registration canceled.`)
        }
    }

    /**
     * returns object of all registered plugins
     * @param {function} cb 
     */
    getAllRegisteredFunctionsAsObject (cb) {
        let obj = {};
            for (let funcName in that.functions) {
                if (that.functions.hasOwnProperty(funcName)) {
                    obj[funcName.replace('_','')] = function(...args) {
                        return that.functions[funcName](cb, ...args);
                    }    
                }    
            }
        return obj;
    }

    injectScript(script) {
        this.injectedScripts.push("" + script);
    }
}

module.exports = Plugins;