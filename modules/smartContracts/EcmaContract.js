/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

const VM = require('./VM');
const TransactionalKeyValue = require('./TransactionalKeyValue');
const KeyValueInstancer = require('./KeyValueInstancer');
const storj = require('../instanceStorage');
const logger = new (require('../logger'))('ECMAContract');

const BlockHandler = require('../blockHandler');

/**
 * EcmaScript Smart contracts handler
 */
class EcmaContract {
    constructor() {
        let that = this;

        this.db = new TransactionalKeyValue('EcmaContracts');
        this.config = storj.get('config');
        this._contractInstanceCache = {};
        this._contractInstanceCacheLifetime = typeof this.config.ecmaContract === 'undefined' || typeof this.config.ecmaContract.contractInstanceCacheLifetime === 'undefined' ? 60000 : this.config.ecmaContract.contractInstanceCacheLifetime;

        /**
         * @var {BlockHandler} this.blockHandler
         */
        this.blockHandler = storj.get('blockHandler');

        this.blockHandler.registerBlockHandler('EcmaContract', function (blockData, block, callback) {
            that.handleBlock(blockData, block, callback)
        });

        this.blockHandler.registerBlockHandler('Document', function (blockData, block, callback) {
            that.handleBlock(blockData, block, callback)
        });


        logger.info('Initialized');
    }

    /**
     * Create contract instance by code
     * @param address
     * @param code
     * @param state
     * @return {{vm: VM, db: KeyValueInstancer}}
     */
    createContractInstance(address, code, state) {
        let vm = new VM({ramLimit: this.config.ecmaContract.ramLimit});
        let db = new KeyValueInstancer(this.db, address);
        try {
            vm.compileScript(code, state);
            vm.execute();
        } catch (e) {
            vm.destroy();
            logger.error('Contract ' + address + ' deployed with error. ' + e.getMessage());
            throw e;
        }

        return {vm: vm, db: db};
    }

    /**
     * Creates or return cached contract instance
     * @param address
     * @param code
     * @param state
     * @return {*}
     */
    getOrCreateContractInstance(address, code, state) {
        let that = this;
        if(typeof this._contractInstanceCache[address] === 'undefined') {
            let instance = {instance: this.createContractInstance(address, code, state)};
            instance.timer = setTimeout(function () {
                that._contractInstanceCache[address] = undefined;
                delete that._contractInstanceCache[address];
            }, this._contractInstanceCacheLifetime);
            return instance.instance;

        } else {
            clearTimeout(this._contractInstanceCache[address].timer);
            this._contractInstanceCache[address].timer = setTimeout(function () {
                that._contractInstanceCache[address] = undefined;
                delete that._contractInstanceCache[address];
            }, this._contractInstanceCacheLifetime);

            return this._contractInstanceCache[address].instance;
        }
    }

    getContractInstanceByAddress(address) {

    }

    handleBlock(blockData, block, callback) {
        console.log(blockData);
        callback();
    }
}

module.exports = EcmaContract;