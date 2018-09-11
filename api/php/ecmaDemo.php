<?php
/**
 * iZ³ | Izzzio blockchain - https://izzz.io
 * @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


require 'NodeRPC.php';
require 'EcmaSmartRPC.php';

$countractSource = <<<CONTRACT
    class TestContract extends Contract {

        init(){
            this.vars = new KeyValue('TestContract');
            super.init();
        }
        
        get contract(){
            return {"name":"TestContract"}
        }

        deploy() {
            console.log('DEPLOY');
            this.vars.put('t', 10);
        }

        call() {
            let t = Number(this.vars.get('t'));
            t++;
            console.log('CALLINGS', t);
            this.vars.put('t', t);
        }
        
        plus(a,b){
            console.log('PLUS',a,b);
            return Number(a)+Number(b);
        }
    }

    global.registerContract(TestContract);
CONTRACT;

$izNode = new EcmaSmartRPC('http://localhost:3015/');

$result = $izNode->ecmaDeployContract($countractSource)['result'];
$newAddress = $result['address'];


echo "Deployed contract address: " . $newAddress . "\n\n";

echo "Deployed contract info: " . print_r($izNode->ecmaGetContractProperty($newAddress, 'contract')['result'], true) . "\n\n";

echo "Deploy contract method 'call'\n";

$result = $izNode->ecmaDeployMethod($newAddress, 'call', [])['result'];

echo "New deploy block: ".$result['index']."\n";

echo "Call contract method without deploy plus(2,3): " . print_r($izNode->ecmaCallMethod($newAddress, 'plus', [2, 3])['result'], true) . "\n";



//var_dump($izNode->ecmaCallMethod(11,'call',[]));

/*
$wallet = $izNode->createWallet();

$izNode->changeWallet($wallet);

echo "New wallet address: " . $wallet['id'] . "\n";
echo "New tiny address: " . NodeRPC::getTinyAddress($wallet) . "\n";
echo "Current address: " . $izNode->getWallet() . "\n";
echo "\n";
echo "Info about master wallet: \n";

try {
    $masterWallet = $izNode->getWalletInfo('BL_1');
    echo "Full address: " . $masterWallet['id'] . "\n";
    echo "Balance: " . NodeRPC::mil2IZ($masterWallet['balance']) . "\n";
} catch (ReturnException $e) {
    echo "Address not found\n";
}

try {
    var_dump($izNode->createTransaction('7a6545dbbfff0f4d9723d6f83bee85dc8b93cb47a9d178cbea9157eaffda3c09', NodeRPC::IZ2Mil(1)));
} catch (ReturnException $e) {
    echo "Can't create transaction\n";
}
*/