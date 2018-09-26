/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 Module which made transactions collections
 */

'use strict';

const moment = require('moment');
const CryptoJS = require("crypto-js");
const crypto = require('crypto');

class TransactionCollector {

    constructor (blockchainObject) {
        this.blockchain = blockchainObject;
        this.lastAddedTransaction = {};
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
     * @param keyValue //значение свойства
     * @param keyName //название свойства
     * @param collection //коллекция, по которой осуществляется поиск
     * @returns {*}
     */
    findTransactions (keyValue, keyName = 'hash', collection = this.blockchain.transactionsCollection) {
        let arr = [];
        collection.map(item => {
            if (item[keyName] === keyValue){
                arr.push(item);
            }
        });
        return arr;
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
            maxFee = collection[0].fee;
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
            let c = count; //чтобы не наудалять лишнего
            collection.map((v,i,a) => {
                if ((v.fee === maxFee) && (c-- > 0)) {
                    elems.push(v);
                    a[i] = shouldDelete ?  undefined : a[i]; //заменяем выбранные элемены на undefined, если необходимо удаление
                }
            });
            //удаляем пустые элементы, появившиеся, если было необходимо удаление
            if (shouldDelete) {
                this.blockchain.transactionsCollection = collection.filter(i => i!== undefined);
            }
        }
        return elems.map(item => delete item.hash);//возвращаем массив "чистых" транзакций(без поля hash)
    }

    /**
     * разбираем входящее сообщение. возвращаем объект добавленной транзакции если все прошло хорошо и блок добавлен
     * @param messageData
     * @returns {*}
     */
    handleMessage(messageData) {
        let data = this.parseTransactionMessageData(messageData);
        return this.addToCollection(data);
    }

    /**
     * добавление блока в коллекцию
     * @param data
     * @returns {*}
     */
    addToCollection(data){

        let collection = this.blockchain.transactionsCollection;
        //если data - не объект, значит, пришли неверные данные
        if (typeof data !== 'object') {
            return 1; //неправильный формат данных
        }

        //не слишком ли старая транзакция
        if (moment().utc().valueOf() + this.blockchain.config.transactionTTL < data.timestamp){
            return 2; //срок годности вышел
        }

        //проверка подписи(если есть такое поле)
        if (typeof data.sign !== "undefined") {
            if (data.data){
                //проверяем наличие открытого ключа
                if (!data.pubkey) {
                    return 6; //нет публичного ключа-не проверить
                }
                const verify = crypto.createVerify('SHA256');
                verify.update(data.data);
                try {
                    let check = verify.verify(data.pubkey, data.sign, 'hex');
                    if (!check){
                        return 7;   //подпись недействительна
                    }
                } catch (e){
                    return 8;
                }
            }
        }

        //проверяем наличие поля fee
        if (!data.fee) {
            data.fee = 0;
        }

        //проверяем наличие хэша
        let hash;
        if (!data.hash) {
            //получаем хэш транзакции, если нет такого поля
            hash = CryptoJS.SHA256(JSON.stringify(data)).toString();
        } else {
            hash = data.hash
        }

        //если такая транзакция уже есть, значит, мы уже ее обработали и ничего не делаем
        if (this.findTransactions(hash).length !== 0) {
            return 3; //транзакция уже есть в коллекции
        }

        //проверяем, можно/нужно добавление в коллекцию или нет
        let colLength = this.getCollectionLength();
        if ((colLength >= this.blockchain.config.transactionCollectionMaxElements) && (Number(collection[colLength-1].fee) >= Number(data.fee))) {
            return 4;// ничего не делаем, т.к. минимальный fee больше либо равен пришедшему и в коллекции уже максимум элементов
        }

        //все проверки прошли успешно, значит, можно добавлять в коллекцию
        //добавляем хэш
        data.hash = hash;
        collection.push(data);
        //сортируем по убыванию fee
        collection.sort((a,b) => b.fee - a.fee);
        //отрезаем лишнее
        this.blockchain.transactionsCollection = collection.slice(0, this.blockchain.config.transactionCollectionMaxElements);
        //поиск по хэшу. вдруг мы отрезали новую
        if (this.findTransactions(hash) === []) {
            return 5; //мы отрезали новую, значит, ничего не будем передавать,т.к. коллекция не изменилась
        }
        this.lastAddedTransaction = data;
        return data;
    }

    /**
     * создаем сообщение с оповещением о новой транзакции
     * @param data
     * @param index
     * @returns {{type: number, data: *, index: string}}
     */
    createMessage(data, index = ''){
        let JSONdata = JSON.stringify(data);
        return {
            type: this.blockchain.MessageType.TRANS_COLL,
            data: JSONdata,
            index:index
        }
    }

    /**
     * рассылка сообщения о новом элементе коллекции всем подключенным, кроме excludeSocket, пирам с помощью функции broadcastFunction
     * @param data
     * @param broadcastFunction
     * @param excludeSocket
     * @returns {{type: number, data: *, index: string}}
     */
    sendTransactionToAllPeers(data, broadcastFunction, excludeSocket){
        let message = this.createMessage(data);
        broadcastFunction (message, excludeSocket);
        return message;
    }
}

module.exports = TransactionCollector;