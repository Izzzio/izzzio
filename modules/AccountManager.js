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

const logger = new (require('./logger'))('Accounts');
const KeyValue = require('./keyvalue');
const Wallet = require('./wallet');

class AccountManager {
    constructor(config = {}) {

        //Assign named storage
        this.namedStorage = new (require('./NamedInstanceStorage'))(config.instanceId);

        this._accounts = new KeyValue(config.accountsDB, config);
        this._config = config;
        this._registerRPCMethods();

        logger.info('Account manager loaded');
    }

    /**
     * Add account by keyname
     * @param accountName
     * @param publicKey
     * @param privateKey
     * @param id
     */
    async addAccountKeys(accountName, publicKey, privateKey, id = false) {
        let wallet = new Wallet(false, this._config);

        wallet.keysPair.public = publicKey;
        wallet.keysPair.private = privateKey;
        wallet.id = id;
        if(!wallet.selfValidate()) {
            throw new Error('Invalid wallet data');
        }

        await this._accounts.putAsync(accountName, {
            id: id,
            private: privateKey,
            public: publicKey
        });
    }

    /**
     * Add account by wallet object
     * @param {string} accountName
     * @param {Wallet} wallet
     */
    async addAccountWallet(accountName, wallet) {
        await this._accounts.putAsync(accountName, {
            id: wallet.id,
            private: wallet.keysPair.private,
            public: wallet.keysPair.public
        });
    }

    /**
     * Get account
     * @param accountName
     * @return {Promise<{id, block, keysPair: {public, private}, data, balance, addressBook, generate, signData, verifyData, getAddress, setBlock, setWalletFile, save, init, transactions, transact}>}
     */
    async getAccountAsync(accountName = false) {
        if(!accountName) {
            accountName = 'default';
        }

        try {
            let account = await this._accounts.getAsync(accountName);
            if(!account) {
                logger.error('Account "' + accountName + '" not found 1');
                return false;
            }

            let wallet = new Wallet(false, this._config);
            wallet.keysPair.private = account.private;
            wallet.keysPair.public = account.public;
            wallet.id = account.id;
            if(!wallet.id) {
                wallet.createId();
            }
            wallet.init();
            return wallet;
        } catch (e) {
            logger.error(e);
            logger.error('Account "' + accountName + '" not found 2');
            return false;
        }
    }

    /**
     * Callback getAccount version
     * @param accountName
     * @param callback
     */
    getAccount(accountName, callback) {
        this.getAccountAsync(accountName).then(function (account) {
            if(!account) {
                return callback(new Error('Account not found'));
            }

            return callback(null, account);
        });
    }

    /**
     * Register RPC methods
     * @private
     */
    _registerRPCMethods() {
        const that = this;
        let app = this.namedStorage .get('httpServer');
        if(!app) {
            logger.error("Can't register RPC methods for AccountManager");
            return;
        }

        app.get('/accounts/:accountName', async function (req, res) {
            try {
                let wallet = await that.getAccountAsync(req.params.accountName);
                res.send({id: wallet.id, public: wallet.keysPair.public});
            } catch (e) {
                res.send({error: true, message: 'Account ' + req.params.accountName + ' not found'});
            }
        });

        app.post('/accounts/add', async function (req, res) {

            let accountName = req.body.accountName;
            let id = req.body.id;
            let publicKey = req.body.public;
            let privateKey = req.body.private;

            if(!accountName || !publicKey || !privateKey) {
                res.send({error: true, message: 'accountName, public or private not found'});
                return;
            }

            if(!id) {
                id = false;
            }

            try {
                await that.addAccountKeys(accountName, publicKey, privateKey, id);
            } catch (e) {
                res.send({error: true, message: e.message});
                return;
            }

            res.send({accountName: accountName});
        });
    }


}

module.exports = AccountManager;