/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Token holders register for EcmaContracts
 */
(function (environment) {
    /**
     * Token Register
     * @param {string} name Token name
     * @return {environment.TokensRegister}
     * @constructor
     */
    environment.TokensRegister = function (name) {
        this.db = new KeyValue(name);

        /**
         * Get balance of address
         * @param address
         * @return {*}
         */
        this.balanceOf = function (address) {
            let balance = this.db.get(address);
            if(!balance) {
                return new BigNumber(0);
            }

            return new BigNumber(balance);
        };

        /**
         * Get total supply
         * @return {*|BigNumber}
         */
        this.totalSupply = function () {
            let totalSupply = this.db.get('totalSupply');
            if(!totalSupply) {
                return new BigNumber(0);
            }

            return new BigNumber(totalSupply);
        };

        /**
         * Set total supply private
         * @param supply
         * @return {*|BigNumber}
         * @private
         */
        this._setTotalSupply = function (supply) {
            supply = new BigNumber(supply);
            this.db.put('totalSupply', supply.toFixed());
            return supply;

        };

        /**
         * Incrase supply private
         * @param amount
         * @private
         */
        this._incraseSupply = function (amount) {
            let totalSupply = this.totalSupply();
            this._setTotalSupply(totalSupply.plus(new BigNumber(amount)));
            return this.totalSupply();
        };

        /**
         * Decrase supply private
         * @param amount
         * @private
         */
        this._decraseSupply = function (amount) {
            let totalSupply = this.totalSupply();
            this._setTotalSupply(totalSupply.minus(new BigNumber(amount)));
            return this.totalSupply();
        };

        /**
         * Set balance of wallet
         * @param address
         * @param balance
         */
        this.setBalance = function (address, balance) {
            return this._setBalance(address, balance, false);
        };

        this._setBalance = function (address, balance, ignoreSupply) {
            balance = new BigNumber(balance);
            if(this.balanceOf(address).lt(balance) && !ignoreSupply) {
                this._incraseSupply(balance.minus(this.balanceOf(address)));
            }
            this.db.put(address, (balance).toFixed());
        };

        /**
         * Withdraw tokens from address balance
         * @param address
         * @param amount
         */
        this.withdraw = function (address, amount) {
            let balance = this.balanceOf(address);
            let minus = new BigNumber(amount);

            if(minus.lte(0)) {
                assert.assert(false, 'Amount should be positive non-zero value!');
            }

            balance = balance.minus(minus);
            if(balance.lt(0)) {
                assert.assert(false, 'Insufficient funds on ' + name + ':' + address);
            }

            this._decraseSupply(minus);

            this._setBalance(address, balance, true);

            return balance;
        };

        /**
         * Alias to withdraw
         * @param address
         * @param amount
         */
        this.minus = function (address, amount) {
            return this.withdraw(address, amount)
        };

        /**
         * Deposit tokens on address balance
         * @param address
         * @param amount
         */
        this.deposit = function (address, amount) {
            let balance = this.balanceOf(address);
            let plus = new BigNumber(amount);

            if(plus.lte(0)) {
                assert.assert(false, 'Amount should be positive non-zero value!');
            }

            this._incraseSupply(plus);

            balance = balance.plus(plus);
            this._setBalance(address, balance, true);
            return balance;
        };

        /**
         * Alias for deposit
         * @param address
         * @param amount
         * @return {*|BigNumber}
         */
        this.plus = function (address, amount) {
            return this.deposit(address, amount);
        };

        /**
         * Transfers tokens from address to address
         * @param from
         * @param to
         * @param amount
         * @return {*}
         */
        this.transfer = function (from, to, amount) {
            this.withdraw(from, amount);
            this.deposit(to, amount);
            return this.balanceOf(to);
        };

        /**
         * Burn tokens
         * @param address
         * @param amount
         */
        this.burn = function (address, amount) {
            amount = new BigNumber(amount);
            this.withdraw(address, amount);
        };

        /**
         * Mint tokens
         * @param address
         * @param amount
         */
        this.mint = function (address, amount) {
            amount = new BigNumber(amount);
            this.deposit(address, amount);
        };


        return this;
    };
})(this);