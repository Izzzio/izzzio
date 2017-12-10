
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

electron-packager . BitcoenShell --platform=all --icon=logo.ico --out=build --overwrite

cp -Rf build/* ../build/

cd ../build/core


npm install

cp -f ../../buildBinary/node.exe ./node.exe

rm ../dumb

sleep 100
