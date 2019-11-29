echo "Preparing fixtures"
rm -R ./temp/*
echo "" > temp/dumb
cp -R fixture/* temp/

echo "Running tests"
node ../../main.js --no-splash --fall-on-errors
