/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */
class TokenContract extends Contract {

    /**
     * Initialization method with emission
     * @param {BigNumber| Number| String} initialEmission Amount of initial emission
     * @param {Boolean} mintable  Can mintable by owner in feature?
     */
    init(initialEmission, mintable = false) {
        this.mintable = mintable;
        this.wallets = new TokensRegister(this.contract.ticker);
        if(Number(initialEmission) > 0) {
            this.wallets.mint(this.contract.owner, initialEmission);
        }
    }

    /**
     * Get balance of wallet
     * @param address
     * @return {*}
     */
    balanceOf(address) {
        return this.wallets.balanceOf(address);
    }


    /**
     * Return total supply
     * @return {*|BigNumber}
     */
    totalSupply() {
        return this.wallets.totalSupply();
    }

    /**
     * Transfer method
     * @param to
     * @param amount
     */
    transfer(to, amount) {
        this.wallets.transfer(state.from, to, amount);
    }

    /**
     * Burn users tokens
     * @param amount
     */
    burn(amount) {
        this.wallets.burn(state.from, amount);
    }

    /**
     * Token minting
     * @param amount
     */
    mint(amount) {
        this.assertOwnership('Minting available only for contract owner');
        assert.true(this.mintable, 'Token is not mintable');
        this.wallets.mint(state.from, amount);
    }
}