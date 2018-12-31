
const OWNER = false;
const EMISSION = 100;
const TOKEN_NAME = 'VOTETOKEN';
const TICKER = 'VOTETICKER';
const STATE = ['waiting', 'started', 'ended'];

/**
 * token contract for vote
 */
class VoteContract extends TokenContract {

    /**
     * Initialization method with emission
     * @param {*} options Details of the voting
     * @param {BigNumber| Number| String} initialEmission Amount of initial emission
     * @param {Boolean} mintable  Can mintable by owner in feature?
     */
    init(options, initialEmission = EMISSION, mintable = false) {

        super.init();
        this._vote = {};
        this._vote.subject = options.subject;                //тема голосования
        this._vote.variants = [...options.variants];         //варианты
        this._vote.deadTimeline = options.deadTimeline;      //время окончания
        this._vote.deadVotesline = options.deadVotesline;    //порог голосов
        this._vote.fee = options.fee;                        //стоимость голоса
        this._vote.members = [];                             //список голосов
        this._vote.voteResults = [];                          //результаты голосования: ключ - адрес голосующего, значение - выбранный вариант
        this.voteState(0);                                        //состояние голосования

        this.VoteEvent = new Event('Vote', 'string', 'number'); //кто и за какой вариант проголосовал
        this.ChangeVoteState = new Event('ChangeVoteState', 'string');
    }

    get contract() {
        return {
            name: TOKEN_NAME,
            ticker: TICKER,
            owner: OWNER
        };
    }

    _transfer(from, to, amount) {
        this.wallets.transfer(from, to, amount);
        this.TransferEvent.emit(from, to, new BigNumber(amount));
    }

    /**
     * method to make voting started
     */
    startVoting() {
        this.voteState(1);
    }

    /**
     * method to stop voting
     */
    _endVoting() {
        this.voteState(2);
    }

    /**
     * set necessary state
     * @param ind
     */
    set voteState(ind) {
        if (ind >= 0 && ind < STATE.length && this._vote) {
            this._vote.state = STATE[ind];
            this.ChangeVoteState.emit(STATE[ind]);
        }
    }

    get voteState() {
        return this._vote.state;
    }

    /**
     * returns results of voting
     * @returns {*|Array}
     */
    get voteResults() {
        let arr = [];
        for (let v of this._vote.voteResults)
        {
            arr[v] = arr[v] ? arr[v] + 1 : 1;
        }
        return arr;
    }

    /**
     * check if this user can vote(if he hasn't voted yet and voting started)
     * @returns {boolean}
     */
    _userCanVote() {
        return !this._vote.voteResults[this._getSender()] && this.voteState === STATE[1];
    }

    /**
     * get whole sum of votes
     * @returns {number}
     */
    get _sumOfVotes () {
        return this.voteResults.reduce((a, b) => a + b, 0);
    }

    /**
     * check deadlines of the voting. if we have at least one deadline, then stop voting and return funds
     * @returns {boolean} true if everything is fine, false if deadline exist
     */
    _checkDeadlines() {
        if (this._vote.deadVotesline > this._sumOfVotes && this.this._vote.deadTimeline > Date.now()){
            return true;
        } else {
            this._returnFunds();
            return false;
        }
    }

    /**
     * return funds when voting ends
     * @private
     */
    _returnFunds(from = this.contract.ticker) {
        //stopping voting
        this._endVoting();
        for (let address in this._vote.voteResults) {
            this._transfer(from, address, this._vote.fee);
        }
    }

    /**
     * make vote for necessary variant
     * @param variant {number}
     * @param address
     */
    makeVote(variant, address = this.contract.ticker) {
        if (this._checkDeadlines() && this._userCanVote())
        {
            let sender = this._getSender();
            this._transfer(sender, address, this._vote.fee);
            this._vote.voteResults[sender] = variant;
            this.VoteEvent.emit(sender, variant);
            this._checkDeadlines();
        }
    }


}

global.registerContract(VoteContract);