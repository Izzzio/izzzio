echo "Preparing fixtures"
rm -R ./temp/*
echo "" > temp/dumb
cp -R fixture/* temp/

echo "Running tests"
node --stack_trace_limit=200 ../../../main.js --no-splash --fall-on-errors --config config.json --leech-mode
