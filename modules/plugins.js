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
    registerFunction(functionName, functionObject, namespace = 'common') {
        if (typeof (functionObject) === 'function') {
            if (namespace) {
                //check if we already have such namespace. if not, we create
                if (!this[namespace]) {
                    this[namespace] = {};    
                }
                this[namespace][`_${functionName}`] = functionObject;
            } else {
                logger.warning(`You cannot register  without namespace`);
                return;
            }
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