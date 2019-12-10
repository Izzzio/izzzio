echo off

echo Preparing fixtures
del /F /S /Q temp\* > nul 2>&1
echo "" > temp\dumb
xcopy /E  /Y fixture\* temp\ > nul 2>&1

echo Running tests
start node ../../../main.js --no-splash --fall-on-errors --config config.json
TIMEOUT  /NOBREAK 3
node --stack_trace_limit=200 ../../../main.js --no-splash --fall-on-errors --config config2.json --leech-mode