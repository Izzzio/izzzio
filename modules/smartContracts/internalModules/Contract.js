/**
 iZ³ | Izzzio blockchain - https://izzz.io

 Copyright 2018 Izio Ltd (OOO "Изио")

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

/**
 * Recommended basis environment
 */
class Contract {

    /**
     * Assert this contract called from owner
     * @param msg
     */
    assertOwnership(msg = 'Restricted access') {
        assert.assert(this.contract.owner === global.getState().from, msg);
    }

    /**
     * Asserts is payment
     * @param msg
     */
    assertPayment(msg = 'This method can only be invoked from token contract') {
        assert.false(!this.payProcess(), msg);
    }

    /**
     * Asserts is called from master contract
     * @param msg
     */
    assertMaster(msg = 'This method can only be invoked from master contract') {
        assert.true(contracts.isChild() && String(contracts.caller()) === contracts.getMasterContractAddress(), 'This method can be called only from master contract');
    }

    /**
     * Process income payment
     * @return {*}
     */
    payProcess() {
        let extendedState = contracts.getExtendedState();
        let state = global.getState();

        if(!contracts.isChild()) {
            return false;
        }

        if(!extendedState || Object.keys(extendedState).length === 0) {
            return false;
        }

        if(typeof extendedState.amount === "undefined" || typeof extendedState.type === "undefined" || typeof extendedState.balance === "undefined") {
            return false;
        }

        if(typeof state.calledFrom === 'undefined') {
            return false;
        }

        return {
            amount: new BigNumber(extendedState.amount),
            rawAmount: extendedState.amount,
            ticker: extendedState.ticker,
            balance: new BigNumber(extendedState.balance),
            rawBalance: extendedState.balance,
            caller: state.calledFrom,
            contractName: extendedState.contractName,
        };
    }

    /**
     * Return C2C order result
     * @param {string} masterContract
     * @param {string} orderId
     * @param {*} result
     * @return {*}
     */
    _orderResponse(orderId, result, masterContract = contracts.getMasterContractAddress()) {
        return contracts.callMethodDeploy(masterContract, 'processC2CBuyResponse', [orderId, [result]]);
    }


    /**
     * Initialization method
     */
    init() {
        assert.false(contracts.isChild(), 'You can\'t call init method of another contract');
        if(contracts.isDeploy()) {
            this.deploy();
        }

        /**
         * c2c Orders callbacks
         * @type {{}}
         * @private
         */
        this._c2cOrdersCallbacks = {};

        /**
         *  DApp external interface config
         * @type {{code: string, infoMethods: {}, type: boolean, deployMethods: {}}}
         * @private
         */
        this._appInterfaceConfig = {type: false, code: '', infoMethods: {}, deployMethods: {}};
    }

    /**
     * Recommended deploy method. This method calls 1 time on deploy
     */
    deploy() {
        assert.false(contracts.isChild(), 'You can\'t call deploy method of another contract');
    }

    /**
     * Register c2c order result callback function
     * @param from
     * @param callback
     */
    _registerC2CResultCallback(from, callback) {
        if(typeof this._c2cOrdersCallbacks === 'undefined') {
            throw new Error('Contract class not initialized');
        }
        this._c2cOrdersCallbacks[String(from)] = callback;
    }

    /**
     * Process c2c order result
     * @param {*} result
     * @param {string} orderId
     * @param {string} sellerAddress
     */
    processC2COrderResult(result, orderId, sellerAddress) {
        this.assertMaster();
        if(typeof this._c2cOrdersCallbacks[String(sellerAddress)] !== 'undefined') {
            this._c2cOrdersCallbacks[String(sellerAddress)](result, orderId, sellerAddress);
        }
    }

    /**
     * Register information method for external app calls
     * @param {string} methodName
     * @param {array} types
     * @private
     */
    _registerAppInfoMethod(methodName, types = []) {
        if(typeof this[methodName] === "undefined") {
            throw  new Error("Method " + methodName + ' not found');
        }
        this._appInterfaceConfig.infoMethods[methodName] = types;
    }

    /**
     * Register deployable method for external app calls
     * @param {string} methodName
     * @param {array} types
     * @private
     */
    _registerAppDeployMethod(methodName, types = []) {
        if(typeof this[methodName] === "undefined") {
            throw  new Error("Method " + methodName + ' not found');
        }
        this._appInterfaceConfig.deployMethods[methodName] = types;
    }

    /**
     * Register external app
     * @param {string} sourceCode
     * @param {string} type
     * @private
     */
    _registerApp(sourceCode, type = "web") {
        this._appInterfaceConfig.type = type;
        this._appInterfaceConfig.code = sourceCode;
    }

    /**
     * Return external App data
     * @return {*}
     */
    getAppData() {
        if(this._appInterfaceConfig.type !== false) {
            return JSON.stringify(this._appInterfaceConfig);
        }

        return false;
    }


}