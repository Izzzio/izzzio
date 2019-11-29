#!/usr/bin/env node

/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)

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

const Repl = require('repl');
const EcmaSmartRPC = require('../EcmaSmartRPC');
const fs = require('fs');
let program = require('commander');

program
    .description(" iZ3 - IZZZIO REPL terminal\nUsage: terminal http://localhost:3000 Password")
    .option('--experimental-repl-await', '',)
    .parse(process.argv);

let url = false;
let password = '';

if (program.args.length > 0) {
    url = program.args[0];
    if (program.args.length > 1) {
        password = program.args[1];
    }
}

if (!url) {
    console.log('TIP: Type connect(RPC_CONNECTION_STRING, PASSWORD) to connect to node.');
}


repl = Repl.start({
    useColors: true,
    replMode: Repl.REPL_MODE_STRICT,
    //ignoreUndefined: true,
});

repl.context.EcmaSmartRPC = EcmaSmartRPC;
repl.context.connect = (url, password) => {
    repl.context.rpc = new EcmaSmartRPC(url, password);
};
repl.context.fs = fs;

if (url) {
    repl.context.connect(url, password);
}

