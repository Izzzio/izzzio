
const OWNER = false;
const EMISSION = 0;
const TOKEN_NAME = 'VOTETOKEN';
const TICKER = 'VOTETICKER';
const STATE = ['waiting', 'started', 'ended'];

/**
 * token contract for vote
 */
class MainVoteContract extends Contract {

    /**
     * Initialization method with emission
     * @param {*} options Details of the voting
     * @param {BigNumber| Number| String} initialEmission Amount of initial emission
     * @param {Boolean} mintable  Can mintable by owner in feature?
     */
    init(options, initialEmission = EMISSION, mintable = false) {

        super.init();
        this.vote = new KeyValue('vote');
        this.putKeyValue('subject', options.subject);                //тема голосования
        this.putKeyValue('deadTimeline', options.deadTimeline);      //время окончания
        this.putKeyValue('deadVotesline', options.deadVotesline);    //порог голосов
        this.putKeyValue('fee', options.fee);                        //стоимость голоса
        this.voteMembers = new BlockchainArray('voteMembers');       //список голосов: ключ - адрес голосующего, значение - выбранный вариант
        this.voteResults = new BlockchainArray('voteResults');       //результаты голосования: ключ - вариант голосования, значение - количество голосов
        this.variants = new BlockchainArray('variants');          //варианты
        for (let v of options.variants) {
            this.variants.push(v);
        }
        this.putKeyValue('votesCount', 0);                            //число проголосовавших


        this.VoteEvent = new Event('Vote', 'string', 'number'); //кто и за какой вариант проголосовал
        this.ChangeVoteState = new Event('ChangeVoteState', 'string');
        this.TransferEvent = new Event('Transfer', 'string', 'string', 'number');
        this.MintEvent = new Event('Mint', 'string', 'number');

        this.mintable = mintable;
        this.wallets = new TokensRegister(this.contract.ticker);
        if(Number(initialEmission) > 0 && contracts.isDeploy()) { //Calls on deploying
            this.wallets.mint(this.contract.owner, initialEmission);
            this.MintEvent.emit(this.contract.owner, new BigNumber(initialEmission));
        }
        this._voteState(0);                                        //состояние голосования
    }

    get contract() {
        return {
            name: TOKEN_NAME,
            ticker: TICKER,
            owner: OWNER
        };
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

    putKeyValue(key, value) {
        //помещает в хранилище vote ключ - значение
        this.vote.put(key, value)
    };

    getKeyValue(key) {
        //получает значения под ключом
        this.vote.get(key)
    };

    _transfer(from, to, amount) {
        this.wallets.transfer(from, to, amount);
        this.TransferEvent.emit(from, to, new BigNumber(amount));
    }

    /**
     * method to make voting started
     */
    startVoting() {
        this._voteState(1);
    }

    /**
     * method to stop voting
     */
    _endVoting() {
        this._voteState(2);
    }

    /**
     * set necessary state
     * @param ind
     */
    set _voteState(ind) {
        if (ind >= 0 && ind < STATE.length) {
            this.putKeyValue('state', STATE[ind]);
            this.ChangeVoteState.emit(STATE[ind]);
        }
    }

    /**
     * get current state of voting
     */
    get _voteState() {
        return this.getKeyValue('state');
    }

    /**
     * check deadlines of the voting. if we have at least one deadline, then stop voting and return funds
     * @returns {boolean} true if everything is fine, false if deadline exist
     */
    _checkDeadlines() {
        let votesCount = new BigNumber(getKeyValue('votesCount'));
        let deadVotesline = new BigNumber(getKeyValue('deadVotesline'));
        let deadTimeline =new Date('deadTimeline');
        if (deadVotesline > votesCount && deadTimeline > Date.now()){
            return true;
        } else {
            this._returnFunds();
            return false;
        }
    }

    /**
     * check if this user hasn't voted yet and vote started
     * @returns {boolean}
     * @private
     */
    _userCanVote(user) {
        assert.assert(!this.voteMembers[user] && this.voteState === STATE[1], "You can't take part at this vote");
    }

    /**
     * return funds when voting ends
     * @private
     */
    _returnFunds(from = this.contract.ticker) {
        //stopping voting
        this._endVoting();
        //return funds to each address
        for (let address in this.voteMembers) {
            this._transfer(from, address, getKeyValue('fee'));
        }
    }

    /**
     * get results of voting at this moment
     */
    getResultsOfVoting() {
        return Array(this.voteResults);
    }

    /**
     * make vote for necessary variant
     * @param variant {number}
     * @param address
     */
    makeVote(variant, address = this.contract.ticker) {
        //check if there was payment
        this.assertPayment();
        let payment = this.payProcess();
        //check other conditions
        this._userCanVote(payment.calledFrom);
        if (this._checkDeadlines())
        {
            let sender = payment.calledFrom;
            //check if it is enought money
            assert.assert(new BigNumber(this.getKeyValue('fee') === payment.amount), 'Wrong payment amount');
            this.voteMembers[sender] = variant;
            this.voteResults[variant] = this.voteResults[variant] ? this.voteResults[variant]++ : 1;
            this.VoteEvent.emit(sender, variant);
            this._checkDeadlines();
        }
    }

}

global.registerContract(MainVoteContract);