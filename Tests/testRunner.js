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
 * IZZZIO Test Runner
 */

const TEST_DIRS = [
    '../BigNet/test',
    '.'
];

const TEST_BASE_DIR = process.cwd();

const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;
const clc = require('cli-color');

/**
 * Walk dir
 * @param dir
 * @returns {[]}
 */
function walk(dir) {
    let results = [];
    let list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        var stat = fs.statSync(file);
        if(stat && stat.isDirectory()) {
            /* Recurse into a subdirectory */
            results = results.concat(walk(file));
        } else {
            /* Is a file */
            results.push(file);
        }
    });
    return results;
}

const isWin = process.platform === "win32";

let testStartFileName = 'test.sh';
if(isWin) {
    testStartFileName = 'test.bat';
}

//Collect tests
let tests = [];
for (let testDir of TEST_DIRS) {
    let files = walk(testDir);
    for (let file of files) {
        if(path.basename(file) === testStartFileName) {
            tests.push(file)
        }
    }
}

let somethingWentWrong = false;

(async () => {
    console.time(clc.bold('Tests finished in'));
    let testIndex = 1;
    let okTests = 0;
    for (let test of tests) {
        let testName = test.split('/')[1];
        console.log("\nRun test", clc.bold(testName), testIndex, '/', tests.length);
        process.chdir(path.dirname(test));

        console.time(testName);
        let result;
        try {
            if(isWin) {
                result = execSync('' + path.basename(test)).toString();
            } else {
                result = execSync('./' + path.basename(test)).toString();
            }
            okTests++
            console.timeEnd(testName);
            console.log(clc.green('OK'));
        } catch (e) {
            console.timeEnd(testName);
            console.log(clc.red('Test', clc.bold(testName), 'failed:') + "\n", e.stdout.toString());
        }

        process.chdir(TEST_BASE_DIR);
        testIndex++;
    }

    console.log("\n\n");
    console.timeEnd(clc.bold('Tests finished in'));
    console.log(okTests, '/', tests.length, 'passed');

    if(okTests !== tests.length) {
        process.exit(1);
    }
})();

