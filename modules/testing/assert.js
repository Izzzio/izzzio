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
 * Simple assertion
 * @type {{assert: module.exports.assert, lt: module.exports.lt, true: module.exports.true, false: module.exports.false, gt: module.exports.gt, defined: module.exports.defined}}
 */
module.exports = {
    assert: function (assertion, message) {
        if(!assertion) {
            if(typeof message !== 'undefined') {
                throw message;
            }
            throw 'Assertion fails'
        }
    },
    defined: function (assertion, message) {
        if(!assertion) {
            if(typeof message !== 'undefined') {
                throw message;
            }
            throw 'Assertion not defined'
        }
    },
    gt: function (a, b, message) {
        this.assert(a > b, message);
    },
    lt: function (a, b, message) {
        this.assert(a < b, message);
    },
    true: function (assertion, msg) {
        this.assert(assertion, msg);
    },
    false: function (assertion, msg) {
        this.true(!assertion, msg);
    }
};