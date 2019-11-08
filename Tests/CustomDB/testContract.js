const CONTRACT_OWNER = '-----BEGIN RSA PUBLIC KEY-----\n' +
    'MIIBCgKCAQEApSJ2Lm6h26vHgiqB4VcyOZE+meRB6Jaow6Z+6cBn43fvcM57l8O2DfFTgo9R\n' +
    '4AUavuFJU8bekhcCWYC53RErumjHBrWVviGDOxRALfev8fOU6V+hm9E7FGiW5RXMew5729lt\n' +
    'rOxsyrayUtBLsd6BAEO5n/AtAI08Et403X/UX/7N/9zKu+F2E/fi1VlvJS07TtgPoRuT9vx6\n' +
    'ol7B0OcqGU0lIe84TasfX4pN9RIZe3+O8idBTg9aHbtuD2qSSQ9x1jpcD4wOtb+FhgBJ3dOI\n' +
    'eIC3eapWvK4HFtAtX1uIyod3LruSVssrNtLEqWOgD5MwOlv1KWAR0ZDZ3cYNL8Of8QIDAQAB\n' +
    '-----END RSA PUBLIC KEY-----\n';


/**
 * Test contract
 */
class testContract extends Contract {

    /**
     * Initialization method with emission
     */
    init() {
        super.init();
        console.log('Plugins Started!');
        let testClass = new TestClass();
        testClass.writeln('Test Class OK');
        console.log(plugins.ecma.testFunction('hello','bye'));
        console.log('Hash' + plugins.crypto.hash('test'));
        //console.log('Hash ' + crypto.hash('test'));
    }


    /**
     * Return contract info
     * @return {{owner: string, type: string}}
     */
    get contract() {
        return {
            owner: CONTRACT_OWNER,
            type: 'test'
        };
    }



}

global.registerContract(testContract);