
const OWNER = false;
const STATE = ['waiting', 'started', 'ended'];
const MAIN_TOKEN_ADDRESS = '5';
const SUBJECT = 'vote_subject';                 //тема голосования
const DEADTIMELINE = '01.01.2020';              //время окончания
const DEADVOTESLINE = 100;                      //порог голосов
const FEE = 1;                                  //стоимость голоса
const VARIANTS = ['first', 'second', 'third'];  //варианты голосования

/**
 * token contract for vote
 */
class MainVoteContract extends Contract {

    /**
     * Initialization method with emission
     */
    init() {

        super.init();
        this.vote = new KeyValue('vote');
        this.voteMembers = new BlockchainObject('voteMembers');       //список голосов: адрес голосующего + выбранный вариант
        this.voteMembers.who = [];
        this.voteMembers.variant = [];
        this.voteResults = new BlockchainArray('voteResults');       //результаты голосования: ключ - вариант голосования, значение - количество голосов
       /* this.variants = new BlockchainArray('variants');          //варианты
        for (let v of options.variants) {
            this.variants.push(v);
        }*/

        for (let v of this.contract.variants) {
            this.voteResults.push(0);
        }
        this._putKeyValue('votesCount', 0);                            //число проголосовавших

        this.VoteEvent = new Event('Vote', 'string', 'number'); //кто и за какой вариант проголосовал
        this.ChangeVoteState = new Event('ChangeVoteState', 'string');

        this._voteState = 0;                                        //состояние голосования
    }

    get contract() {
        return {
            owner: OWNER,
            subject: SUBJECT,
            deadTimeLine: DEADTIMELINE,
            deadVotesLine: DEADVOTESLINE,
            fee: FEE,
            variants: VARIANTS,
        };
    }

    /**
     * Add voting with his variant to arrays
     * @param who
     * @param variant
     * @private
     */
    _pushVoteMember(who ,variant) {
        this.voteMembers.who.push(who);
        this.voteMembers.variant.push(variant);
    }

    /**
     * Pop voting with his variant to arrays. Undefined if arrays are empty
     * @returns {{who: string | undefined, variant: number | undefined}}
     * @private
     */
    _popVoteMember() {
        return {
            who: this.voteMembers.who.pop(),
            variant: this.voteMembers.variant.pop(),
        }
    }

    /**
     * Count of votings
     * @returns {*}
     * @private
     */
    _countVoteMember() {
        return this.voteMembers.who.count();
    }

    /**
     * Find voting by address and return its index. -1 if no such voting
     * @param who
     * @returns {number}
     * @private
     */
    _findVoteMember(who) {
        let count = this._countVoteMember();
        for ( let i = 0; i < count; i++) {
            if (this.voteMembers.who[i] === who) {
                return i;
            }
        }
        return -1;
    }

    /**
     * return voting info by index. {undefined, undefined} if no element with such index
     * @param index
     * @returns {{who: *, variant: *}}
     * @private
     */
    _getVoteMemberByIndex(index) {
        return {
            who: this.voteMembers.who[index],
            variant: this.voteMembers.variant[index],
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

    _putKeyValue(key, value) {
        //помещает в хранилище vote ключ - значение
        this.vote.put(key, value)
    };

    _getKeyValue(key) {
        //получает значения под ключом
        this.vote.get(key)
    };

    /**
     * method to make voting started
     */
    startVoting() {
        this._voteState = 1;
    }

    /**
     * method to stop voting
     */
    _endVoting() {
        this._voteState = 2;
    }

    /**
     * set necessary state
     * @param ind
     */
    set _voteState(ind) {
        if (ind >= 0 && ind < STATE.length) {
            this._putKeyValue('state', STATE[ind]);
            this.ChangeVoteState.emit(STATE[ind]);
        }
    }

    /**
     * get current state of voting
     */
    get _voteState() {
        return this._getKeyValue('state');
    }

    /**
     * check deadlines of the voting. if we have at least one deadline, then stop voting and return funds
     * @returns {boolean} true if everything is fine, false if deadline exist
     */
    _checkDeadlines() {
        let votesCount = Number(this._getKeyValue('votesCount'));
        let deadVotesline = Number(this.contract.deadVotesLine);
        let deadTimeline =new Date(this.contract.deadTimeLine);
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
        assert.assert((this._findVoteMember(user) === -1) && this._voteState === STATE[1], "You can't take part at this vote");
    }

    /**
     * return funds when voting ends
     * @private
     */
    _returnFunds() {
        //stopping voting
        this._endVoting();
        //create connector to main token
        let mainTokenConnector = new TokenContractConnector(MAIN_TOKEN_ADDRESS);
        //return funds to each address
        let count = this._countVoteMember();
        for (let i = 0; i < count; i++) {
            let address = this._getVoteMemberByIndex(i).who;
            if (address) {
                mainTokenConnector.transfer(address, new BigNumber(this._getKeyValue('fee')));
            }
        }
    }

    /**
     * Add info about new vote
     * @param sender
     * @param variant
     * @private
     */
    _addVote(sender, variant) {
        //check if it possible variant(positive and less than count)
        let variantsCount = this.contract.variants.length;
        assert.assert((variant >= 0) && (variant < variantsCount));
        
        this._pushVoteMember(sender, variant);
        this.voteResults[variant] = this.voteResults[variant] ? this.voteResults[variant]++ : 1;
        let count = Number(this._getKeyValue('votesCount')) + 1;
        this._putKeyValue('votesCount', count);
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
     */
    processPayment(variant) {
        //check if there was payment
        this.assertPayment();
        let payment = this.payProcess();
        //check if this sender token is legal
        assert.assert(MAIN_TOKEN_ADDRESS === payment.caller, 'Wrong main token address');
        let sender = this._getSender();
        //check other conditions
        this._userCanVote(sender);
        if (this._checkDeadlines())
        {
            //check if it is enought money
            assert.assert(new BigNumber(this.contract.fee) === payment.amount, 'Wrong payment amount');
            this._addVote(sender, variant);
            this.VoteEvent.emit(sender, variant);
            this._checkDeadlines();
        }
    }

}

global.registerContract(MainVoteContract);