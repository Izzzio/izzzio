/**
 * Форматирует отображение числа согласно precision
 * @param {Number} number
 * @param {Number} precision
 */
function formatToken(number, precision) {
    if(precision === 1) {
        return String(number);
    }
    let nulls = String(precision).replace(/[1-9]*/, '').length;
    let result = String(Math.round(number));
    let right = result.slice(-nulls);
    if(nulls - right.length > 0) {
        for (let i = 1; nulls - right.length; i++) {
            right = '0' + right;
        }
    }
    return (result.length <= nulls ? '0' : result.slice(0, -nulls)) + '.' + right;
}

module.exports = formatToken;