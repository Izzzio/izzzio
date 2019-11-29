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

const logger = new (require(global.PATH.mainDir + '/modules/logger'))("Crypto");

const inputOutputFormat = 'hex';
const SIGN_TYPE = 'sha256';

const CryptoJS = require('crypto-js');

const crypto = require('crypto');
const keypair = require('keypair');

const CodingFunctions = require(global.PATH.mainDir + '/modules/codingFunctions');


/**
 * @var {Cryptography}
 */
let cryptography;

/**
 * Validate sign
 * @param data
 * @param sign
 * @param publicKey
 * @return {*|Boolean}
 */
function validate(data, sign, publicKey) {
    if(typeof data === 'object') {
        sign = data.sign;
        data = data.data;
    }

    let result;
    //convert key if it's not in PEM
    publicKey = publicKey.indexOf('RSA PUBLIC KEY') < 0 ? cryptography.hexToPem(publicKey, 'PUBLIC') : publicKey;
    const verify = crypto.createVerify(SIGN_TYPE);
    verify.update(data);
    result = verify.verify(publicKey, sign, inputOutputFormat);

    return result;
}

/**
 * Sign data function
 * @param data
 * @param privateKeyData
 * @return {string}
 */
function sign(data, privateKeyData) {
    let signedData;

    const _sign = crypto.createSign(SIGN_TYPE);
    _sign.update(data);
    signedData = _sign.sign(privateKeyData).toString(inputOutputFormat);
    signedData = signedData.replace('\r\n', '');

    return signedData;
}

/**
 * Generate wallet from configured credentials
 * @param {object} config
 * @return {{keysPair: {private: {senderContainerName, certificateName}, public: *}}}
 */
function generateWallet(config) {
    let keyPair = generateKeyPair(config);

    return {
        keysPair: {
            private: keyPair.private,
            public: keyPair.public
        }
    }
}

/**
 * SHA256 hash
 * @param data
 * @return {*}
 */
function sha256(data) {
    let hashBuffer;
    hashBuffer = CryptoJS.SHA256(data).toString();
    return hashBuffer;
}

/**
 * Generate key pair
 * @param config
 */
function generateKeyPair(config) {
    let keyPair;

    keyPair = keypair({bits: Number(config.keyLength)});
    keyPair.private = cryptography.repairKey(keyPair.private);
    keyPair.public = cryptography.repairKey(keyPair.public);

    if(config.signFunction === 'NEWRSA') {
        //get old rsa key in PEM format and convert to utf-16
        keyPair.public = cryptography.PEMToHex(keyPair.public);
    }

    return {private: keyPair.private, public: keyPair.public};
}

module.exports = function register(blockchain, config, storj) {
    logger.info('Initialize...');

    cryptography = storj.get('cryptography');

    cryptography.registerHash('SHA256', sha256);
    //Default generator
    cryptography.registerGenerator('', function () {
        return generateKeyPair(config);
    });

    cryptography.registerGenerator('NEWRSA', function () {
        return generateKeyPair(config);
    });
    cryptography.registerSign('NEWRSA', validate, sign);

    blockchain.wallet.registerGeneratorHook(function () {
        return generateWallet(config);
    });

    logger.info('OK');
};