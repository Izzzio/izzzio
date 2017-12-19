
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
    electron-packager . BitcoenShell --platform=linux --icon=logo.ico --out=build --overwrite
elif [[ "$OSTYPE" == "darwin"* ]]; then
    electron-packager . BitcoenShell --platform=darwin --icon=logo.ico --out=build --overwrite
elif [[ "$OSTYPE" == "msys" ]]; then
     electron-packager . BitcoenShell --platform=win32 --icon=logo.ico --out=build --overwrite
else
     electron-packager . BitcoenShell --platform=all --icon=logo.ico --out=build --overwrite
fi

cp -Rf build/* ../build/

cd ../build/core

npm install

if [[ "$OSTYPE" == "msys" ]]; then
    cp -f ../../buildBinary/node.exe ./node.exe
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
    cd ..
    cp -R core BitcoenShell-darwin-x64/BitcoenShell.app/Contents/Resources/app/
    cp -f ../buildBinary/node_darwin BitcoenShell-darwin-x64/BitcoenShell.app/Contents/Resources/app/core/node
    chmod 777 BitcoenShell-darwin-x64/BitcoenShell.app/Contents/Resources/app/core/node

    rm -R ../installers/BitcoenShell.app
    cp -R BitcoenShell-darwin-x64/BitcoenShell.app ../installers/
    cd ../installers/
    rm -R BitcoenShell-darwin-x64.dmg
    appdmg dmg.json BitcoenShell-darwin-x64.dmg
fi

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cd ..
    cp -f ../buildBinary/node_linux core/node
    chmod 777 core/node
fi

rm ../dumb

sleep 10
