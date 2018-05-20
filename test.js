const crypto = require("crypto");

//console.log(crypto.getCurves());

let aliceECDH = crypto.createECDH("secp521r1");
aliceECDH.generateKeys();

let alicePublicKey = aliceECDH.getPublicKey(null, "compressed"),
    alicePrivateKey = aliceECDH.getPrivateKey(null, "compressed");

console.log("Alice Public: ", alicePublicKey.length, alicePublicKey.toString("hex"));
console.log("Alice Private:", alicePrivateKey.length, alicePrivateKey.toString("hex"));

let bobECDH = crypto.createECDH("secp521r1");
bobECDH.generateKeys();

let bobPublicKey = bobECDH.getPublicKey(null, "compressed"),
    bobPrivateKey = bobECDH.getPrivateKey(null, "compressed");

console.log("Bob Public:   ", bobPublicKey.length, bobPublicKey.toString("hex"));
console.log("Bob Private:  ", bobPrivateKey.length, bobPrivateKey.toString("hex"));

// On Alice's side
let secret1 = aliceECDH.computeSecret(bobPublicKey);
console.log("Alice Secret: ", secret1.length, secret1.toString("hex"));

// On Bob's side
let secret2 = bobECDH.computeSecret(alicePublicKey);
console.log("Bob Secret:   ", secret2.length, secret2.toString("hex"));

console.log('');

let badECDH = crypto.createECDH("secp521r1");
badECDH.generateKeys();

let badPublicKey = badECDH.getPublicKey(null, "compressed"),
    badPrivateKey = badECDH.getPrivateKey(null, "compressed");

console.log("bad Public:   ", badPublicKey.length, badPublicKey.toString("hex"));
console.log("bad Private:  ", badPrivateKey.length, badPrivateKey.toString("hex"));
// On Bob's side
let secret3 = badECDH.computeSecret(alicePublicKey);
console.log("bad Secret:   ", secret3.length, secret3.toString("hex"));
