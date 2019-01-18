/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Basic token contract
 */
class TokenContract extends Contract {

    /**
     * Initialization method with emission
     * @param {BigNumber| Number| String} initialEmission Amount of initial emission
     * @param {Boolean} mintable  Can mintable by owner in feature?
     */
    init(initialEmission, mintable = false) {

        super.init();
        this._TransferEvent = new Event('Transfer', 'string', 'string', 'number');
        this._MintEvent = new Event('Mint', 'string', 'number');
        this._BurnEvent = new Event('Burn', 'string', 'number');

        this._mintable = mintable;
        this._wallets = new TokensRegister(this.contract.ticker);
        if(Number(initialEmission) > 0 && contracts.isDeploy()) { //Calls on deploying
            this._wallets.mint(this.contract.owner, initialEmission);
            this._MintEvent.emit(this.contract.owner, new BigNumber(initialEmission));
        }
    }

    /**
     * Returns caller
     * @return {*}
     * @private
     */
    _getSender() {
        if(contracts.isChild()) {
            return contracts.caller();
        }

        return global.getState().from;
    }

    /**
     * Get balance of wallet
     * @param address
     * @return {*}
     */
    balanceOf(address) {
        return this._wallets.balanceOf(address).toFixed();
    }


    /**
     * Return total supply
     * @return {*|BigNumber}
     */
    totalSupply() {
        return this._wallets.totalSupply().toFixed();
    }

    /**
     * Transfer method
     * @param to
     * @param amount
     */
    transfer(to, amount) {
        let from = this._getSender();
        this._wallets.transfer(from, to, amount);
        this._TransferEvent.emit(from, to, new BigNumber(amount));
    }

    /**
     * Burn users tokens
     * @param amount
     */
    burn(amount) {
        let from = this._getSender();
        this._wallets.burn(from, amount);
        this._BurnEvent.emit(from, new BigNumber(amount));
    }

    /**
     * Token minting
     * @param amount
     */
    mint(amount) {
        let from = this._getSender();
        this.assertOwnership('Minting available only for contract owner');
        assert.true(this._mintable, 'Token is not mintable');
        this._wallets.mint(from, amount);
        this._MintEvent.emit(from, new BigNumber(amount));
    }
}