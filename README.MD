![iZ3 logo](https://github.com/Izzzio/izzzio/raw/master/logo.png)

![ES8](https://img.shields.io/badge/es-8-brightgreen.svg)
![GitHub contributors](https://img.shields.io/github/contributors/izzzio/izzzio.svg)
![GitHub last commit](https://img.shields.io/github/last-commit/izzzio/izzzio.svg)
![Github search hit counter](https://img.shields.io/github/search/izzzio/izzzio/goto.svg)
![GitHub top language](https://img.shields.io/github/languages/top/izzzio/izzzio.svg)
# iZ³ - IZZZIO Blockchain Node

IZZZIO (iZ³) - fully customizable blockchain platform. This platform provides super-flexible configuration of each functional link of the network. The network supports the following functions:

+ Flexible network configuration
+ External crypto plugins support for custom cryptography integration
+ 1-dimensional chain configuration
+ Free format blocks. You can store any data up to 15 MB
+ Turing-complete JavaScript smart contracts
+ Support of browsers integration without additional plugins and integration layers. Works by [Candy framework](https://github.com/Izzzio/Candy)
+ 50000 tx/sec tested speed. See [benchmark](benchmark) section
+ Internal consensus mechanism without miners: LCPoA
+ Support for other consensus plugins
+ DApp operating system
+ Special P2P hi-speed messaging protocol - StarWave and StarWaveCrypto for encrypted messaging

## Docs 

Programming guide and references you can found in our [WIKI pages https://github.com/Izzzio/izzzio/wiki](https://github.com/Izzzio/izzzio/wiki)

## BigNet

BigNet is a public network of smart contracts developed by IZZZIO specifically for business tasks. The network allows you to run your decentralized applications, while being safe from changing the rate of cryptocurrencies, and increasing the cost of transactions. Because they are free :)

See [BigNet section](BigNet)

[See BigNet site](https://bignet.izzz.io)

## Installing

[![npm version](https://badge.fury.io/js/iz3node.svg)](https://www.npmjs.com/package/iz3node)

Simplest way:

``npm i -g iz3node``

Now you can use it as ``iz3node --config config.json``

## Building Node


#### Dependencies

**iZ³ platform** depends on Node.js version >= 10.0.0

NPM version >= 5.3.0

For now we recommend build iZ³ Node for Node.js >= 10

**Building depends on:**

Python >= 2.7

GCC / MinGW / VC++


#### Building

Preparing for work is done by running the command 
```
npm install
```

Now you can start node by command

```
node main.js
```

**If the building ends with an error, delete the node_modules directory before retrying**

## Troubleshooting
**If the building ends with an error, delete the node_modules directory before retrying**

#### Windows.

If the package installation fails, use

```
npm install --global --production windows-build-tools
```
This command will install Visual Studio 2017 build tools.

Then:

Control Panel -> Programs and Components -> Microsoft Visual Studio Installer(run change).

In Visual Studio Installer window, find installed "Visual Studio Build Tools 2017" and click "Change".

In "Visual C++ Build Tools" section.

Check needed options in right panel:

Make sure the "...VC++ 2015.3 v14.00(v140)" option is enabled.


## Communication

Our DISCORD channel: [https://discord.gg/5EmW96a](https://discord.gg/5EmW96a)

Official Telegram group: [https://t.me/izzzio](https://t.me/izzzio)

Welcome for any descussions and questions!

## Contributing

Hi and welcome!
Please! Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

After reading use the following steps:

1. Fork it ( [https://github.com/Izzzio/izzzio/fork](https://github.com/Izzzio/izzzio/fork) )
2. Create your feature branch (git checkout -b my-new-feature)
3. Commit your changes (git commit -am 'Add some feature')
4. Push to the branch (git push origin my-new-feature)
5. Create a new Pull Request

## Maintainers

- [lailune](https://github.com/lailune) Andrey Nedobylsky - maintainer

## Hall of fame

In this section we publish the best contributors.

* Dmitry Elsukov [demndik](https://github.com/demndik)
* Kirill Revenkov [Arucard89](https://github.com/Arucard89)


***

[![https://nodei.co/npm/iz3node.png?downloads=true&downloadRank=true&stars=true](https://nodei.co/npm/iz3node.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/iz3node)
