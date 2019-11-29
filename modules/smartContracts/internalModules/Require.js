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
/**
 * Require external contract
 */
class Require {
    constructor(externalContract) {
        this._externalContract = externalContract;
        let that = this;

        /**
         * Check external contract has method
         * @param {string} method
         * @return {boolean}
         * @private
         */
        this._checkHasMethod = function (method) {
            return JSON.parse(contracts.callMethodDeploy(that._externalContract, 'hasMethod', [method]));
        };

        /**
         * Check external contract has property
         * @param {string} property
         * @return {boolean}
         * @private
         */
        this._checkHasProperty = function (property) {
            return JSON.parse(contracts.callMethodDeploy(that._externalContract, 'hasProperty', [property]));
        };

        return new Proxy(this, {
            get(target, item) {
                if(typeof target[item] !== 'undefined') {
                    return target[item];
                }

                if(that._checkHasMethod(item)) {
                    return function (...args) {
                        return contracts.callMethodDeploy(that._externalContract, item, args);
                    }
                } else if(that._checkHasProperty(item)) {
                    return contracts.getContractProperty(that._externalContract, item);
                } else {
                    throw new Error("Method or property " + item + " not found");
                }

            }
        });
    }

}
