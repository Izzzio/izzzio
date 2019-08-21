/**
 iZ³ | Izzzio blockchain - https://izzz.io

 Copyright 2018 Izio Ltd (OOO "Изио")

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

const CONTRACT_OWNER = '-----BEGIN RSA PUBLIC KEY-----\n' +
    'MIIBCgKCAQEApSJ2Lm6h26vHgiqB4VcyOZE+meRB6Jaow6Z+6cBn43fvcM57l8O2DfFTgo9R\n' +
    '4AUavuFJU8bekhcCWYC53RErumjHBrWVviGDOxRALfev8fOU6V+hm9E7FGiW5RXMew5729lt\n' +
    'rOxsyrayUtBLsd6BAEO5n/AtAI08Et403X/UX/7N/9zKu+F2E/fi1VlvJS07TtgPoRuT9vx6\n' +
    'ol7B0OcqGU0lIe84TasfX4pN9RIZe3+O8idBTg9aHbtuD2qSSQ9x1jpcD4wOtb+FhgBJ3dOI\n' +
    'eIC3eapWvK4HFtAtX1uIyod3LruSVssrNtLEqWOgD5MwOlv1KWAR0ZDZ3cYNL8Of8QIDAQAB\n' +
    '-----END RSA PUBLIC KEY-----\n';


/**
 * Voting subject
 * @type {string}
 */
const SUBJECT = 'vote_subject';

/**
 * Vote variants
 * @type {string[]}
 */
const VOTE_VARIANTS = ['first', 'second', 'third'];

/**
 * Vote END date
 * @type {string}
 */
const VOTE_END_DATE = '2020-02-01';

/**
 * Vote count threshold
 * @type {number}
 */
const VOTE_END_THRESHOLD = 1;

/**
 * voting price
 * @type {number}
 */
const VOTE_PRICE = 1;

/**
 * Contract passable state
 * @type {string[]}
 */
const STATE = ['waiting', 'started', 'ended'];


/**
 * Voting contract
 */
class voteContract extends Contract {

    /**
     * Initialization method with emission
     */
    init(subject = SUBJECT, variants = VOTE_VARIANTS) {

        super.init();
        this._vote = new KeyValue('_vote');
        this._voteMembers = new BlockchainMap('_voteMembers');
        this._voteMembersArray = new BlockchainArray('_voteMembersArray');
        this._voteResults = new BlockchainArray('_voteResults');
        this._voteVariants = new BlockchainArray('_voteVariants');
        this._VoteEvent = new Event('Vote', 'string', 'number');
        this._ChangeVoteState = new Event('ChangeVoteState', 'string');
        plugins.testFunction('hello', 'result');
        if (contracts.isDeploy()) { //Calls on deploying
            if (!BlockchainArray.isArray(variants)) {
                variants = VOTE_VARIANTS;
            }
            for (let v of variants) {
                this._voteVariants.push(v);
            }
            for (let v of this.contract.variants) {
                this._voteResults.push(0);
            }
            this._putKeyValue('votesCount', 0);
            this._voteState = 0;
            //add customisation for voting
            this._putKeyValue('_voteSubject', subject);
        }

    }

    /**
     * Return contract info
     * @return {{owner: string, subject: string, deadTimeLine: string, deadVotesLine: number, votePrice: number, variants: string[], type: string}}
     */
    get contract() {
        return {
            owner: CONTRACT_OWNER,
            subject: this._getKeyValue('_voteSubject'),
            deadTimeLine: VOTE_END_DATE,
            deadVotesLine: VOTE_END_THRESHOLD,
            votePrice: VOTE_PRICE,
            variants: this._voteVariants.toArray(),//this._voteVariants ? this._voteVariants.toArray() : VOTE_VARIANTS,
            type: 'vote'
        };
    }

    /**
     * Add voting with his variant to arrays
     * @param sender
     * @private
     */
    _pushVoteMember(sender) {
        this._voteMembers[sender] = true;
        this._voteMembersArray.push(sender);
    }


    /**
     * Work with vote Key-Value
     * Put
     * @param key
     * @param value
     * @private
     */
    _putKeyValue(key, value) {
        this._vote.put(key, value)
    };

    /**
     * Get
     * @param key
     * @private
     */
    _getKeyValue(key) {
        //получает значения под ключом
        return this._vote.get(key)
    };


    /**
     * Stop voting
     */
    _endVoting() {
        this._voteState = 2;
    }

    /**
     * set necessary state
     * @param ind
     */
    set _voteState(ind) {
        if(ind >= 0 && ind < STATE.length && this._voteState !== STATE[2]) {
            this._putKeyValue('state', STATE[ind]);
            this._ChangeVoteState.emit(STATE[ind]);
        } else {
            assert.assert(false, 'Wrong parameters or vote was ended')
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
        let voteCountThreshold = Number(this.contract.deadVotesLine);
        let voteEndDate = new Date(this.contract.deadTimeLine);
        if(voteCountThreshold > votesCount && voteEndDate > Date.now()) {
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
        assert.assert(this._voteMembers[user] === null && this._voteState === STATE[1], "You can't take part at this vote");
    }

    /**
     * return funds when voting ends
     * @private
     */
    _returnFunds() {
        //stopping voting
        this._endVoting();
        //create connector to main token
        let mainTokenConnector = new TokenContractConnector(contracts.getMasterContractAddress());
        //return funds to each address
        let count = this._voteMembersArray.length;
        for (let i = 0; i < count; i++) {
            let address = this._voteMembersArray[i];
            if(address) {
                mainTokenConnector.transfer(address, String(this.contract.votePrice));
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

        this._pushVoteMember(sender);
        this._voteResults[variant]++;
        let count = Number(this._getKeyValue('votesCount')) + 1;
        this._putKeyValue('votesCount', count);
    }

    /**
     * Get results of voting at this moment
     */
    getResultsOfVoting() {
        let results = {};
        let voteVariants = this.contract.variants;
        for (let no in voteVariants) {
            if(voteVariants.hasOwnProperty(no)) {
                results[voteVariants[no]] = this._voteResults[no];
            }
        }
        return JSON.stringify({results, state: this._voteState});
    }

    /**
     * make vote for necessary variant
     * @param variant {number}
     */
    processPayment(variant) {
        this.assertPayment();

        variant = Number(variant);

        let payment = this.payProcess();
        //check if this sender token is legal
        assert.assert(String(contracts.getMasterContractAddress()) === String(payment.caller), 'Wrong main token address');

        let sender = global.getState().from;
        this._userCanVote(sender);

        assert.assert(Number(this.contract.votePrice) === Number(payment.amount), 'Wrong payment amount');
        this._addVote(sender, variant);
        this._VoteEvent.emit(sender, variant);
        this._checkDeadlines();

    }

    /**
     * Start voting
     */
    startVoting(...newVariants) {
        //start can make only owner
        assert.assert(this.contract.owner === global.getState().from, 'Restricted access');
        if (newVariants.length > 0){
        //change variants(if newVariants has error, then nothing changes)
            assert.assert(this._voteState === STATE[0], 'Trying to change variants in running or ended voting');
            this._voteVariants.applyArray([...newVariants]);
        }
        this._voteState = 1;
    }

}

global.registerContract(voteContract);