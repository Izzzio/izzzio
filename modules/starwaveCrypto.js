/**
 * Encryption protocol for starwave
 * new fields in message object:
 * encrypted - means that message is encrypted
 * publicKey - public key of the sender which wants to make crypted tunnel
 *
 **/
'use strict';


const crypto = require("crypto");

class StarwaveCrypto {
    /*constructor(bits = 2048){
        //diffiehellman object
        this.keyObject = crypto.createDiffieHellman(bits);
        this.public = this.generateKeys();
    };*/

    constructor(starwave, curve = 'secp521r1'){
        // EDCA object
        this.keyObject = crypto.createECDH(curve);
        this.public = this.generateKeys();
        this.starwave = starwave;
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

    decipherMessage(message){
        let decryptedData;

        //if message didn't encrypted, return data
        if (!message.encrypted){
            return decryptedData = message.data;
        }

        //if we have secret key associated with this socket than we have th e tunnel
        if (this.starwave.blockchain.secretKeys[message.sender]){
            decryptedData = this.decipherData(message.data, this.starwave.blockchain.secretKeys[message.sender]);
            message.data = decryptedData;
            delete message.encrypted;
        }
        return decryptedData;
    }

    cipherMessage(message){
        let cryptedData;
        //should be assotiated secret key and check that message has not been already encrypted
        if (this.starwave.blockchain.secretKeys[message.reciver] && !message.encrypted){
            cryptedData = this.cipherData(message.data, this.starwave.blockchain.secretKeys[message.reciver]);
            message.encrypted = true;
            message.data = cryptedData;
        }
        return cryptedData;
    }

    handleIncomingMessage(message){
        //watch if the message has Public key field then the message is only for sending the key
        if (message.publicKey) {
            //if we don't have secret key then we save sender publickey and create secret and send our public to make connection
            if (!this.starwave.blockchain.secretKeys[message.sender]){
                this.makeConnection(message.sender);
            }
            this.starwave.blockchain.secretKeys[message.sender] = this.createSecret(message.publicKey);
            delete message.publicKey;
            return 0;
        }
        //try to decipher message if it possible
        return this.decipherMessage(message, socket); //undefined if we have errors
    }

    makeConnection(messageBus){
        let message = this.starwave.createMessage('',messageBus,this.starwave.config.recieverAddress,'DH-CONNECTION');
        message.publicKey = this.public;
        this.starwave.sendMessage(message);
        return message;
    }

    sendMessage(message){
        //check if we have secret key for reciver
        let sk = this.starwave.blockchain.secretKeys[message.reciver]; //secret key
        if (sk){
            if (this.cipherMessage(message)){
                this.starwave.sendMessage(message);
                return 0;
            }else{
                console.log("Error: Can't cipher message");
                return 2;
            }
        }
        else
        {
            console.log(`Error: there is no secret key for ${message.reciver}`)
            return 1;
        }
    }

}

module.exports = StarwaveCrypto;
/*
console.log('start');
let st1 = new StarwaveCrypto();
console.log(st1);
console.log(st1.public.toString('hex'));
console.log('');
let st2 = new StarwaveCrypto();
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
