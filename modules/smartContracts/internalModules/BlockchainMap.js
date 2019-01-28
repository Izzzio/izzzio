/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Map structure
 */
class BlockchainMap {

    constructor(name) {
        this.db = new TypedKeyValue(name);
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
                return target.db.get(item);
            },
            /**
             * Replace setters
             * @param target
             * @param item
             * @param value
             */
            set(target, item, value) {
                if(typeof target[item] !== 'undefined') {
                    return value;
                }

                target.db.put(item, value);
                return true;
            }
        });
    }

}