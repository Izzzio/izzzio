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
 * The class creates and returns data from a local state.
 */
class LocalState {

    /**
     * Create
     * @constructor
     */
    constructor() {
        this._state = {};
        this._timers = {}
    }

    /**
     * State getter
     * @return {object} - state
     */
    get state() {
        return this._state;
    }

    /**
     *  Timer getter
     *  @return {object} - state
     */
    get timers() {
        return this._timers;
    }

    /**
     * Timer seeter
     * @param {Object} timers
     */
    set timers(timers) {
        this._timers = timers;
    }

    /**
     * State setter
     * @param {Object} data
     */
    set state(data) {
        this._state = data;
    }

    /**
     * Find by key in state
     * @param {number|string} value  - key of state
     * @return {object|boolean}
     */
    find(key) {
        return this.state[key] || false;
    }

    /**
     * Repove element in state. Returns nothing.
     * @param {number|string} key
     */
    remove(key) {
        delete this.state[key];
    }

    /**
     * Add element in state
     * @param {string} key
     * @param {object|array} data 
     * @return {number} - key of added element
     */
    add(key, data) {
        this.state[key] = data;
        return key;
    }

    /**
     * Create or refresh timer to delete element in state
     * @param {string} key 
     * @param {number} time  - in second
     * @return {void|boolean}
     */
    setOrRefreshTimer(key, time) {
        if (this.timers[key] && this.timers[key].hasRef()) {
            return this.timers[key].refresh();
        }
        if (this.state[key]) {
            return this.timers[key] = setTimeout(() => {
                this.remove(key);
                delete this.timers[key];
            }, time * 1000);
        }
        return false;

    }

}

module.exports = LocalState;