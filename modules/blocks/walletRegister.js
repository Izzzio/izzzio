/**
 iZ³ | Izzzio blockchain - https://izzz.io
 BitCoen project - https://bitcoen.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Wallet Registration
 *  Must be signed before writing to blockchain
 */
const Signable = require('./signable');

let type = 'WalletRegister';

class WalletRegister extends Signable {
    constructor(id) {
        super();
        this.type = type;
        this.id = String(id);
        this.data = this.type + this.id;
    }
}

module.exports = WalletRegister;