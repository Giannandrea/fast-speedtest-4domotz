#! /usr/bin/env node

var apis = require("./lib/api.js");
var Api = apis.Api

var options = {
    token: "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm",
    verbose: true, // default: false
    timeout: 10000, // default: 5000
    https: true, // default: true
    bufferSize: 8, // default: 8
}
var speedtest = new Api(options);

speedtest.start().then(s => {
    console.log(`Final test result: `)
    console.log(`\tDownload Speed: ${s} Mbps`);
}).catch(e => {
    console.error(e.message);
});
