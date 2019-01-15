# iZ³ Node



## Building


#### Dependencies

**iZ³ platform** depends on Node.js version >= 8.2.0

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


## Contributing

1. Fork it ( [https://github.com/Izzzio/iz3node/fork](https://github.com/Izzzio/iz3node/fork) )
2. Create your feature branch (git checkout -b my-new-feature)
3. Commit your changes (git commit -am 'Add some feature')
4. Push to the branch (git push origin my-new-feature)
5. Create a new Pull Request

## Maintainers

- [lailune](https://github.com/lailune) Andrey Nedobylsky - maintainer

