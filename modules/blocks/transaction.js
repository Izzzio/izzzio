/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Token transaction
 * Must be signed before writing to blockchain
 */

const Signable = require('./signable');

let type = 'Transaction';

class Transaction extends Signable {
    /**
     *
     * @param from From wallet
     * @param to To wallet
     * @param amount Amount
     * @param timestamp Transaction creation timestamp
     * @param fromTimestamp Transaction activation timestamp
     */
    constructor(from, to, amount, timestamp, fromTimestamp) {
        super();
        this.type = type;
        this.from = String(from);
        this.to = String(to);
        this.amount = Number(amount);
        this.timestamp = Number(timestamp);
        this.fromTimestamp = Number(fromTimestamp);
        this.data = this.type + this.from + this.to + this.amount + this.timestamp + this.fromTimestamp;
    }
}

module.exports = Transaction;