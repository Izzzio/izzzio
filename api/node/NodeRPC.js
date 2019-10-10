//import { METHODS } from "http";
const http = require("http");
const Https = require("https");

class NodeRPC {

    constructor (RPCUrl = 'http://localhost:3001/', pass = '') {
        this._baseUrl = RPCUrl;
        this._password = pass;
        this.METHODS = {    
            getInfo: 'GET',
            createWallet: 'POST',
            changeWallet: 'POST',
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
    static _urlRequest(method = 'GET', url, params = [], password = '') {
        return new Promise((resolve, reject) =>{
            let fullUrl = url; 
            if (params.length > 0) {
                fullUrl += '?' + params.join('&');
            }
            let options = {
                method: method.toUpperCase() === 'POST' ? 'POST' : 'GET',
                timeout: 0,
            };

            if (password) {
                options.auth = "1337:" + password;
            }

            const req = http.request(fullUrl, options, (res)=>{
                res.on('end', () => {
                    return resolve(res);
                })
            })

            req.on('error', (e) => {
                return reject(e);
            });

            req.end();
        })
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
            console.error('Invalid metod ' + method);
            return;
        }
        let res;
        try {
            res = await NodeRPC._urlRequest(this.METHODS[method], this._baseUrl + method + paramStr, params, this._password);
        } catch (e) {
            console.error('Request error: ' + e); 
        };

        if (res.toLowerCase() === 'true') {
            return {status: 'ok'};
        } else if (res.toLowerCase() === 'false') {
            console.error('Can\'t call method ' + $method);
        }

        let response;
        try{
         response = JSON.parse(res);
        } catch {
            console.error('RPC Error: ' + res);   
        }
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
            return {status:'ok'};
        }

        return this._request('changeWallet', [
            'id=' + id,
            'public=' + publicKey,
            `private=` + privateKey,
            'balance=0'
        ]);
    }

}
module.exports = NodeRPC;