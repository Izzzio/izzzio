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
     * @param {boolean} overdraft Allow balances overdraft
     * @return {environment.TokensRegister}
     * @constructor
     */
    environment.TokensRegister = function (name, overdraft) {
        let that = this;
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
         * Set balance of wallet
         * @param address
         * @param balance
         */
        this.setBalance = function (address, balance) {
            this.db.put(address, (new BigNumber(balance)).toFixed());
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
            if(!overdraft && balance.lt(0)) {
                assert.assert(false, 'Insufficient funds on ' + name + ':' + address);
            }
            this.setBalance(address, balance);

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

            balance = balance.plus(plus);
            this.setBalance(address, balance);
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

        return this;
    };
})(this);