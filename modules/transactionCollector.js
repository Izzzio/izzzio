/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 Module which made transactions collections
 */


'use strict';

class transactionCollector {

    constructor (blockchainObject) {
        this.blockchain = blockchainObject;
    }

    parseTransactionMessageData(message) {
        return;
    }

    /**
     * проверяет наличие данной транзакции в коллекции
     * @param hash
     * @param collection
     */
    checkTransactionMessageDublicate (hash, collection = this.blockchain.transactionsCollection) {
        //перебираем все ключи(хэши) пока не найдем нужный
        return this.blockchain.transactionsCollection[hash];
    }

    /**
     * получаем максимальный fee
     */
    getMaxFee() {
        let maxFee = 0;
        let collection = this.blockchain.transactionsCollection;
        if (collection.length > 0){         //массив отсортирован по fee. максимум вначале, минимум в конце.
            let keys = Object.keys(collection);
            maxFee = collection[keys[0]].fee;
        }
        return maxFee;
    }

    getMaxFeeElements(count = 0, shouldDelete = false) {
        count = count > 0 ? count : 0; //если 0 - значит, все полученные элементы

        let elems = []; //массив с выбранными элементами
        let collection = this.blockchain.transactionsCollection; //чтобы писать поменьше

        if (collection.length < 1) {    //если коллекция пуста, возвращаем пустой массив
            return [];
        }
        let k = count | collection.length - 1; //счетчик выбранных элементов
        let maxFee = this.getMaxFee();

        for (let key in collection) {
            if (collection.hasOwnProperty(key)) {
                if (collection[key].fee === maxFee) {
                    elems[key] = collection[key];
                    //проверяем, если нужно удаление, то удаляем найденный элемент из массива
                    if (shouldDelete) {
                        collection.splice(key, 1);
                    }
                    if (--k === 0) {    //если выбрали нужное количество элементов, то выходим из цикла
                        break;
                    }
                }
            }
        }
        return elems;
    }

    handleMessage(message, messageHandlers) {

    }

}