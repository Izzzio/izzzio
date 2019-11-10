const levelup = require('levelup');
const memdown = require('memdown');
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
        console.log('Custom DB get' + {key, options, callback});
        that.levelup.get(key, options, callback);    
    }

    put(key, value, options, callback) {
        console.log('Custom DB put');
        that.levelup.put(key, value, callback);   
    }

    del(key, options, callback) {
        console.log('Custom DB del');
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

exports.init = function init (name, workdir) {
    return new CustomDB (name, workdir);
};