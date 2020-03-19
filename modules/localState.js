class LocalState {

    constructor() {
        this._state = {};
        this._timers = {}
    }

    get state() {
        return this._state;
    }

    get timers() {
        return this._timers;
    }

    /**
     * @param {Object} timers
     */
    set timers(timers) {
        this._timers = timers;
    }

    /**
     * @param {Object} data
     */
    set state(data) {
        this._state = data;
    }

    /**
     * 
     * @param {number|string} value
     */
    find(key) {
        return this.state[key] || false;
    }

    /**
     * 
     * @param {number|string} key
     */
    remove(key) {
        delete this.state[key];
    }

    /**
     * @param {string} key
     * @param {*} data 
     */
    add(key, data) {
        this.state[key] = data;
        return key;
    }

    /**
     * 
     * @param {*} key 
     * @param {number} time  - in second
     */
    setOrRefreshTimer(key, time) {
        if (this.timers[key] && this.timers[key].hasRef()) {
            return this.timers[key].refresh();
        }
        if (this.state[key]) {
            return this.timers[key] = setTimeout(() => {
                this.remove(key);
                delete this.timers[key];
            }, time * 1000);
        }
        return false;

    }

}

module.exports = LocalState;