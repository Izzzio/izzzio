echo "Preparing fixtures"
rm -R ./temp/*
echo "" > temp/dumb
cp -R fixture/* temp/

echo "Running tests"
node ../../../main.js --no-splash --fall-on-errors --config config.json &
sleep 3
node --stack_trace_limit=200 ../../../main.js --no-splash --fall-on-errors --config config2.json --leech-mode
