![Sollar logo](https://testnet.sollar.tech/static/media/solar-logo.273118e9.svg)

# Sollar node installation guide

## Choice 1 - Easy instalation

To get started, make sure you have software: Docker Engine
<br>
You should use sudo, root or docker group user
<br><br>
Make a folder for chain files data
```bash
mkdir runtime
```
Run next command to start node from Docker hub
```bash
docker run -ti -p 3017:3017 -p 6018:6018 --mount type=bind,source="$(pwd)"/runtime,target=/app/sollar/runtime --entrypoint ./run sollar/sollar-node:latest
```
<br>
Next see "Node activation" section after CHOICE 2
<br>

## Choice 2 - Instalation from git repository

To get started, make sure you have software: Git, Docker Engine

### 1. Install using the repository:
   Make a work directory and go to new directory, next you should clone the git Sollar Node repository: https://github.com/SollarChain/sollar-node
   <br><br>
   Use next command for cloning <br>
   ```bash
   git clone https://github.com/SollarChain/sollar-node.git sollar_blockchain
   ```
   
### 2. To starting node
#### Build node:
   Your current directory should be the cloning directory sollar_blockchain<br><br>
   Use next command to build node<br>
   ```bash
   docker build -t docker-sollar-blockchain .
   ```
#### Run node:
   Use next command to run node in the background mode
   ```bash
   docker run -it -dp 3017:3017 -p 6018:6018 docker-sollar-blockchain
   ```
   If you want to see log on the screen, use next command
   ```bash
   docker run -it -p 3017:3017 -p 6018:6018 docker-sollar-blockchain
   ```
## Node activation
Next you should activate node.<br>
After starting node, you may open a hello page in your browser.<br><br>
Open the next link<br>
```
http://YOUR_SERVER_IP_ADDRESS:3017/node/
```
<br>
Log in using the wallet from which you are going to transfer SOL to the staking contract. Make sure that this wallet has at least 200,000 SOL. Click on the "Activate" button. After that, 200,000 SOL will be debited from your wallet and the node will be activated.
