const state = {
    addresses: []
}

/**
 * 
 * @param {*} state
 * @param {*} data
 */
const setItem = (state, data) => {
    if (!Array.isArray(state)) {
        console.log(state);
        return false;
    }
    state.push(data);
    //Return index of array
    return state.length - 1;
}

/**
 * 
 * @param {*} state
 * @param {*} key
 * @param {*} value
 */
const removeItem = (state, key, value) => {
    if (!Array.isArray(state)) {
        return false;
    }
    const index = state.findIndex(el => el[key] === value);
    if (index !== -1) {
        state.splice(index, 1);
    }
}

/**
 * 
 * @param {*} state
 * @param {*} key
 * @param {*} value
 */
const getItem = (state, key, value) => {
    if (!Array.isArray(state)) {
        return false;
    }
    return state.find(el => el[key] === value);
}

/**
 * 
 */
module.exports = {
    setItem,
    state,
    removeItem,
    getItem
}


