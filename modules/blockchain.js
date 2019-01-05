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
        that.db.get(key, function (error, block) {
            if (!error) {
                try{
                    block = JSON.parse(block);



                    /*
                    if(typeof block === 'object'){
                        var hash = block.hash || false;
                        //console.log('GET origin HASH: '+hash);
                    }
                    */




                    if(that.config.compressHexData){
                        if(typeof block === 'object'){
                            let previousHash = block.previousHash || false;
                            let hash = block.hash || false;
                            let sign = block.sign || false;

                            if(previousHash && previousHash.length){
                                block.previousHash = utils.unicode2HexString(previousHash);
                            }
                            if(hash && hash.length){
                                block.hash = utils.unicode2HexString(hash);
                            }
                            if(sign && sign.length){
                                block.sign = utils.unicode2HexString(sign);
                            }
                        }
                    }


                    //console.log(block);
                    //console.log('READ <<<<<<<<<<<<<<<<<<<<<<<<<<<');

                    //console.log('GET Decompress HASH: '+block.hash);



                } catch (e) {
                    logger.error('Error prepare block getted from db.');
                    //console.log(block);
                    //console.log(e);
                }
            }
            callback(error, block);
        });
    }

    put(key, value, callback) {
        let that = this;


        /*
        let hash = value.hash || false;
        console.log('PUT origin HASH: '+hash);
        */


        if(that.config.compressHexData){
            if(typeof value === 'object'){
                let previousHash = value.previousHash || false;
                let hash = value.hash || false;
                let sign = value.sign || false;
                if(previousHash){
                    previousHash = utils.hexString2Unicode(previousHash);
                    if(false !== previousHash){
                        value.previousHash = previousHash;
                    }
                }
                if(hash && hash.length){
                    hash = utils.hexString2Unicode(hash);
                    if(false !== hash){
                        value.hash = hash;
                    } else {
                        console.log('ERROR COMPRESS HASH - '+value.hash);
                        process.exit();
                    }
                }
                if(sign && sign.length){
                    sign = utils.hexString2Unicode(sign);
                    if(false !== sign){
                        value.sign = sign;
                    }
                }


            //console.log(value);
            //console.log('WRITE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

            }
        }


        //console.log('PUT compress HASH: '+hash);



        value = JSON.stringify(value);
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
