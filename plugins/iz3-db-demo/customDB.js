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

const levelup = require('levelup');
const leveldown = require('leveldown');
const fs = require('fs-extra');


class CustomDB {
    constructor(name, workdir) {
        this.workDir = workdir;
        this.name = name;
        this.levelup = levelup(leveldown(this.workDir + '/' + name));

    }


    get(key, options, callback) {

        this.levelup.get(key, options, function (err, result) {
            if(err) {
                return callback(err);
            }

            if(result.toString().includes('JSON:')) {
                result = JSON.parse(result.toString().replace('JSON:', ''));
            }

            return callback('', result);
        });

    }

    put(key, value, options, callback) {

        if(typeof value === 'object') {
            value = 'JSON:' + JSON.stringify(value);
        }

        this.levelup.put(key, value, function (err,) {
            if(callback) {
                callback(err);
            }

        });
    }

    del(key, options, callback) {
        this.levelup.del(key, options, callback);
    }

    close(callback) {
        this.levelup.close(callback);
    }

    clear(callback) {
        let that = this;
        try {
            this.levelup.close(function () {
                fs.removeSync(that.workDir + '/' + that.name);
                that.levelup = levelup(leveldown(that.workDir + '/' + that.name));
                if(typeof callback !== 'undefined') {
                    callback();
                }
            });
        } catch (e) {
            if(typeof callback !== 'undefined') {
                callback();
            }
        }
    }

    save(callback) {
        if(typeof callback !== 'undefined') {
            callback();
        }
    }
}

exports.init = (name, workdir) => {
    return new CustomDB(name, workdir);
};