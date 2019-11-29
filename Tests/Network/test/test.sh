echo "Preparing fixtures"
rm -R ./test/*
echo "" > test/dumb
cp -R fixture/* test/

echo "Running tests"
node ../../../main.js --no-splash --fall-on-errors
