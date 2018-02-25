<?php
/**
 * iZ³ | Izzzio blockchain - https://izzz.io
 * BitCoen project - https://bitcoen.io
 * @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */


require 'BitcoenRPC.php';

$bitcoen = new BitcoenRPC();

$wallet = $bitcoen->createWallet();
var_dump($wallet);
/*
$bitcoen->changeWallet($wallet);

echo "New wallet address: " . $wallet['id'] . "\n";
echo "New tiny address: " . BitcoenRPC::getTinyAddress($wallet) . "\n";
echo "Current address: " . $bitcoen->getWallet() . "\n";
echo "\n";
echo "Info about master wallet: \n";

try {
    $masterWallet = $bitcoen->getWalletInfo('BL_1');
    echo "Full address: " . $masterWallet['id'] . "\n";
    echo "Balance: " . BitcoenRPC::mil2Ben($masterWallet['balance']) . "\n";
} catch (ReturnException $e) {
    echo "Address not found\n";
}

try {
    var_dump($bitcoen->createTransaction('7a6545dbbfff0f4d9723d6f83bee85dc8b93cb47a9d178cbea9157eaffda3c09', BitcoenRPC::ben2Mil(1)));
} catch (ReturnException $e) {
    echo "Can't create transaction\n";
}
*/