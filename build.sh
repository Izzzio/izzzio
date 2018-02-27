
rm -Rf build

mkdir -p build

mkdir -p build/core
cp -Rf frontend build/core/frontend
cp -Rf modules build/core/modules
cp -f main.js build/core/main.js
cp -f Blockchain.js build/core/Blockchain.js
cp -f package.json build/core/package.json

cd shell

rm -Rf build
mkdir -p build

if [[ "$OSTYPE" == "linux-gnu" ]]; then
    electron-packager . BitcoenWallet --platform=linux --icon=logo.ico --out=build --overwrite
elif [[ "$OSTYPE" == "darwin"* ]]; then
    electron-packager . BitcoenWallet --platform=darwin --icon=logo.ico --out=build --overwrite --version=0.35.6 --app-bundle-id="com.bitcoen.bitcoenwallet" --app-version="1.0.0" --build-version="1.0.000" --osx-sign
    electron-packager . BitcoenWalletUnsigned --platform=darwin --icon=logo.ico --out=build --overwrite
elif [[ "$OSTYPE" == "msys" ]]; then
     electron-packager . BitcoenWallet --platform=win32 --icon=logo.ico --out=build --overwrite
else
     electron-packager . BitcoenWallet --platform=all --icon=logo.ico --out=build --overwrite
fi

cp -Rf build/* ../build/

cd ../build/core

npm install

if [[ "$OSTYPE" == "msys" ]]; then
    cp -f ../../buildBinary/node.exe ./node.exe
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
    cd ..
    cp -R core BitcoenWallet-darwin-x64/BitcoenWallet.app/Contents/Resources/app/
    cp -f ../buildBinary/node_darwin BitcoenWallet-darwin-x64/BitcoenWallet.app/Contents/Resources/app/core/node
    chmod 777 BitcoenWallet-darwin-x64/BitcoenWallet.app/Contents/Resources/app/core/node

    rm -R ../installers/BitcoenWallet.app
    cp -R BitcoenWallet-darwin-x64/BitcoenWallet.app ../installers/
    cd ../installers/
    rm -R BitcoenWallet-darwin-x64.dmg
    appdmg dmg.json BitcoenWallet-darwin-x64.dmg
    
    cd ..
    cp -R core BitcoenWalletUnsigned-darwin-x64/BitcoenWalletUnsigned.app/Contents/Resources/app/
    cp -f ../buildBinary/node_darwin BitcoenWalletUnsigned-darwin-x64/BitcoenWalletUnsigned.app/Contents/Resources/app/core/node
    chmod 777 BitcoenWalletUnsigned-darwin-x64/BitcoenWalletUnsigned.app/Contents/Resources/app/core/node

    rm -R ../installers/BitcoenWalletUnsigned.app
    cp -R BitcoenWalletUnsigned-darwin-x64/BitcoenWalletUnsigned.app ../installers/
    cd ../installers/
    rm -R BitcoenWalletUnsigned-darwin-x64.dmg
    appdmg dmg.json BitcoenWalletUnsigned-darwin-x64.dmg
fi

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cd ..
    cp -f ../buildBinary/node_linux core/node
    chmod 777 core/node
fi

rm ../dumb

sleep 10
