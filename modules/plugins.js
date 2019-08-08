/**
 * Class realises universal functions for external plugins in project
 */
const logger = new (require('./logger'))();

class Plugins {
    /**
     * add external function from plugin as private function of the class
     * @param {string} functionName 
     * @param {function} functionObject 
     */
    registerFunction(functionName, functionObject) {
        if (typeof (functionObject) === 'function') {
            this[`_${functionName}`] = functionObject;
        } else {
            logger.warning(`Object registered by name ${functionName} is not a function. It's registration canceled.`)
        }
    }

    /**
     * returns object 
     */
    getAllRegisteredFunctionsAsObject() {
        let obj = {};
        for(let prop in this) {
            if (prop !== 'getAllFunctionsAsObject' && prop !== 'registerFunction' && this.hasOwnProperty(prop)) {
                obj[prop] = this[prop];    
            }
        }
        return obj;
    }
}

module.exports = Plugins;