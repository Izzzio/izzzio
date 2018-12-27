/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Recommended basis environment
 */
class Contract {

    /**
     * Assert this contract called from owner
     * @param msg
     */
    assertOwnership(msg = 'Restricted access') {
        assert.assert(this.contract.owner === global.getState().from, msg);
    }

    assertPayment(msg = 'This method can only be invoked from token contract') {
        assert.false(!this.payProcess(), msg);
    }

    /**
     * Process income payment
     * @return {*}
     */
    payProcess() {
        let extendedState = contracts.getExtendedState();
        let state = global.getState();

        if(!contracts.isChild()) {
            return false;
        }

        if(!extendedState || Object.keys(extendedState).length === 0) {
            return false;
        }

        if(typeof extendedState.amount === "undefined" || typeof extendedState.type === "undefined" || typeof extendedState.balance === "undefined") {
            return false;
        }

        if(typeof state.calledFrom === 'undefined') {
            return false;
        }

        return {
            amount: new BigNumber(extendedState.amount),
            rawAmount: extendedState.amount,
            ticker: extendedState.ticker,
            balance: new BigNumber(extendedState.balance),
            rawBalance: extendedState.balance,
            caller: state.calledFrom,
            contractName: extendedState.contractName,
        };
    }


    /**
     * Initialization method
     */
    init() {
        assert.false(contracts.isChild(), 'You can\'t call init method of another contract');
        if(contracts.isDeploy()) {
            this.deploy();
        }
    }

    /**
     * Recommended deploy method. This method calls 1 time on deploy
     */
    deploy() {
        assert.false(contracts.isChild(), 'You can\'t call deploy method of another contract');
    }


}