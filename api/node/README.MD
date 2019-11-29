# iz3-nodejs-api

IZZZIO blockchain platform Node.js API bindings and CLI RPC terminal.

## Terminal
You can install this package globally by using

```
npm -g install iz3-nodejs-api
```

Then using connection command

```
iz3connect http://localhost:3000 password
```

Also you can start terminal manually
```shell script
npm run terminal
```

## API
Install module for current project
```shell script
npm install iz3-nodejs-api --save
```

then
```javascript
const EcmaSmartRPC = require('iz3-nodejs-api');
let izNode = new EcmaSmartRPC('http://localhost:3015/','connectionPassword');
```

Now you can use some API methods like:
```javascript
(async ()=>{
    await izNode.getInfo(); //Some node info stuff
})(); 
```

See [demo](demo/) for more information.


API description you can found in [Wiki](https://github.com/Izzzio/izzzio/wiki/Node.js-API)