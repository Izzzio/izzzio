/**
 iZ³ | Izzzio blockchain - https://izzz.io

 Copyright 2018 Izio LLC (OOO "Изио")

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
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
        this.cpuLimit = (typeof options === 'undefined' || typeof options.cpuLimit === 'undefined' ? 500 : options.cpuLimit);
        this.logging = (typeof options === 'undefined' || typeof options.logging === 'undefined' ? true : options.logging);
        this.busy = false;
        this.waitingForResponse = false;
        this.logPrefix = (typeof options === 'undefined' || typeof options.logPrefix === 'undefined' ? '' : options.logPrefix);
    }

    /**
     * Returns CPU time
     * @return {number}
     */
    getCpuTime() {
        return (this.isolate.cpuTime[0] + this.isolate.cpuTime[1] / 1e9) * 1000;
    }

    /**
     * Start CPU time limiter
     * @private
     */
    _startCPULimitTimer() {
        let that = this;
        let lastCPU = this.getCpuTime();
        let _cpuTimer = {
            timer: setInterval(function () {
                if(that.isolate.isDisposed) {
                    clearInterval(_cpuTimer.timer);
                    return;
                }
                let cpuTime = that.getCpuTime() - lastCPU;
                if(cpuTime > that.cpuLimit) { //What we wanna do with time limit?
                    clearInterval(_cpuTimer.timer);
                    _cpuTimer.falled = true;
                    _cpuTimer.reason = `CPU time limit exceed ${cpuTime}/${that.cpuLimit}`;
                    that.isolate.dispose();

                    that.busy = false;
                    that.waitingForResponse = false;
                }
            }, 4), falled: false
        };


        return _cpuTimer;
    }

    /**
     * Stop CPU time limiter
     * @private
     */
    _stopCPULimitTimer(timerId) {
        clearInterval(timerId.timer);
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
     * Set internal read-only state
     * @param state
     */
    setState(state) {
        this.state = state;
        this.setObjectGlobal('state', state);
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
                    process.stdout.write(that.logPrefix);
                    console.log(...args);
                }
            }
        }));
        jail.setSync('system', this.objToReference({
            processMessages: function () {
                return true;
            },
            getState: function () {
                return that.objToReference(that.state);
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
                        if(obj[a]) {
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
                }
                return newObj;
            }

            global.decodeReferences = decodeReferences;

            //Initialize
            let ivm = _ivm;
            _ivm = undefined;
            let randomSeed = _randomSeed;
            _randomSeed = undefined;

            let _state = global.state;
            /**
             * Safe state method
             * @return {state}
             */
            global.getState = function () {
                return Object.assign({}, _state);
            };

            /**
             * Update state from global object
             */
            global.updateState = function () {
                _state = decodeReferences(system.getState());
            };


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
                //Save current state before run contract
                _state = global.state;
                global.contract = new contract();
                global.Contract = contract;

                /**
                 * Check if contract has some method
                 * @param method
                 * @return {boolean}
                 */
                global.contract.hasMethod = function (method) {
                    return String(typeof global.contract[method] === 'function');
                };

                /**
                 * Check contract has some property
                 * @param property
                 * @return {boolean}
                 */
                global.contract.hasProperty = function (property) {
                    return String(typeof global.contract[method] !== 'function' && typeof global.contract[method] !== 'undefined');
                };
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
        let cpuLimiter = this._startCPULimitTimer();
        let result = this._runContextMethodUnlimited(context, args);
        this._stopCPULimitTimer(cpuLimiter);
        return result;
    }

    /**
     * Run context method without CPU time limition
     * @param context
     * @param args
     * @return {any}
     * @private
     */
    _runContextMethodUnlimited(context, ...args) {
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
        let cpuLimiter = this._startCPULimitTimer();
        try {
            vmContext.apply(prevContext.derefInto(), args.map(arg => new ivm.ExternalCopy(arg).copyInto()), {timeout: this.timeout})
            .then(function (result) {
                that._stopCPULimitTimer(cpuLimiter);
                that.busy = false;
                cb(null, result);
            }).catch(function (reason) {
                that.busy = false;
                if(cpuLimiter.falled) {
                    reason = new Error(cpuLimiter.reason);
                }
                that._stopCPULimitTimer(cpuLimiter);
                cb(reason);
            });
        } catch (e) {
            that.busy = false;
            that._stopCPULimitTimer(cpuLimiter);
            cb(e);
        }
    }

    /**
     * Run async method as promise
     * @param context
     * @param cb
     * @param args
     * @return {Promise<any>}
     */
    runContextMethodAsyncPromise(context, cb, ...args) {
        let that = this;
        return new Promise((resolve, reject) => {
            that.runContextMethodAsync(context, function (err, result) {
                if(err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            }, args);
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
     * Changes CPU time limit
     * @param limit
     */
    setCpuLimit(limit) {
        this.cpuLimit = limit;
    }

    /**
     * Get property value from context
     * @param context
     * @return {*}
     */
    async getContextProperty(context) {
        let vmContext = this.context.global;
        let prevContext = vmContext;
        context = context.split('.');
        for (let a in context) {
            if(context.hasOwnProperty(a)) {
                prevContext = vmContext;
                vmContext = await vmContext.get(context[a]);
            }
        }

        return await vmContext.copy();
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
        return this._runContextMethodUnlimited("_registerGlobalObjFromExternal", name);
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

        if(!that.isBusy()) {
            cb();
            return;
        }

        setImmediate(() => this.waitForReady(cb));
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