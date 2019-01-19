echo off

echo Preparing fixtures
del /F /S /Q temp\* > nul 2>&1
echo "" > temp\dumb
copy fixture\* temp\ > nul 2>&1

echo Running tests
node ../../main.js --no-splash --fall-on-errors
