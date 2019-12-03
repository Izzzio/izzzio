# Benchmark
Node benchmarking tools

![Node benchmark](https://github.com/Izzzio/iz3node/blob/master/benchmark/benchmark.gif?raw=true)

Start new network before testing by these steps:

For standard mode:

* cd benchmark
* Delete blocks folder, keyring.json, wallet.json
* node ../main.js --config ./configStandardNew.json --new-chain --keyring-emission
* Wait until new chain started (until 3 block mined)
* Shutdown node by Ctrl+C
* Start benchmark by node ../main.js --config ./configStandard.json

For performance mode:

* cd benchmark
* Delete blocks blocks.json, keyring.json, wallet.json
* node ../main.js --config configPerformanceNew.json --new-chain --keyring-emission
* Wait until new chain started (until 3 block mined)
* Shutdown node by Ctrl+C
* Start benchmark by node ../main.js --config ./configPerformance.json


Enjoy

