const NodeRPC = require('../NodeRPC');

let izNode = new NodeRPC();

async function main() {
    let wallet = izNode.createWallet();
    await izNode.changeWallet(wallet);
    console.log('New wallet address ' + wallet['id']);
    //console.log( "New tiny address: " + NodeRPC.getTinyAddress($wallet) );
    console.log( "Current address: " + izNode.getWallet());
    console.log();

}