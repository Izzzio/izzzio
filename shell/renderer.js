function log(logStr) {
    logStr = String(logStr).split("\n").reverse().join("<br>");//.replace(/\n/g, '<br>');
    document.getElementById("log").innerHTML = logStr + document.getElementById("log").innerHTML;
}

require('electron').ipcRenderer.on('log', function (event, message) {
    log(message);
});