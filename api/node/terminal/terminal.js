const Repl = require('repl');
const EcmaSmartRPC = require('../EcmaSmartRPC');
const fs = require('fs'); 

console.log('TIP: Use constructor EcmaSmartRPC(RPCUrl, password) to connect to node.')
repl = Repl.start({
    useColors: true,
    replMode: Repl.REPL_MODE_STRICT,
    //ignoreUndefined: true,
});

repl.context.EcmaSmartRPC = EcmaSmartRPC;
repl.context.fs = fs;

