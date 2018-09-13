/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

let ivm = require('isolated-vm');
const fs = require('fs');

/**
 * Smart contract isolated virtual machine
 */
class VM {

    constructor(options) {
        this.ramLimit = (typeof options === 'undefined' || typeof options.ramLimit === 'undefined' ? 32 : options.ramLimit);
        this.ivm = ivm;
        this.isolate = new ivm.Isolate({memoryLimit: this.ramLimit});
        this.script = '';
        this.state = undefined;
        this.context = undefined;
        this.timeout = (typeof options === 'undefined' || typeof options.timeLimit === 'undefined' ? 1000 : options.timeLimit);
        this.logging = (typeof options === 'undefined' || typeof options.logging === 'undefined' ? true : options.logging);
        this.busy = false;
        this.waitingForResponse = false;
    }

    /**
     * Encode object references to virtual machine format
     * @param obj
     * @return {ivm.Reference}
     */
    objToReference(obj) {
        let newObj = {};
        for (let a in obj) {
            if(obj.hasOwnProperty(a)) {
                if(typeof obj[a] === 'function') {
                    newObj[a] = {
                        ref: new ivm.Reference(function (...args) {
                            return obj[a](...args)
                        }), ref_type: 'function'
                    };
                } else {
                    if(typeof obj[a] === 'object') {
                        newObj[a] = {ref: this.objToReference(obj[a]), ref_type: 'object'};
                    } else {
                        newObj[a] = obj[a];
                    }
                }
            }
        }

        return new ivm.Reference(newObj);
    }

    /**
     * Creates context for iZ3 Smart Contracts
     * @param randomSeed
     * @return {*}
     */
    setUpiZ3Context(randomSeed) {
        let that = this;
        let context = this.isolate.createContextSync();
        let jail = context.global;
        jail.setSync('_ivm', ivm);
        jail.setSync('global', jail.derefInto());
        jail.setSync('console', this.objToReference({
            log: function (...args) {
                if(that.logging) {
                    console.log(...args);
                }
            }
        }));
        jail.setSync('system', this.objToReference({
            processMessages: function () {
                return true;
            }
        }));
        jail.setSync('_randomSeed', randomSeed);

        let bootstrap = this.isolate.compileScriptSync('new ' + function () {

            /**
             * Decode vm encoded format references
             * @param obj
             */
            function decodeReferences(obj) {
                if(obj.constructor.name === 'Reference') {
                    obj = obj.copySync();
                }
                let newObj = {};
                for (let a in obj) {
                    if(obj.hasOwnProperty(a)) {
                        if(obj[a]['ref_type'] === 'function') {
                            newObj[a] = function (...args) {
                                return obj[a]['ref'].applySync(undefined, args.map(arg => new ivm.ExternalCopy(arg).copyInto()));
                            }
                        } else {
                            if(obj[a]['ref_type'] === 'object') {
                                newObj[a] = obj[a]['ref'].copySync();
                            } else {
                                newObj[a] = obj[a];
                            }
                        }
                    }
                }
                return newObj;
            }

            global.decodeReferences = decodeReferences;

            //Initialize
            let ivm = _ivm;
            _ivm = undefined;
            let randomSeed = _randomSeed;
            _randomSeed = undefined;

            /**
             * IO functions
             */
            global.console = decodeReferences(console);

            /**
             * VM interaction and system methods
             */
            global.system = decodeReferences(system);

            /**
             * State safe random method
             * @return {number}
             */
            Math.random = function () {
                let seed = typeof state.randomSeed !== 'undefined' ? state.randomSeed : randomSeed;
                let x = Math.sin(seed++) * 12000;
                return x - Math.floor(x);
            };

            /**
             * Contract register method
             * @param contract
             */
            global.registerContract = function registerContract(contract) {
                global.contract = new contract();
                global.Contract = contract;
            };

            /**
             * Decode and register external object
             * @param objName
             */
            global._registerGlobalObjFromExternal = function _registerGlobalObjFromExternal(objName) {
                global[objName] = decodeReferences(global[objName]);
                return true;
            };

        });
        bootstrap.runSync(context);

        return context;
    }

    /**
     * Inject and run code
     * @param {string} code
     */
    injectScript(code) {
        this.isolate.compileScriptSync(code).runSync(this.context);
    }

    /**
     * Inject module
     * @param filePath
     */
    injectSource(filePath) {
        this.injectScript(fs.readFileSync(filePath).toString());
    }

    /**
     * Compile and run script init with state
     * @param script
     * @param state
     * @return {*}
     */
    compileScript(script, state) {

        let contractInit = '';
        /*if(typeof  state.contractClass !== 'undefined') {
            state.contractClass = state.contractClass.trim();
            contractInit = "\n" + `global.contract = new ${state.contractClass}();`
        }*/

        this.script = script;
        this.state = state;
        this.context = this.setUpiZ3Context(state.randomSeed);
        this.compiledScript = this.isolate.compileScriptSync(script + contractInit);

        return this.compiledScript;
    }

    /**
     * Execute compiled script
     * @return {*}
     */
    execute() {
        this.busy = true;
        let result = this.compiledScript.runSync(this.context, {timeout: this.timeout});
        this.busy = false;
        return result;
    }

    /**
     * Run method from context in internal method context
     * @param {string} context
     * @param args
     * @return {*}
     */
    runContextMethod(context, ...args) {
        this.busy = true;
        let vmContext = this.context.global;
        let prevContext = vmContext;
        context = context.split('.');
        for (let a in context) {
            if(context.hasOwnProperty(a)) {
                prevContext = vmContext;
                vmContext = vmContext.getSync(context[a]);

            }
        }
        let result = vmContext.applySync(prevContext.derefInto(), args.map(arg => new ivm.ExternalCopy(arg).copyInto()), {timeout: this.timeout});
        this.busy = false;
        return result;
    }

    /**
     * Run method async from context in internal method context
     * @param {string} context
     * @param {Function} cb
     * @param args
     * @return {*}
     */
    runContextMethodAsync(context, cb, ...args) {
        let that = this;
        this.busy = true;
        let vmContext = this.context.global;
        let prevContext = vmContext;
        context = context.split('.');
        for (let a in context) {
            if(context.hasOwnProperty(a)) {
                prevContext = vmContext;
                vmContext = vmContext.getSync(context[a]);
            }
        }

        vmContext.apply(prevContext.derefInto(), args.map(arg => new ivm.ExternalCopy(arg).copyInto()), {timeout: this.timeout}).then(function (result) {
            that.busy = false;
            cb(null, result);
        }).catch(function (reason) {
            that.busy = false;
            cb(reason);
        });
    }

    /**
     * Setup execution time limit
     * @param limit
     */
    setTimingLimits(limit) {
        this.timeout = limit;
    }

    /**
     * Get property value from context
     * @param context
     * @return {*}
     */
    getContextProperty(context) {
        let vmContext = this.context.global;
        let prevContext = vmContext;
        context = context.split('.');
        for (let a in context) {
            if(context.hasOwnProperty(a)) {
                prevContext = vmContext;
                vmContext = vmContext.getSync(context[a]);
            }
        }

        return vmContext.copySync()
    }

    /**
     * Defines object in global context
     * @param name
     * @param object
     * @return {*}
     */
    setObjectGlobal(name, object) {
        if(name === 'state') {
            //console.log('Set OBJ global', name, new Error().stack);
            //console.trace()
        }
        this.context.global.setSync(name, this.objToReference(object));
        return this.runContextMethod("_registerGlobalObjFromExternal", name);
    }

    setObjectGlobalSecret(name, object) {
        this.context.global.setSync(name, this.objToReference(object));
    }

    /**
     * Wait for VM ready
     * @param cb
     */
    waitForReady(cb) {
        let that = this;

        if(!that.busy && !that.waitingForResponse) {
            cb();
            return;
        }

        let interval = setInterval(function () {
            if(!that.busy && !that.waitingForResponse) {
                clearInterval(interval);
                cb();
            }
        }, 1);
    }

    /**
     * Check busy
     * @return {boolean}
     */
    isBusy() {
        return this.busy || this.waitingForResponse
    }

    /**
     * Destroy VM
     */
    destroy() {
        this.compiledScript.release();
        this.isolate.dispose();
        delete this.compiledScript;
        delete this.context;
        delete this;
    }
}

module.exports = VM;