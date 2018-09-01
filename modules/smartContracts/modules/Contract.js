/**
 iZ³ | Izzzio blockchain - https://izzz.io
 @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */
class Contract {

    assertOwnership(msg = 'Restricted access'){
        assert.assert(this.contract.owner === state.from, msg);
    }


}