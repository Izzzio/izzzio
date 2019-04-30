/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


/**
 * Event helper
 */
class Event {

    /**
     * Create Event
     * @param {string} name Event name
     * @param {array|*} types Event types
     */
    constructor(name, ...types) {

        const SUPPORTED_TYPES = ['number', 'string', 'array', 'object', 'boolean', 'bool'];

        if(types.length > 10) {
            throw 'Event can take only 10 arguments';
        }

        if(types.length === 1 && Array.isArray(types[0])) {
            types = types[0];
        }

        /**
         * Determine all types
         */
        for (let a in types) {
            switch (typeof types[a]) {
                case 'string':
                    types[a] = (types[a] === '' ? 'string' : types[a]);
                    break;
                case 'object':
                    types[a] = Array.isArray(types[a]) ? 'array' : 'object';
                    break;
                case 'number':
                    types[a] = 'number';
                    break;
                case 'bool':
                case 'boolean':
                    types[a] = 'boolean';
                    break;
                default:
                    assert.true(false, 'Unsupported event argument type ' + typeof types[a]);
            }

            if(SUPPORTED_TYPES.indexOf(types[a]) === -1) {
                assert.true(false, 'Unsupported event argument type ' + types[a]);
            }
        }

        this.types = types;
        this.event = name;
    }

    /**
     * Emit event
     * @param {array|*} args
     * @return {*}
     */
    emit(...args) {
        if(args.length === 1 && Array.isArray(args[0])) {
            args = args[0];
        }
        for (let a in args) {
            switch (this.types[a]) {
                case 'string':
                    if(typeof args[a] !== 'string') {
                        assert.true(false, 'Invalid argument type for argument no ' + a + '. Provided ' + typeof args[a] + ', string expected');
                    }
                    break;
                case 'number':
                    if(typeof args[a] === 'object' && args[a].constructor.name === 'BigNumber') {
                        args[a] = args[a].toFixed();
                    } else if(typeof args[a] !== 'number') {
                        assert.true(false, 'Invalid argument type for argument no ' + a + '. Provided ' + typeof args[a] + ', number expected');
                    }
                    break;

                case 'object':
                    if(typeof args[a] !== 'object') {
                        assert.true(false, 'Invalid argument type for argument no ' + a + '. Provided ' + typeof args[a] + ', object expected');
                    }
                    args[a] = JSON.stringify(args[a]);
                    break;
                case 'boolean':
                case 'bool':
                    if(typeof args[a] !== 'boolean') {
                        assert.true(false, 'Invalid argument type for argument no ' + a + '. Provided ' + typeof args[a] + ', boolean expected');
                    }
                    args[a] = args[a] ? '1' : '0';
                    break;
                case 'array':
                    if(Array.isArray(args[a])) {
                        assert.true(false, 'Invalid argument type for argument no ' + a + '. Provided ' + typeof args[a] + ', Array expected');
                    }
                    args[a] = JSON.stringify(args[a]);
                    break;
            }
        }

        return Events.emit(this.event, args);

    }
}