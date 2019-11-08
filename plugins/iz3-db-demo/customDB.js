const levelup = require('levelup');
const memdown = require('memdown');
const leveldown = require('leveldown');
const fs = require('fs-extra');

class CustomDB {
    constructor(name, workdir){
        this.workDir = workdir;
        this.name = name;
        this.levelup = levelup(leveldown('haha' + '/' + workdir + '/' + name));        
    }

    get(key, options, callback) {
        console.log('Custom DB get');
        this.levelup.get(key, options, callback);    
    }

    put(key, value, options, callback) {
        console.log('Custom DB put');
        this.levelup.put(key, value, callback);   
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
                fs.removeSync(this.workDir + '/' + this.name);
                this.levelup = levelup(leveldown(this.workDir + '/' + this.name));
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

module.exports = function init (name, workdir) {
    return new CustomDB (name, workdir);
};