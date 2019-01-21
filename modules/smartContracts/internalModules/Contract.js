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

    assertPayment(msg = 'This method can only be invoked from token contract') {
        assert.false(!this.payProcess(), msg);
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
     * Initialization method
     */
    init() {
        assert.false(contracts.isChild(), 'You can\'t call init method of another contract');
        if(contracts.isDeploy()) {
            this.deploy();
        }
    }

    /**
     * Recommended deploy method. This method calls 1 time on deploy
     */
    deploy() {
        assert.false(contracts.isChild(), 'You can\'t call deploy method of another contract');
    }


}