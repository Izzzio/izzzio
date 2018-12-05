const OWNER = false;
const EMISSION = 100;
const TOKEN_NAME = 'TESTTOKEN';
const TICKER = 'TESTICKER';


/**
 * Test token contract
 */
class TestContract extends TokenContract {
    init (totalEmission = EMISSION) {
        this.contract = {
            name: TOKEN_NAME,
            ticker: TICKER,
            owner: OWNER
        };
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