/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Copied from Stake Overflow
 * @type {function(): string}
 */
module.exports = getid = () => (Math.random() * (new Date().getTime())).toString(36).replace(/[^a-z]+/g, '');