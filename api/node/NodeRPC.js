//import { METHODS } from "http";
const http = require("http");
const Https = require("https");
//const Buffer  = require('Buffer');
//const buffer = new Buffer();

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
    static _urlRequest(method = 'GET', url = "", params = [], password = '') {
        return new Promise((resolve, reject) =>{
            let fullUrl = url; 
            let postBody = "";
            if (params.length > 0) {
                postBody = params.map(v=>{
                                let splitted = v.split("=");
                                return encodeURIComponent(splitted[0]) + '=' + encodeURIComponent(splitted[1]);
                            })
                            .join('&');
            }
            let options = {
                method: method.toUpperCase() === 'POST' ? 'POST' : 'GET',
                timeout: 0,
            };

            if (postBody){
                options.headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postBody)
                };
            }
            

            if (password) {
                options.auth = "1337:" + password;
            }
            

            const req = http.request(fullUrl, options, (res)=> {

                res.on('data', (data) => {
                    res.data = data;
                    //return resolve(res);
                })

                res.on('end', () => {
                    return resolve(res);
                });
            });

            req.on('error', (e) => {
                return reject(e);
            });

            req.write(postBody);
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
        }

        if (!res.data){
            if (res.statusMessage.toLowerCase === "ok") {
                return {status: 'ok'};
            } else {
                console.error('Can\'t call method ' + method);
            }
        }

        let response;
        try{
            let jsonRes = Buffer.from(res.data).toString();
            response = JSON.parse(jsonRes);
        } catch (e) {
            console.error('RPC Error: ' + e);   
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