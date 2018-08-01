
set -e

rm -Rf build

mkdir -p build

mkdir -p build/core
cp -Rf frontend build/core/frontend
cp -Rf modules build/core/modules
cp -f main.js build/core/main.js
cp -f Blockchain.js build/core/Blockchain.js
cp -f package.json build/core/package.json

cd shell

npm install electron

rm -Rf build
mkdir -p build

if [[ "$OSTYPE" == "linux-gnu" ]]; then
    electron-packager . IZ3Wallet --platform=linux --icon=logo.ico --out=build --overwrite
elif [[ "$OSTYPE" == "darwin"* ]]; then
    electron-packager . IZ3Wallet --platform=darwin --icon=logo.ico --out=build --overwrite --version=0.35.6 --app-bundle-id="com.bitcoen.bitcoenwallet" --app-version="1.0.0" --build-version="1.0.000" --osx-sign
    electron-packager . IZ3WalletUnsigned --platform=darwin --icon=logo.ico --out=build --overwrite
elif [[ "$OSTYPE" == "msys" ]]; then
     electron-packager . IZ3Wallet --platform=win32 --icon=logo.ico --out=build --overwrite
else
     electron-packager . IZ3Wallet --platform=all --icon=logo.ico --out=build --overwrite
fi

cp -Rf build/* ../build/

cd ../build/core

npm install

if [[ "$OSTYPE" == "msys" ]]; then
    cp -f ../../buildBinary/node.exe ./node.exe
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
    cd ..
    cp -R core IZ3Wallet-darwin-x64/IZ3Wallet.app/Contents/Resources/app/
    cp -f ../buildBinary/node_darwin IZ3Wallet-darwin-x64/IZ3Wallet.app/Contents/Resources/app/core/node
    chmod 777 IZ3Wallet-darwin-x64/IZ3Wallet.app/Contents/Resources/app/core/node
    electron-osx-sign  IZ3Wallet-darwin-x64/IZ3Wallet.app    


    rm -Rf ../installers/IZ3Wallet.app
    cp -R IZ3Wallet-darwin-x64/IZ3Wallet.app ../installers/
    cd ../installers/
    rm -f IZ3Wallet-darwin-x64.dmg
    appdmg dmg.json IZ3Wallet-darwin-x64.dmg
    codesign -s "Developer ID Application: Viacheslav Semenchuk" ./IZ3Wallet-darwin-x64.dmg

    rm -rf .pkg
    mkdir -p .pkg
    cp -R IZ3Wallet.app .pkg
    rm -f IZ3WalletComponents.plist
    pkgbuild --analyze --root .pkg IZ3WalletComponents.plist
    /usr/libexec/PlistBuddy -c 'set :0:BundleIsRelocatable false' IZ3WalletComponents.plist
    pkgbuild --root .pkg --install-location "/Applications" --sign "Developer ID Installer: Viacheslav Semenchuk" --component-plist IZ3WalletComponents.plist IZ3Wallet.pkg

    cd ../build/
    cp -R core IZ3WalletUnsigned-darwin-x64/IZ3WalletUnsigned.app/Contents/Resources/app/
    cp -f ../buildBinary/node_darwin IZ3WalletUnsigned-darwin-x64/IZ3WalletUnsigned.app/Contents/Resources/app/core/node
    chmod 777 IZ3WalletUnsigned-darwin-x64/IZ3WalletUnsigned.app/Contents/Resources/app/core/node

    rm -Rf ../installers/IZ3WalletUnsigned.app
    cp -R IZ3WalletUnsigned-darwin-x64/IZ3WalletUnsigned.app ../installers/
    cd ../installers/
    rm -f IZ3WalletUnsigned-darwin-x64.dmg
    appdmg dmg.json IZ3WalletUnsigned-darwin-x64.dmg
fi

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cd ..
    cp -f ../buildBinary/node_linux core/node
    chmod 777 core/node
fi

rm -rf ../dumb

sleep 10
