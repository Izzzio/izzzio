/**
 * Encryption protocol for starwave
 *
 *
 *
 **/
'use strict';

const crypto = require("crypto");

class StarwaveEncryption {
    /*constructor(bits = 2048){
        //diffiehellman object
        this.keyObject = crypto.createDiffieHellman(bits);
        this.public = this.generateKeys();
    };*/

    constructor(curve = 'secp521r1'){
        // edcaobject
        this.keyObject = crypto.createECDH(curve);
        this.public = this.generateKeys();
    };

    generateKeys (){
        let publicKey = this.keyObject.generateKeys('hex');
        return publicKey;
    }

    createSecret(externalPublic){
        let secret = this.keyObject.computeSecret(externalPublic, 'hex', 'hex');
        return secret;
    };

    cipherData(data, secret, algorithm = 'aes256'){
        const cipher = crypto.createCipher(algorithm, secret);
        let encrypted = cipher.update(data,'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decipherData(encryptedData, secret, algorithm = 'aes256'){
        const decipher = crypto.createDecipher(algorithm, secret);
        let data = decipher.update(encryptedData,'hex', 'utf8');
        data += decipher.final('utf8');
        return data;
    }

}

module.export = StarwaveEncryption;
/*
console.log('start');
let st1 = new StarwaveEncryption();
console.log(st1);
console.log(st1.public.toString('hex'));
console.log('');
let st2 = new StarwaveEncryption();
console.log(st2);
console.log('');

let s1 = st1.createSecret(st2.public);
let s2 = st2.createSecret(st1.public);

console.log('secrets');
console.log(s1);
console.log(s2);
console.log('messages');
let d1 = st1.cipherData('hello',s1);
console.log(d1);
let d2 = st1.decipherData(d1,s2);
console.log(d2);



/!*console.log('secret keys');
let sk1 = st.createSecret(k2.public)*!/*/
