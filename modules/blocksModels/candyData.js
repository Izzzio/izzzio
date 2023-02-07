/**
 iZ³ | Izzzio blockchain - https://izzz.io
 Candy - https://github.com/Izzzio/Candy
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


const Signable = require('./signable');
let type = 'CandyData';

/**
 * Candy data block
 * Candy - part of Izzzio blockchain. https://github.com/Izzzio/Candy
 * @type {Signable}
 */
class CandyData extends Signable {
    /**
     *
     * @param {String} data
     * @param {NamedInstanceStorage} namedStorage
     */
    constructor(data, namedStorage) {
        super();
        this.type = type;
        this.candyData = data;
        this.generateData();
        this._cryptography = namedStorage.get('cryptography');
    }

    /**
     * Создаёт строку данных для подписи
     */
    generateData() {
        this.data = this.type + this._cryptography.hash(this.candyData);
    }


}

module.exports = CandyData;