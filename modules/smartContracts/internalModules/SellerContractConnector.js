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
 * Connects with seller contract
 */
class SellerContractConnector extends ContractConnector {
    constructor(sellerAddress, masterContractAddress = contracts.getMasterContractAddress()) {
        super(sellerAddress);
        this._sellerAddress = sellerAddress;
        this._masterContractAddress = masterContractAddress;
    }

    /**
     * Returns work price
     * @param args  input arguments
     * @return {string}
     */
    getPrice(args) {
        return String(contracts.callMethodDeploy(this._sellerAddress, 'getPrice', [args]));
    }

    /**
     * Buy some data. Returns orderId
     * @param {array} args input arguments
     * @return {string} orderId
     */
    buy(args){
        return contracts.callMethodDeploy(this._masterContractAddress, 'processC2CBuyRequest', [this._sellerAddress, args]);
    }

    /**
     * Get order result by id
     * @param orderId
     * @return {*}
     */
    getResult(orderId){
        return JSON.parse(contracts.callMethodDeploy(this._masterContractAddress, 'getC2CBuyResult', [orderId]));
    }

}
