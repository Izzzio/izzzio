/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const logger = new (require('./logger'))();
const storj = require('./instanceStorage');
const KeyValue = require('./keyvalue');
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
        //this.levelup = levelup(leveldown(this.config.workDir + '/blocks'));
        //this.levelup = levelup(memdown());//levelup(this.config.workDir + '/blocks');
        this.db = new KeyValue(this.config.blocksDB);
    }

    getLevelup() {
        return this.db.getLevelup();
    }

    getDb(){
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

    del(key, callback) {
        let that = this;
        that.db.del(key, callback);
    }

    close(callback) {
        let that = this;
        that.db.close(callback);
    }
}

module.exports = Blockchain;
