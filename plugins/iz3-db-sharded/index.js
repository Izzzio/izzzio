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

const logger = new (require(global.PATH.mainDir + '/modules/logger'))("ShardedDbPlugin");
const path = require('path');

const PROTOCOL_PREFIX = 'levelsharded';

module.exports = function register(blockchain, config, storj) {
    logger.info('Initialize sharded DB');

    let plugins = storj.get('plugins');
    //console.log(JSON.stringify(plugins));
    //console.log(plugins);
    plugins.db.registerModule(PROTOCOL_PREFIX, __dirname + path.sep + 'shardedDB.js');
    //console.log(plugins);
    logger.info('OK');
};