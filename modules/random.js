/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

module.exports = {
    int: function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    },
    arbitrary: function getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }
};