
/**
 * IZ3 token standard
 * Basic token contract.
 */

const defaultSettings = {
    minFee: 0.0000001,
    blockEmission: 2,
    validatorFee: 200000,
    validatorTimeRange: 1000,
    payForSoul: 1,
    feeCoef: 0.0001,
    ownerWallet: "solCeAT5UqAiaK8tw1A3vUVExm27DThFr2p7",
};


class SollarTokenContract extends TokenContract {
    init(initialEmission, mintable) {
        super.init(initialEmission, mintable);

        this._sollarSettings = new BlockchainMap('sollarSettings');

        this._contract = new KeyValue('_contract');

        this._TransferEvent = new Event('Transfer', 'string', 'string', 'string', 'number', 'number', 'number');
        this._TransferFeeEvent = new Event('TransferFeeEvent', 'string', 'string', 'string', 'number', 'number', 'number');
        this._ContractFeeEvent = new Event('ContractFeeEvent', 'string', 'string', 'string', 'number', 'number', 'number');

        if (contracts.isDeploy()) {
            this._sollarSettings['minFee'] = defaultSettings.minFee;
            this._sollarSettings['blockEmission'] = defaultSettings.blockEmission;
            this._sollarSettings['validatorFee'] = defaultSettings.validatorFee;
            this._sollarSettings['validatorTimeRange'] = defaultSettings.validatorTimeRange;
            this._sollarSettings['payForSoul'] = defaultSettings.payForSoul;
            this._sollarSettings['feeCoef'] = defaultSettings.feeCoef;
            this._sollarSettings['firstDeployOwner'] = defaultSettings.ownerWallet;
            
            this._contract['wallet'] = global.getState().block.wallet;
        }
    }
    
    getFreeCoins(wallet, amount) {
        this._transferFromTo(this.contract.owner, wallet, amount);
    }

    transferFromTo(from, to, amount) {
        return this._transferFromTo(from, to, amount);
    }

    _transferFromTo(from, to, amount) {
        assert.true(isFinite(amount), 'Invalid amount');
        amount = Number(Number(amount).toFixed(8));
        assert.true(amount > 0, 'Invalid amount');

        const fee = global.getState().block.fee || 0;

        this._wallets.transfer(from, to, amount);
        this._TransferEvent.emit(this.contract.ticker, from, to, amount, fee, Date.now());
    }

    balanceOf(address) {
        return this._wallets.balanceOf(address).toFixed(8);
    }
}