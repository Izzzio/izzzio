//import { METHODS } from "http";
const Http = require("http");
const Https = require("https");
const URL = require("URL");

class NodeRPC {

    constructor (baseUrl = 'http://localhost:3001/', pass = '') {
        _baseUrl = baseUrl;
        _password = pass;
        _METHODS = [
            {name:'getInfo', httpMethod: 'GET'},
            {name:'createWallet', httpMethod: 'POST'},
            {name:'changeWallet', httpMethod: 'POST'},
        ];
    }

    static _urlRequest(method = 'GET', url, params = [], password = '') {
        /*let fullUrl = url; 
        if (method.toUpperCase() === 'POST' && params.length > 0) {
            fullUrl += '?' + params.join('&');
        }
        let promise = fetch(fullUrl, {
            method: method.toUpperCase() === 'POST' ? 'POST' : 'GET',

        })*/
        let urlObj = new URL(url);
        let options = {
            /*host: urlObj.host,
            port: urlObj.port,
            path: urlObj.path,*/
            method: method.toUpperCase() === 'POST' ? 'POST' : 'GET',
            timeout: 0,
        }

        if (password) {
            options.auth = "1337:" + password;
        }


    }



}