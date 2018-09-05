/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Blockchain storable pseudo-array. Based on wrapping KeyValue methods
 * Supports only number indexes
 */
class _BlockchainArray extends KeyValue {
    constructor(name) {
        super(name);


        /**
         * Proxify some items calls
         */
        return new Proxy(this, {
            /**
             * Replace getters
             * @param target
             * @param item
             * @return {*}
             */
            get(target, item) {
                if(typeof target[item] !== 'undefined') {
                    return target[item];
                }

                let getValue = target.get(item);
                if(!getValue) {
                    return undefined;
                }

                return JSON.parse(getValue)['val'];
            },
            /**
             * Replace setters
             * @param target
             * @param item
             * @param value
             */
            set(target, item, value) {
                if(typeof target[item] !== 'undefined') {
                    return target[item];
                }

                let getValue = target.get(String(item));
                if(!getValue) {
                    target._setLength(target.length + 1);
                }

                target.put(String(item), JSON.stringify({val: value}));

                //Cross index
                //target.put(JSON.stringify({val: value}), String(item));
                return true;
            }
        });
    }

    /**
     * Get array length
     * @return {*}
     */
    get length() {
        let length = this.get('length');
        if(!length) {
            return 0
        }
        return Number(length);
    }

    /**
     * Set new array length
     * @param length
     * @private
     */
    _setLength(length) {
        this.put('length', length);
    }

}

class BlockchainArray extends _BlockchainArray {
    constructor(name) {
        super(name);
    }

    /**
     * Push one to array
     * @param value
     * @return {*}
     * @private
     */
    _push(value) {
        let key = this.length;
        this[key] = value;
        return key;
    }

    /**
     * Push to array
     * @param values
     * @return {Number}
     */
    push(...values) {
        for (let a in values) {
            if(values.hasOwnProperty(a)) {
                this._push(values[a]);
            }
        }
        return this.length;
    }

    /**
     * Pop from array
     * @return {*}
     */
    pop() {
        if(this.length === 0) {
            return undefined;
        }

        let key = this.length - 1;
        let element = this[key];
        this._setLength(key);
        this.put(String(key), false);
        return element;
    }


    /**
     * Index of element
     * @param element
     * @param fromIndex From index.
     * @return {number}
     */
    indexOf(element, fromIndex = 0) {
        for (let a = fromIndex; a < this.length; a++) {
            if(String(this[a]) === String(element)) {
                return a;
            }
        }

        return -1;
    }


    /**
     * Lst element index
     * @param element
     * @param fromIndex
     * @return {*}
     */
    lastIndexOf(element, fromIndex = this.length) {
        for (let a = fromIndex; a >= 0; a--) {
            if(String(this[a]) === String(element)) {
                return a;
            }
        }

        return -1;
    }

}