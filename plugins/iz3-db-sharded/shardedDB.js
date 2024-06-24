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
const level = require('level');
const path = require('path');
const fs = require('fs-extra');

/** Class wrapper of leveldb, managing multiple instances of leveldb */
class ShardedDB {
    /** Create sharded database instance
     * @constructor
     * @param {string} name - Parameters of leveldb storages, structured string, that parses
     *  into parameters object, example: "path=./db1;size=4000&path=./db2;size=5000", where "&" - 
     * storages separator, ";" one storages' parameters separator
     * @param {string} workdir - the working directory
     */
    constructor(name, workdir) {
        this.tempstorage = {};
        this.workDir = workdir;
        this.name = name;
        this.isOpened = false;
        this._initializeStorages(name)
        .then((res) => {
            this.storages = res;
            let queries = new Array();
            for (let key in this.tempstorage) {
                queries.push(this.putAsync(key, this.tempstorage[key], {}));
            }
            return Promise.all(queries);
        })
        .then((res) => {
            this.tempstorage = null;
            this.isOpened = true;
        })
        .catch((err) => {
            throw err;
        });
    }

    // Private methods

    /** Parser of database parameters into object
     * @param {string} params - Parameters string
     * @returns {Object}
     */
    _initializeDbParams(params) {
        params = params.split(';');
        let storage, size;
        
        if (params[0].indexOf('path') === 0 && params[1].indexOf('size') > -1) {
            storage = params[0].split('=')[1];
            storage = path.resolve(this.workDir, storage);
            size = parseInt(params[1].split('=')[1]);
        } else if (params[1].indexOf('path') === 0 && params[0].indexOf('size') > -1) {
            storage = params[1].split('=')[1];
            storage = path.resolve(this.workDir, storage);
            size = parseInt(params[0].split('=')[1]);
        } else {
            throw new Error("ShardedDBError: Database parameters string is not correct")
        }

        return { storage, size };
    }

    /**Promise wrapper for level initializer
     * @param {string} storage path to the level files
     * @returns {Promise}
     */
    _promisifyLevel(storage) {
      return new Promise((resolve, reject) => {
        level(storage, {}, (err, db) => {
          if (err) reject(err);
          else resolve(db);
        });
      })
    }

    /**Creates storages objects from parameters
     * @param {string} name - Parameters string
     * @returns {Array<Object>}
     */
    async _initializeStorages(name) {
        let storages = new Array();
        let shards = name.split('&');
        shards = shards.map((el) => {
            return this._initializeDbParams(el); // parsing DB strings
        });

        for (let shard of shards) {
            const storage = {
                path: shard.storage,
                level: await this._promisifyLevel(shard.storage),
                size: shard.size
            }
            storages.push(storage);
        }

        return storages;
    }

    /** Wrapper for get, del operations, that
     * starts chain of promises and wait all of them to resolve/reject
     * returns resolved promise or rejected with NotFound error
     * @async
     * @param {string} key
     * @param {Object} options
     * @param {string} operation - "get" or "del"
     * @returns {Promise}
    */
    async _storageOperationAsync(key, options, operation) {
        let queries = new Array();
        for (let stor of this.storages) {
            queries.push(stor.level[operation](key, options));
        }

        queries = await Promise.allSettled(queries);

        let result;
        queries.forEach((promise) => {
            if (promise.value) {
                result = promise.value;
            }
        })
        if (operation === 'get') {
            return result ? Promise.resolve(result) : Promise.reject(new Error('Not found'));
        } else if (operation === 'del') {
            return Promise.resolve();
        }
        
    }

    /** Returns size of folder
     * @async
     * @param {string} stor - path of storage
     * @returns {Promise}
     */
    async _sizeOfStorageAsync(stor) {
        const dir = this.storages[stor].path;
        let sizes;
        const files = fs.readdirSync(dir);
        sizes = files.map((file) => fs.stat(dir + path.sep + file));
        sizes = await Promise.allSettled(sizes);
        sizes = sizes
        .map((promise) => {
            if(promise.status === 'fulfilled') {
                return promise.value.size;
            } else {
                return 0;
            }
        })
        .reduce((acc, size) => acc + size);
        return sizes;
    }

    /** Deletes all files from directory */
    _clearDirectories() {
        this.storages
        .map((stor) => stor.path)
        .forEach((path) => fs.removeSync(path));
    }

    //Public methods

    /** Callback wrapper for get method */
    get(key, options, callback) {
        if (this.isOpened) {
            this.getAsync(key, options)
            .then((res) => {
                if (typeof(callback) === 'function') {
                    callback(null, res);
                }
            })
            .catch((err) => {
                if (typeof(callback) === 'function') {
                    callback(err);
                }
            });
        } else {
            if (this.tempstorage[key] !== null && this.tempstorage[key] !== undefined) {
                if (typeof(callback) === 'function') {
                    callback(null, this.tempstorage[key]);
                }
            } else {
                if (typeof(callback) === 'function') {
                    callback(new Error(`ShardedDBError: key '${key}' not found in tempstorage when level storages was in opening status`));
                }
            }
        }
    }

    /** Get value from db
     * @async
     * @param {string} key
     * @param {options} options
     * @returns {Promise}
     */
    async getAsync(key, options) {
        let result;
        try {
            result = await this._storageOperationAsync(key, options, 'get');
        } catch (e) {
            return Promise.reject(e);
        }
        if(result && result.toString().includes('JSON:')) {
            result = JSON.parse(result.toString().replace('JSON:', ''));
        }

        return result;
    }

    /** Callback wrapper for put method
     * @param {string} key
     * @param {string} value
     * @param {object} options
     * @param {function} callback
     */
    put(key, value, options, callback) {
        if (this.isOpened) {
            this.putAsync(key, value, options)
            .then(() => callback())
            .catch((err) => {
                if (typeof(callback) === 'function') {
                    callback(err);
                }
            });
        } else {
            this.tempstorage[key] = value;
            if (typeof(callback) === 'function') {
                callback();
            }
        }
    }

    /** Put key-value to database
     * @async
     * @param {string} key
     * @param {string} value
     * @param {object} options
     * @returns {Promise}
     */
    async putAsync(key, value, options) {
        if(typeof value === 'object') {
            value = 'JSON:' + JSON.stringify(value);
        }

        let isKeyExists;

        try {
            // try to find that key in the storages. To overwrite this key
            // we need to delete old value to guarant uniqueness of that key
            // if key not found, just put a new one
            isKeyExists = await this.get(key);
        } catch (e) {
            isKeyExists = null;
        }

        if (isKeyExists) {
            await this.delAsync(key);
        }

        let currentStorage = 0;
        let size = 0;
        try {
          size = await this._sizeOfStorageAsync(currentStorage);
        } catch (e) {
          size = 0;
        }
        
        while(size >= this.storages[currentStorage].size) {
            // we need to select storage with a free space
            if (currentStorage < this.storages.length - 1) {
                ++currentStorage;
                try {
                  size = await this._sizeOfStorageAsync(currentStorage);
                } catch (e) {
                  size = 0;
                }
            } else {
                return Promise.reject('ShardedDBError: Max size limit was reached by all of the storages');
            }
        }

        return this.storages[currentStorage].level.put(key, value, options);
    }

    /** Callback wrapper for del method 
     * @param {string} key
     * @param {string} options
     * @param {function} callback
    */
    del(key, options, callback) {
        if (this.isOpened) {
            this.delAsync(key, options)
            .then(() => {
                if (typeof(callback) === 'function') {
                    callback();
                }
            })
            .catch((err) => {
                if (typeof(callback) === 'function') {
                    callback(err);
                }
            })
        } else {
            delete this.tempstorage[key];
            if (typeof(callback) === 'function') {
                callback();
            }
        }
        
    }

    /** Deletes key from database
     * @param {string} key
     * @param {object} options
     * @returns {Promise}
     */
    async delAsync(key, options) {
        return this._storageOperationAsync(key, options, 'del');
    }

    /** Callback wrapper for close method
     * @param {function} callback
     */
    close(callback) {
        if (this.isOpened) {
            this.closeAsync()
            .then(() => {
                if (typeof(callback) === 'function') {
                    callback();
                }
            })
            .catch((err) => {
                if (typeof(callback) === 'function') {
                    callback(err);
                }
            })
        }
    }

    /** Closes all of the storages
     * @returns {Promise}
     */
    async closeAsync() {
        let queries = this.storages.map((stor) => {
            return stor.level.close();
        });

        try {
            await Promise.all(queries);
        } catch (e) {
            return Promise.reject(new Error('ShardedDBError: closing error')); 
        }
        return Promise.resolve();
    }

    /** Callback wrapper for clear method
     * @param {function} callback
     */
    clear(callback) {
        this.clearAsync()
        .then(() => {
            if (typeof(callback) === 'function') {
                callback();
            }
        })
        .catch((err) => {
            if (typeof(callback) === 'function') {
                callback(err);
            }
        })
    }

    /** Clear all storages
     * @returns {Promise}
     */
    async clearAsync() {
        let dbstring = this.name;
        return this.closeAsync()
        .then(() => {
            this.isOpened = false;
            this._clearDirectories();
            this._initializeStorages(dbstring);
        })
    }

    /** Save method */
    save(callback) {
        if(typeof callback === 'function') {
            callback();
        }
    }
}

exports.init = (name, workdir) => {
    return new ShardedDB(name, workdir);
};