const NodeRPC = require('../NodeRPC');

let izNode = new NodeRPC('http://localhost:3015/');

async function main() {
    console.log('Try to create wallet');
    try
    {
        let wallet = await izNode.getWallet();//izNode.createWallet();
    } catch (e) {
        console.log(e);
    }
    
    console.log(wallet);
    console.log('Try to change wallet');
    let cw = await izNode.changeWallet(wallet);
    
    console.log('New wallet address ' + wallet['id']);
    //console.log( "New tiny address: " + NodeRPC.getTinyAddress($wallet) );
    console.log( "Current address: " + izNode.getWallet());
    console.log();

}

main().then(()=>console.log('Done'));