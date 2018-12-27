
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
        this._vote.subject = options.subject;                //тема голосования
        this._vote.variants = [...options.variants];         //варианты
        this._vote.deadTimeline = options.deadTimeline;      //время окончания
        this._vote.deadVotesline = options.deadVotesline;    //порог голосов
        this._vote.fee = options.fee;                        //стоимость голоса
        this._vote.members = [];                             //список голосов
        this._vote.voteResults= [];                          //результаты голосования
        this.voteState(0);                                        //состояние голосования

        this.VoteEvent = new Event('Vote', 'string', 'number'); //кто и за какой вариант проголосовал
    }

    get contract() {
        return {
            name: TOKEN_NAME,
            ticker: TICKER,
            owner: OWNER
        };
    }

    startVoting() {
        this.voteState(1);
    }

    endVoting() {
        this.voteState(2);
    }

    set voteState(ind) {
        if (ind >= 0 && ind < STATE.length && this._vote) {
            this._vote.state = STATE[ind];
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
        return this._vote.voteResults;
    }

    /**
     * check if this user can vote(if he hasn't voted yet)
     * @returns {boolean}
     */
    userCanVote() {
        let sender = this._getSender();
        if (this._vote.members.indexOf(this.sender) > -1) {
            return false;
        } else {
            return true;
        }
    }

    transfer(to, amount, from = state.from) {
        this.wallets.transfer(from, to, amount);
        this.TransferEvent.emit(from, to, new BigNumber(amount));
    }

    get sumOfVotes () {
        return this.voteResults.reduce((a, b) => a + b);
    }

    checkDeadlines() {
        return this._vote.deadVotesline > this.sumOfVotes && this.this._vote.deadTimeline > Date.now();
    }


    // /**
    //  * Make transfer to external contract
    //  * @param address
    //  * @param amount
    //  * @param method
    //  * @param args
    //  */
    // makeTransferToExternal(address, amount, method, args) {
    //     this.transfer(address, amount);
    //     let connector = new TokenContractConnector(address);
    //     connector.registerDeployMethod(method, method);
    //     return connector[method](args);
    // }



}

global.registerContract(VoteContract);