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
            throw new Error("ShardedDBError: Database parameters string is not correct")
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
        }

        return storages;
    }

    async _storageOperationAsync(key, options, operation) {
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
        return resultPromise ? resultPromise.value : new Error('Not found');
    }

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

    _sizeOfStorage(stor) {
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

    get(key, options, callback) { //DONE
        let i = 0;
        let that = this;
        function getRecursive(err, res) {
            if (err) {
                if(i < that.storages.length - 1) {
                    i++;
                    that.storages[i].level.get(key, options, getRecursive);
                } else {
                    return callback(err);
                }
            }

            return callback(null, res);
        }

        return that.storages[i].level.get(key, options, getRecursive);
    }

    async getAsync(key, options) { //DONE
        let result;
        try {
            result = await this._storageOperation(key, options, 'get');
        } catch (e) {
            return Promise.reject(e);
        }
        if(result.toString().includes('JSON:')) {
            result = JSON.parse(result.toString().replace('JSON:', ''));
        }
        return result;
    }

    put(key, value, options, callback) {//DONE????
        if(typeof value === 'object') {
            value = 'JSON:' + JSON.stringify(value);
        }

        let currentStorage = 0;
        while(this._sizeOfStorage(currentStorage) >= this.storages[currentStorage].size) {
            // we need to select storage with a free space
            if (currentStorage < this.storages.length - 1) {
                ++currentStorage;
            } else {
                if (typeof(callback) === 'function') {
                    return callback(new Error('ShardedDBError: Max size limit was reached by all of the storages'));
                }
            }
        }
        
            // try to find that key in the storages. To overwrite this key
            // we need to delete old value to guarant uniqueness of key
            // if key not found, just put a new one
        this.get(key, {}, (err, res) => {
            if (res) {
                this.del(key, {}, () => {
                    return this.storages[currentStorage].level.put(key, value, options, callback);
                });
            }

            return this.storages[currentStorage].level.put(key, value, options, callback);
        })
    }

    async putAsync(key, value, options) { //DONE
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
        while(await this._sizeOfStorageAsync(currentStorage) >= this.storages[currentStorage].size) {
            // we need to select storage with a free space
            if (currentStorage < this.storages.length - 1) {
                ++currentStorage;
            } else {
                return Promise.reject('ShardedDBError: Max size limit was reached by all of the storages');
            }
        }

        return this.storages[currentStorage].level.put(key, value, options);
    }

    del(key, options, callback) { // DONE
        this.storages.forEach((stor) => {
            stor.level.get(key, {}, (err, res) => {
                if (res) {
                    stor.level.del(key, options, callback);
                }
            })
        })
    }

    async delAsync(key, options) { //DONE
        return this._storageOperationAsync(key, options, 'del');
    }

    close(callback) { //DONE
        let i = 0;
        let that = this;
        function closeRecursive(err) {
            i++
            if (err) {
                return callback(err);
            } else if (i < that.storages.length - 1) {
                return that.storages[i].level.close(closeRecursive);
            }
            return callback();
        }

        return that.storages[i].level.close(closeRecursive);
    }

    async closeAsync() { //DONE
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

    clear(callback) { ///DONE
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

    async clearAsync() { //DONE
        let dbstring = this.name;
        return this.closeAsync()
        .then(() => {
            this._clearDirectories();
            this._initializeStorages(dbstring);
        })
    }

    save(callback) { //DONE
        if(typeof callback === 'function') {
            callback();
        }
    }

    async saveAsync() { //DONE
        return Promise.resolve();
    }
}

exports.init = (name, workdir) => {
    return new ShardedDB(name, workdir);
};