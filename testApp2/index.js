/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 EDUCERT - blockchain certificates checker
 */

const logger = new (require('../modules/logger'))("testApp");
const storj = require('../modules/instanceStorage');

const DApp = require('../app/DApp');


let that;

/**
 * EDU DApp
 */
class App extends DApp {

    /**
     * Initialize
     */
    init() {
        that = this;
        /**
         * @var {starwaveProtocol} starwave
         */
        let starwave = storj.get('starwaveProtocol');

        let messages = 0;

        starwave.registerMessageHandler('SW_TEST', function (message) {
            delete message._socket;
            console.log("HANDLER " + messages);
            console.log(message);
            messages++;
        });
		
        setInterval(function () {
			
           let message = starwave.createMessage({a: 'ping'}, 'candy', undefined, 'SW_TEST');
           console.log(message);
			/*//let message = starwave.createMessage('hello', 'candy', undefined, 'SW_TEST');
            
			
			
			starwave.starwaveCrypto.sendMessage(message);
			console.log('message');
			console.log(message);
			console.log('secretKeys');
            console.log(that.blockchain.secretKeys);
			starwave.starwaveCrypto.makeConnection('candy');*/
        }, 10000);


    }


}

module.exports = App;