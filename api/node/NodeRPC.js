//import { METHODS } from "http";
const Http = require("http");
const Https = require("https");
const URL = require("URL");

class NodeRPC {

    constructor (baseUrl = 'http://localhost:3001/', pass = '') {
        this._baseUrl = baseUrl;
        this._password = pass;
        this._METHODS = [
            {name:'getInfo', httpMethod: 'GET'},
            {name:'createWallet', httpMethod: 'POST'},
            {name:'changeWallet', httpMethod: 'POST'},
        ];
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
            let urlObj = new URL(fullUrl);
            let options = {
                method: method.toUpperCase() === 'POST' ? 'POST' : 'GET',
                timeout: 0,
            }

            if (password) {
                options.auth = "1337:" + password;
            }

            const req = http.request(fullUrl, options, (res)=>{
                return resolve(res);
            })

            req.on('error', (e) => {
                return reject(e);
            });

            req.end();
        })
    }

    _request(method, params = [], paramStr = '') {
        if (!this._METHODS.find(x => x.name === method.toUpperCase())) {
            console.error('Invalid metod ' + method);
            return;
        }

        
    }

}