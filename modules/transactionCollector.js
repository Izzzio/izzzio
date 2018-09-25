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

    /**
     * получить длину коллекции
     * @returns {number}
     */
    getCollectionLength() {
        return this.blockchain.transactionsCollection.length;
    }

    /**
     * разбираем входящее сообщение
     * @param messageData
     * @returns {any}
     */
    parseTransactionMessageData(messageData) {
        let data;
        try {
            data = JSON.parse(messageData);
        } catch (e) {
            data = messageData;
        }
        return data;
    }

    /**
     * выбирает из массива элементы с заданным значением заданного параметра и возвращает массив. если массив пустой, значит, таких элементов нет
     * @param keyName //наизвание свойства
     * @param keyValue //значение свойства
     * @param collection //коллекция, по которой осуществляется поиск
     * @returns {*}
     */
    findTransactions (keyName = 'hash', keyValue, collection = this.blockchain.transactionsCollection) {
        //перебираем все ключи(хэши) пока не найдем нужный
        return collection.find( item => item[keyname] === keyValue);
    }

    /**
     * получаем максимальный fee
     * @param collection
     * @returns {number}
     */
    getMaxFee(collection = this.blockchain.transactionsCollection) {
        // поскольку массив коллекции отсортирован в порядке убывания fee, то максимальный fee будет у элемента с индексом 0
        //коллекция пуста, то устанавливаем maxFee = -1;
        let maxFee = -1;
        if (this.getCollectionLength() > 0) {
            maxFee = collection[0];
        }
        return maxFee;
    }

    /**
     * получить список элементов с максимальным fee
     * @param count
     * @param shouldDelete //флаг удаления элемента из коллекции после получения
     * @returns {Array}
     */
    getTransactionsWithMaxFee(count = this.getCollectionLength() , shouldDelete = false) {
        count = count > 0 ? count : this.getCollectionLength(); //при любом отрицательном значении также будут браться все элементы

        let elems = []; //массив с выбранными элементами
        let collection = this.blockchain.transactionsCollection; //чтобы писать поменьше
        let maxFee = this.getMaxFee();
        if (maxFee >= 0) {
            if (shouldDelete)   {
                elems = collection.map((v,i,a) => {
                    if (v.fee === maxFee) {
                        return a.splice(i,1);
                    }
                });
            } else {
                elems = findTransactions('fee', maxFee);
            }
        }
        //обрезаем массив до нужной длины
        if (elems.length > count) {
            elems = elems.slice(0, count-1);
        }

        return elems;
    }

    handleMessage(message, messageHandlers) {

    }

}