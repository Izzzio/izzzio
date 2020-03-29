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

class ShardedDBError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ShardedDBError';
    }
}

class ShardedDB {
    constructor(name, workdir) {
        this.workDir = workdir;
        this.name = name;
        this.storages = this._initializeStorages(name);
    }

    // Private methods

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
            throw new ShardedDBError("Database parameters string is not correct")
        }

        return { storage, size };
    }

    _initializeStorages(name) {
        let storages = new Array();
        let shards = name.split('&');
        shards = shards.map((el) => {
            return this._initializeDbParams(el); // parsing DB strings
        });

        for (let shard of shards) {
            const storage = {
                path: shard.storage,
                level: level(shard.storage),
                size: shard.size
            };
            storages.push(storage);
        };

        return storages;
    }

    async _storageOperation(key, options, operation) {
        // wrapper for get, del operations, that
        // starts chain of promises and wait all of them to resolve/reject
        // returns only one correct promise
        let queries = new Array();
        for (let stor of this.storages) {
            queries.push(stor.level[operation](key, options));
        }

        queries = await Promise.allSettled(queries);

        let resultPromise;
        queries.forEach((promise) => {
            if (promise.status === "fulfilled") {
                resultPromise = promise;
            }
        })
        return resultPromise ? Promise.resolve(resultPromise.value) : Promise.reject(new NotFoundError);
    }

    async _sizeOfStorage(stor) {
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
        return await sizes;
    }

    _sizeOfStorageSync(stor) {
        const dir = this.storages[stor].path;
        let sizes;
        const files = fs.readdirSync(dir);
        sizes = files.map((file) => fs.statSync(dir + path.sep + file));
        sizes = sizes
        .map((stat) => {
            return stat.size;
        })
        .reduce((acc, size) => acc + size);
        return sizes;
    }

    _clearDirectories() {
        this.storages
        .map((stor) => stor.path)
        .forEach((path) => fs.removeSync(path));
    }

    //Public methods

    async get(key, options, callback) {
        let result;
        if (typeof(callback) !== 'function') {
            try {
                result = await this._storageOperation(key, options, 'get');
            } catch (e) {
                return Promise.reject(e);
            }
            if(result.toString().includes('JSON:')) {
                result = JSON.parse(result.toString().replace('JSON:', ''));
            }
            return Promise.resolve(result);
        } else {
            try {
                result = await this._storageOperation(key, options, 'get');
                if(result.toString().includes('JSON:')) {
                    result = JSON.parse(result.toString().replace('JSON:', ''));
                }
                return callback(null, result);
            } catch (err) {
                return callback(err);
            }
        }
    }

    async put(key, value, options, callback) {
        if(typeof value === 'object') {
            value = 'JSON:' + JSON.stringify(value);
        }

        try {
            // try to find that key in the storages. To overwrite this key
            // we need to delete old value to guarant uniqueness of that key
            // if key not found, just put a new one
            await this.get(key);
        } catch (e) {
            this.del(key);
        }

        let currentStorage = 0;
        while(await this._sizeOfStorage(currentStorage) >= this.storages[currentStorage].size) {
            // we need to select storage with a free space
            if (currentStorage < this.storages.length - 1) {
                ++currentStorage;
                console.log('changed storage to ', currentStorage);
            } else {
                return Promise.reject('Max size limit was reached by all of the storages');
            }
        }

        if (typeof(callback) === 'function') {
            return this.storages[currentStorage].level.put(key, value, options, callback);
        } else {
            return this.storages[currentStorage].level.put(key, value, options);
        }
    }

    async del(key, options, callback) {
        if (typeof(callback) !== 'function') {
            return this._storageOperation(key, options, 'del');
        } else {
            try {
                await this._storageOperation(key, options, 'del');
            } catch (err) {
                return callback(err);
            } finally {
                return callback(null);
            }
        }
    }

    async close(callback) {
        let queries = this.storages.map((stor) => {
            return stor.level.close();
        });

        let promises = Promise.all(queries);

        if (typeof(callback) === 'function') {
            promises.then(() => callback()).catch((err) => callback(err));
        } else {
            return promises;
        }
    }

    clear(callback) { /// JUST DO IT!!!!!
        let dbstring = this.name;
        let result;
        this.close()
        .then(() => {
            this._clearDirectories();
            this._initializeStorages(dbstring);
            result = null;
        })
        .catch((err) => result = err);

        if (typeof(callback) === 'function') {
            callback(result);
        } else {
            return result ? Promise.reject(err) : Promise.resolve();
        }
    }

    async save(callback) {
        if(typeof callback === 'function') {
            callback();
        } else {
            return Promise.resolve();
        }
    }
}

exports.init = (name, workdir) => {
    return new ShardedDB(name, workdir);
};