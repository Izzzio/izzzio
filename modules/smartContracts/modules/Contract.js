/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

/**
 * Recommended basis environment
 */
class Contract {

    assertOwnership(msg = 'Restricted access'){
        assert.assert(this.contract.owner === state.from, msg);
    }

    /**
     * Initialization method
     */
    init(){
        assert.false(contracts.isChild(), 'You can\'t call init method of another contract');
        if(contracts.isDeploy()){
            this.deploy();
        }
    }

    /**
     * Recommended deploy method. This method calls 1 time on deploy
     */
    deploy(){
        assert.false(contracts.isChild(), 'You can\'t call deploy method of another contract');
    }


}