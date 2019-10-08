
class EcmaSmartRPC extends NodeRPC {
    
    constructor (RPCUrl = 'http://localhost:3001/', pass = '') {
        super(RPCUrl, pass);
        this.METHODS = {
            ...this.METHODS,
            'contracts/ecma/getInfo':'GET',
            'contracts/ecma/getContractInfo':'GET',
            'contracts/ecma/getContractProperty': 'GET',
            'contracts/ecma/callMethod': 'POST',
            'contracts/ecma/deployMethod': 'POST',
            'contracts/ecma/deployContract': 'POST',
        }
    }
}
