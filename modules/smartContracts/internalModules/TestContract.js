const OWNER = false;
const EMISSION = 100;
const TOKEN_NAME = 'TESTTOKEN';
const TICKER = 'TESTICKER';

/**
 * Test token contract
 */
class TestContract extends TokenContract {

    init (totalEmission = EMISSION) {
        super.init(totalEmission);
    };

    get contract() {
        return {
            name: TOKEN_NAME,
            ticker: TICKER,
            owner: OWNER
        };
    }

    transfer(to, amount, from = state.from) {
        this.wallets.transfer(from, to, amount);
        this.TransferEvent.emit(from, to, new BigNumber(amount));
    }

    /**
     * Make transfer to external contract
     * @param address
     * @param amount
     * @param method
     * @param args
     */
    makeTransferToExternal(address, amount, method, args) {
        this.transfer(address, amount);
        let connector = new TokenContractConnector(address);
        connector.registerDeployMethod(method, method);
        return connector[method](args);
    }

}

global.registerContract(TestContract);