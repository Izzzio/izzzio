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

const logger = new (require('./logger'))();
const storj = require('./instanceStorage');
const KeyValue = require('./keyvalue');
const CacheStorage = require('./cacheStorage')
const levelup = require('levelup');
const memdown = require('memdown');
const leveldown = require('leveldown');

/**
 * Blockchain manager object
 * Provide some useful functional for data synchronization
 */

class Blockchain {
    constructor() {
        this.config = storj.get('config');
        this.db = new KeyValue(this.config.blocksDB);
        this.cache = new CacheStorage(this.config.blockCacheLifeTime);
    }
    
    getLevelup() {
        return this.db.getLevelup();
    }

    getDb() {
        return this.db;
    }

    get(key, callback) {
        let result = this.getAsync(key);
        if (typeof callback === 'function') {
            result.then( function(value) {
                callback(null, value)
            }).catch( function(err) {
                callback(err)
            });
        }
    }

    put(key, data, callback) {
        let result = this.putAsync(key, data);
        if (typeof callback === 'function') {
            result.then( function(value) {
                callback(null, value);
            }).catch( function(err) {
                callback(err);
            })
        }
    }

    async getAsync(key) {
      let value = await this.cache.get(key);
      if (value === undefined) {
        value = await this.db.getAsync(key);
        this.cache.add(key, value);
      }
      return value;
    }

    async putAsync(key, data) {
        this.cache.add(key, data);
        return this.db.putAsync(key, data);
    }

    del(key, callback) {
        let result = this.delAsync(key, data);
        if (typeof callback === 'function') {
            result.then( function (value) {
                callback(null, value);
            }).catch( function(err) {
                callback(err);
            });
        }
    }

    delAsync(key) {
        this.cache.del(key);
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
