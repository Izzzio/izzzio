class LocalState {

    constructor() {
        this._state = [];
    }

    get state() {
        return this._state;
    }

    /**
     * @param {Array} data
     */
    set state(data) {
        this._state = data;
    }

    /**
     * 
     * @param {number|string} key
     * @param {number|string} value
     */
    findBy(key, value) {
        return this.state.find(el => el[key] === value);
    }

    /**
     * 
     * @param {number|string} key
     * @param {number|string} value
     */
    removeBy(key, value) {
        const index = this.state.findIndex(el => el[key] === value);
        if (index !== -1) {
            this.state.splice(index, 1);
        }
    }

    /**
     * 
     * @param {*} data 
     */
    add(data) {
        return this.state.push(data) - 1;
    }

    /**
     * 
     * @param {number} index 
     * @param {number} time - in second
     */
    clearAfterTIme(index, time) {
        setTimeout(() => {
            this.state.splice(index, 1);
        }, time * 1000);
    }


}

module.exports = LocalState;