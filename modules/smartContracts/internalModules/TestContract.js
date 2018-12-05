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
}

global.registerContract(TestContract);