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

const logger = new (require(global.PATH.mainDir + '/modules/logger'))("TestPlugin");

class TestClass {
    constructor(message) {
        this.message = message;
    }

    writeln(mes = this.message) {
        console.log(mes);
    }
}

function testFunction(cb, ...args) {
    setTimeout(function(){
        console.log(args[0]);
        return cb('', args[1]);  // doesn't matter what first argument is
    }, 0);
}

module.exports = function register(blockchain, config, storj) {
    logger.info('Initialize...');

    let plugins = storj.get('plugins');

    plugins.ecma.registerFunction('testNamespace',"testFunction", testFunction);
    plugins.ecma.injectScript(TestClass);

    logger.info('OK');
};