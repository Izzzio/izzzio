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
        this[`_${functionName}`] = functionObject;    
    }
}

module.exports = Plugins;