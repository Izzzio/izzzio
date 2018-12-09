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
const utils = require('./utils');

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
        that.db.get(key, function(error, block){

            //console.log('GET key: '+key);

            if(!error){
                try {
                    let value = utils.unicode2HexString(block);
                    value = JSON.parse(value);
                    block = value;
                } catch(e) {

                    //console.log(e.stack);

                    block = JSON.parse(block);
                }
            }
            callback(error, block);
        });
    }

    put(key, value, callback) {

        //console.log('PUT key: '+key);

        let that = this;
        value = JSON.stringify(value);
        value = utils.hexString2Unicode(value);
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

    save(callback){
        let that = this;
        that.db.save(callback);
    }
}

module.exports = Blockchain;
