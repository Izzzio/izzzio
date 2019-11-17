const levelup = require('levelup');
const leveldown = require('leveldown');
const fs = require('fs-extra');


class CustomDB {
    constructor(name, workdir) {
        this.workDir = workdir;
        this.name = name;
        this.levelup = levelup(leveldown(this.workDir + '/' + name));

    }


    get(key, options, callback) {

        this.levelup.get(key, options, function (err, result) {
            if(err) {
                return callback(err);
            }

            if(result.toString().includes('JSON:')) {
                result = JSON.parse(result.toString().replace('JSON:', ''));
            }

            return callback('', result);
        });

    }

    put(key, value, options, callback) {

        if(typeof value === 'object') {
            value = 'JSON:' + JSON.stringify(value);
        }

        this.levelup.put(key, value, function (err,) {
            callback(err);

        });
    }

    del(key, options, callback) {
        this.levelup.del(key, options, callback);
    }

    close(callback) {
        this.levelup.close(callback);
    }

    clear(callback) {
        let that = this;
        try {
            this.levelup.close(function () {
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
        if(typeof callback !== 'undefined') {
            callback();
        }
    }
}

exports.init = (name, workdir) => {
    return new CustomDB(name, workdir);
};