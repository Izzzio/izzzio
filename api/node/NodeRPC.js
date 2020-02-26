const http = require("http");
const stringify = require("json-stable-stringify");

class NodeRPC {

    constructor(RPCUrl = 'http://localhost:3001/', pass = '') {
        if (RPCUrl.charAt(RPCUrl.length) !== '/') {
            RPCUrl += '/';
        }
        this._baseUrl = RPCUrl;
        this._password = pass;
        this.METHODS = {
            'getInfo': 'GET',
            'createWallet': 'POST',
            'changeWallet': 'POST',
            'getBlock': 'GET',
        };
    }

    /**
     * URL request
     * @param {string} method
     * @param {string} url
     * @param {Array} params
     * @param {string} password
     * @returns {object}
     */
    static _urlRequest(method = 'GET', url = "", params = [], password = '', login = "1337") {
        return new Promise((resolve, reject) => {

            let postBody = "";

            if (Array.isArray(params) && params.length > 0) {

                //convert "['param1=value1', 'param2=value2']" to object {param1:value1, param2:value2}
                postBody = params.reduce((prev, cur) => {
                    let splitted = cur.split("=");
                    prev[splitted.shift()] = splitted.join("=").replace(/ +/g, ' '); //remove \n and unnecessary spaces
                    return prev;
                }, {});
            }
            let options = {
                method: method.toUpperCase() === 'POST' ? 'POST' : 'GET',
                timeout: 0,
            };

            if (postBody) {
                options.headers = {
                    'Content-Type': 'application/json',
                    // 'Content-Length': Buffer.byteLength(postBody)
                };
            }


            if (password) {
                options.auth = login + ":" + password;
            }


            const req = http.request(url, options, (res) => {
                if (res.statusCode !== 200) {
                    return reject('Invalid response code: ' + res.statusCode);
                }

                res.on('response', (resp) => {
                    console.log(resp)
                });
                res.on('data', (data) => {
                    res.data = data;
                });

                res.on('end', () => {
                    return resolve(res);
                });
            });

            req.on('error', (e) => {
                return reject(e);
            });

            if (req.method === "POST") {
                req.write(stringify(postBody));
            }
            req.end();
        });
    }

    /**
     * Make RPC request
     * @param {string} method
     * @param {array} params
     * @param {string} paramStr
     * @returns {Promise}
     */
    async _request(method = "", params = [], paramStr = '') {
        //method = method.toLowerCase();
        if (!this.METHODS[method]) {
            throw new Error('Invalid metod ' + method);
        }

        let res = await NodeRPC._urlRequest(this.METHODS[method], this._baseUrl + method + paramStr, params, this._password);

        if (!res.data) {
            if (res.statusMessage.toLowerCase === "ok") {
                return {status: 'ok'};
            } else {
                throw new Error('Can\'t call method ' + method);
            }
        }

        let response;
        let jsonRes = Buffer.from(res.data).toString();
        response = JSON.parse(jsonRes);

        return response;
    }

    /**
     * Returns current blockchain status and node info
     * @returns {Promise}
     */
    getInfo() {
        return this._request('getInfo');
    }

    /**
     * Generate and register new wallet with id, block id, private and public keysPair
     * @returns {Promise}
     */
    createWallet() {
        return this._request('createWallet');
    }

    /**
     * Get current wallet address
     */
    async getWallet() {
        let info = await this.getInfo();
        return info.wallet.id;
    }

    /**
     * Change current wallet for node. The transactions list was recalculated Which can take a long time
     * @param {string} id
     * @param {string} privateKey
     * @param {string} publicKey
     * @returns {Promise}
     */
    async changeWalletByData(id, privateKey, publicKey) {
        let walletId = await this.getWallet();
        if (walletId === id) {
            return {status: 'ok'};
        }

        return this._request('changeWallet', [
            'id=' + id,
            'public=' + publicKey,
            `private=` + privateKey,
            'balance=0'
        ]);
    }

    /**
     * Get block with id
     * @param {number|string} blockId
     */
    getBlockById(blockId) {
        return this._request('getBlock', [], '/' + blockId);
    }

}

module.exports = NodeRPC;