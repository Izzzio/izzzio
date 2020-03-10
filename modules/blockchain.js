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

const KeyValue = require('./keyvalue');

/**
 * Blockchain manager object
 * Provide some useful functional for data synchronization
 */

class Blockchain {
    constructor(config) {
        this.config = config;
        this.db = new KeyValue(this.config.blocksDB, this.config);
    }

    getLevelup() {
        return this.db.getLevelup();
    }

    getDb() {
        return this.db;
    }

    get(key, callback) {
        let that = this;
        that.db.get(key, callback);
    }

    put(key, value, callback) {
        let that = this;
        that.db.put(key, value, callback);
    }

    getAsync(key) {
        return this.db.getAsync(key);
    }

    putAsync(key, data) {
        return this.db.putAsync(key, data);
    }

    del(key, callback) {
        let that = this;
        that.db.del(key, callback);
    }

    delAsync(key) {
        return this.db.delAsync(key);
    }

    close(callback) {
        let that = this;
        that.db.close(callback);
    }

    closeAsync() {
        return this.db.closeAsync();
    }

    save(callback) {
        let that = this;
        that.db.save(callback);
    }

    saveAsync() {
        return this.db.saveAsync();
    }
}

module.exports = Blockchain;
