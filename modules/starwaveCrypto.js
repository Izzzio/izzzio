/**
 * Encryption protocol for starwave
 * new fields in message object:
 * encrypted - means that message is encrypted
 * publicKey - public key of the sender which wants to make crypted tunnel
 *
 * Using secp256k1 curve and aes256 algorithm as default
 **/
'use strict';


const crypto = require("crypto");
const logger =new (require('./logger'))('StarwaveCrypto');

class StarwaveCrypto {
    /*constructor(bits = 2048){
        //diffiehellman object
        this.keyObject = crypto.createDiffieHellman(bits);
        this.public = this.generateKeys();
    };*/

    constructor(starwave, curve = 'secp256k1'){
        // ECDH object
        this.keyObject = crypto.createECDH(curve);
        this.public = this.generateKeys();
        this.starwave = starwave;
    };

    /**
     * generate keys object for Diffie-Hellman
     * @returns {*}
     */
    generateKeys (){
        let publicKey = this.keyObject.generateKeys('hex');
        return publicKey;
    }

    /**
     * create secret key based on external public key
     * @param externalPublic
     * @returns {*}
     */
    createSecret(externalPublic){
        let secret;
        try {
            secret = this.keyObject.computeSecret(externalPublic, 'hex', 'hex');
        } catch (err) {
            logger.error('Can not create secret key ' + err); //if externalPublic is wrong
        }
        return secret;
    };

    /**
     * Encrypts data
     * @param data
     * @param secret
     * @param algorithm
     */
    cipherData(data, secret, algorithm = 'aes256'){
        const cipher = crypto.createCipher(algorithm, secret);
        let encrypted = cipher.update(data,'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    /**
     * Decripts data
     * @param encryptedData
     * @param secret
     * @param algorithm
     * @returns {*}
     */
    decipherData(encryptedData, secret, algorithm = 'aes256'){
        const decipher = crypto.createDecipher(algorithm, secret);
        let data = decipher.update(encryptedData,'hex', 'utf8');
        data += decipher.final('utf8');
        return data;
    }

    /**
     * decrypts data field in message
     * @param message
     * @returns {*}
     */
    decipherMessage(message){
        let decryptedData;

        //if message didn't encrypted, return data
        if (!message.encrypted){
            return decryptedData = message.data;
        }

        //if we have secret key associated with this socket than we have the tunnel
        if (this.starwave.blockchain.secretKeys[message.sender]){
            decryptedData = this.decipherData(message.data, this.starwave.blockchain.secretKeys[message.sender]);
            //try to parse json
            try{
                decryptedData = JSON.parse(decryptedData)
            } catch (e) {
                logger.error("An error occurred while parsing decrypted text: " + e);
            }
            message.data = decryptedData;
            delete message.encrypted;
        }
        return decryptedData;
    }

    /**
     * encrypts data field in message
     * @param message
     * @returns {*}
     */
    cipherMessage(message){
        let cryptedData;
        //should be assotiated secret key and check that message has not been already encrypted
        if (this.starwave.blockchain.secretKeys[message.reciver] && !message.encrypted){
            cryptedData = this.cipherData(JSON.stringify(message.data), this.starwave.blockchain.secretKeys[message.reciver]);
            message.encrypted = true;
            message.data = cryptedData;
        }
        return cryptedData;
    }

    /**
     * processes incoming message
     * @param message
     * @returns {*}
     */
    handleIncomingMessage(message){
        //watch if the message has Public key field then the message is only for sending the key
        if (message.publicKey) {
            let sc = this.createSecret(message.publicKey); //exclude situation with exception on wrong public
            //if we don't have secret key then we save sender publickey and create secret and send our public to make connection
            if (!this.starwave.blockchain.secretKeys[message.sender] && sc){
                this.makeConnection(message.sender);
            }
            if (sc){
                this.starwave.blockchain.secretKeys[message.sender] = sc;
            }
            delete message.publicKey;
            return 0;
        }
        //try to decipher message if it possible
        return this.decipherMessage(message); //undefined if we have errors
    }

    /**
     * send public key to messagebus address
     * @param messageBus
     * @returns {{data: *, reciver: *, sender: *, id: *, timestamp: number, TTL: number, index: *, mutex: string, relevancyTime: Array, route: Array, type: number, timestampOfStart: number}|any|{type: number, data: *, reciver: *, recepient: *, id: *, timestamp: number, TTL: number, index: number}}
     */
    makeConnection(messageBus){
        let message = this.starwave.createMessage('',messageBus,this.starwave.config.recieverAddress,'DH-CONNECTION');
        message.publicKey = this.public;
        this.starwave.sendMessage(message);
        return message;
    }

    /**
     * send message using encryption protocol
     * @param message
     * @returns {number}
     */
    sendMessage(message){
        //check if we have secret key for reciver
        let sk = this.starwave.blockchain.secretKeys[message.reciver]; //secret key
        if (sk){
            if (this.cipherMessage(message)){
                this.starwave.sendMessage(message);
                return message;
            }else{
                logger.error("Can't cipher message");
                return 2;
            }
        }
        else
        {
            logger.error(`There is no secret key for address: ${message.reciver}`)
            return 1;
        }
    }

}

module.exports = StarwaveCrypto;