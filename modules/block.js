/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * It's a Block
 * Just block It!
 */
class Block {
    constructor(index, previousHash, timestamp, data, hash, startTimestamp, sign) {

        if(typeof data === 'object') {
            data = JSON.stringify(data);
        }

        this.index = index;
        this.previousHash = String(previousHash).toString();
        this.timestamp = timestamp;
        this.startTimestamp = startTimestamp;
        this.data = data;
        this.hash = String(hash).toString();
        this.sign = sign;
    }
}

module.exports = Block;