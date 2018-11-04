# iZ³ Node



## Building


#### Dependencies

**iZ³ platform** depends on Node.JS version >= 8.2.0

NPM version >= 5.3.0

**Building depends on:**

Python >= 2.7

GCC / MinGW / VC++


#### Building

Preparing for work is done by running the command 
```
npm install
```

Now you can start node server by command

```
node main.js
```

**If the building ends with an error, delete the node_modules directory before retrying**

## Contributing

1. Fork it ( [https://github.com/Izzzio/iz3node/fork](https://github.com/Izzzio/iz3node/fork) )
2. Create your feature branch (git checkout -b my-new-feature)
3. Commit your changes (git commit -am 'Add some feature')
4. Push to the branch (git push origin my-new-feature)
5. Create a new Pull Request

## Maintainers

- [lailune](https://github.com/lailune) Andrey Nedobylsky - maintainer

## Troubleshooting
**If the building ends with an error, delete the node_modules directory before retrying**

#### Windows.

If the package installation fails, then

```
npm install --global --production windows-build-tools
```
By default, this command will install build tools from Visual Studio 2017.

Control Panel -> Programs and Components -> Microsoft Visual Studio Installer(run change).

In Visual Studio Installer window, find installed "Visual Studio Build Tools 2017" and click "Change".

For block "Visual C++ Build Tools" check needed options in right panel.
Make sure the "...VC++ 2015.3 v14.00(v140)" option is enabled.
