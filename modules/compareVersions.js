/**
 * Module for compare versions
 *
 */

'use strict';

const semver = require('semver');

class CompareVersions {
    constructor() {
        this.keys = {
            izzzio: ['engines', 'izzzio'],
        };
    }

    readIzzzioMinVersionNeeded(path) {
        let pluginInfo = require(__dirname + '/.' + path + '/package.json');

        return ((pluginInfo || {})[this.keys.izzzio[0]] || {})[this.keys.izzzio[1]];
    }

    isMinimumVersionMatch(minVersionNeeded, currVersion) {
        minVersionNeeded = semver.minVersion(minVersionNeeded).version;

        return semver.lte(minVersionNeeded, currVersion);
    }
}

module.exports = CompareVersions;