const levelup = require('levelup');
const leveldown = require('leveldown');
const fs = require('fs-extra');
let that;

class CustomDB {
    constructor(name, workdir){
        this.workDir = workdir;
        this.name = name;
        this.levelup = levelup(leveldown(this.workDir + '/' + name));     
        that = this;   
    }


    get(key, options, callback) {
        console.log('Custom DB get' + JSON.stringify({key, options, callback}));
        //console.trace()
       
        that.levelup.get(key, options, function (err, result) {
            if(err) {
                return callback(err);
            }

            if(that.type === STORAGE_TYPE.LEVELDB && result.toString().includes('JSON:')) {
                result = JSON.parse(result.toString().replace('JSON:', ''));
            }

            return callback('',result);
        });   
         
    }

    put(key, value, options, callback) {
        console.log('Custom DB put' + JSON.stringify({key, value, options, callback}));
        if(typeof value === 'object') {
            value = 'JSON:' + JSON.stringify(value);
        }
        //console.trace()
        that.levelup.put(key, value, callback);   
    }

    del(key, options, callback) {
        console.log('Custom DB del' + JSON.stringify({key, options, callback}));
        that.levelup.del(key, options, callback);    
    }

    close(callback) {
        console.log('Custom DB close');
        that.levelup.close(callback);    
    }

    clear(callback) {
        console.log('Custom DB clear');
        try {
            that.levelup.close(function () {
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
        console.log('Custom DB save');
        if(typeof callback !== 'undefined') {
            callback();
        }    
    }
}

exports.init = (name, workdir) => {
    const newDB = new CustomDB (name, workdir);
    return newDB;
};