
class mainToken {

    init(){

    }

    get contract() {
        return {
            name: TOKEN_NAME,
            ticker: TICKER,
            owner: CONTRACT_OWNER,
            emission: EMISSION,
            c2cFee: C2C_FEE,
            type: 'token',
        };
    }

    transfer(from, to){}
}


global.registerContract(mainToken);