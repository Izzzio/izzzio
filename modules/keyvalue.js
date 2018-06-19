/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const logger = new (require('./logger'))();
const storj = require('./instanceStorage');
const levelup = require('levelup');
const memdown = require('memdown');
const leveldown = require('leveldown');
const fs = require('fs-extra');

const STORAGE_TYPE = {
    MEMORY: 0,
    LEVELDB: 1,
};

/**
 * KeyValue provider
 */

class KeyValue {
    constructor(name) {
        this.type = STORAGE_TYPE.MEMORY;
        this.memKeyValue = {};
        this.config = storj.get('config');
        this.levelup = null;
        this.name = name;

        if(!name) {
            name = undefined;
        }

        if(typeof name !== 'undefined' && name.indexOf('mem://') !== -1) { //Memory with saving storage
            this.type = STORAGE_TYPE.MEMORY;
            this.name = name.split('mem://')[1];

            try {
                this.memKeyValue = JSON.parse(fs.readFileSync(this.config.workDir + '/' + this.name));
            } catch (e) {
                console.log(e);
            }


        } else if(typeof name !== 'undefined') { //LevelDB storage
            this.type = STORAGE_TYPE.LEVELDB;
            this.levelup = levelup(leveldown(this.config.workDir + '/' + name));
            //this.levelup = levelup(memdown());//levelup(this.config.workDir + '/blocks');
        }
    }

    /**
     * Returns levelup object if exists
     * @return {null|*}
     */
    getLevelup() {
        return this.levelup;
    }

    /**
     * Get from key-value
     * @param key
     * @param options
     * @param callback
     */
    get(key, options, callback) {
        let that = this;
        if(typeof options === 'function') {
            callback = options;
        }
        key = String(key);

        switch (that.type) {
            case STORAGE_TYPE.MEMORY:
                if(typeof callback !== 'undefined') {
                    if(typeof that.memKeyValue[key] !== 'undefined') {
                        callback(null, that.memKeyValue[key]);
                    } else {
                        callback(true, undefined);
                    }
                }
                break;
            case STORAGE_TYPE.LEVELDB:
                that.levelup.get(key, options, callback);
                break;
        }


    }

    /**
     * Put to key-value
     * @param key
     * @param value
     * @param options
     * @param callback
     */
    put(key, value, options, callback) {
        let that = this;
        if(typeof options === 'function') {
            callback = options;
        }
        key = String(key);
        switch (that.type) {
            case STORAGE_TYPE.MEMORY:

                that.memKeyValue[key] = value;
                if(typeof callback !== 'undefined') {
                    callback(null);
                }
                break;
            case STORAGE_TYPE.LEVELDB:
                that.levelup.put(key, value, callback);
                break;
        }


    }

    /**
     * Delete by key
     * @param key
     * @param options
     * @param callback
     */
    del(key, options, callback) {
        let that = this;
        if(typeof options === 'function') {
            callback = options;
        }
        key = String(key);
        switch (that.type) {
            case STORAGE_TYPE.MEMORY:
                this.put(key, undefined, callback);
                break;
            case STORAGE_TYPE.LEVELDB:
                that.levelup.del(key, options, callback);
                break;
        }


    }


    /**
     * Close database
     * @param callback
     */
    close(callback) {

        let that = this;
        switch (that.type) {
            case STORAGE_TYPE.MEMORY:
                that.save(function () {
                    if(typeof callback !== 'undefined') {
                        callback();
                    }
                });

                break;
            case STORAGE_TYPE.LEVELDB:
                that.levelup.close(callback);
                break;
        }
    }

    /**
     * Clear database
     * @param callback
     */
    clear(callback) {
        let that = this;
        switch (that.type) {
            case STORAGE_TYPE.MEMORY:
                that.memKeyValue = {};
                if(typeof callback !== 'undefined') {
                    callback();
                }
                break;
            case STORAGE_TYPE.LEVELDB:
                try {
                    that.levelup.close(function () {
                        fs.removeSync(that.config.workDir + '/wallets');
                        that.levelup = levelup(leveldown(that.config.workDir + '/' + that.name));
                        if(typeof callback !== 'undefined') {
                            callback();
                        }
                    });
                } catch (e) {
                    if(typeof callback !== 'undefined') {
                        callback();
                    }
                }
                break;
        }
    }

    save(callback) {
        let that = this;
        switch (that.type) {
            case STORAGE_TYPE.MEMORY:
                if(typeof that.name !== 'undefined') {
                    fs.writeFileSync(that.config.workDir + '/' + that.name, JSON.stringify(that.memKeyValue));
                }
                if(typeof callback !== 'undefined') {
                    callback();
                }
                break;
            case STORAGE_TYPE.LEVELDB: //LevelDB can't save manually
                if(typeof callback !== 'undefined') {
                    callback();
                }
                break;
        }
    }
}

module.exports = KeyValue;
