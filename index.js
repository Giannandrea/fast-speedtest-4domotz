#! /usr/bin/env node
Promise = require('bluebird')
var apis = require("./lib/Api.js");
var Api = apis.Api

var options = {
    token: "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm",
    verbose: true, // default: false
    timeout: 15000, // default: 5000
    https: false, // default: true
    bufferSize: 4, // default: 8
    min_url_count: 2// default: depend by netflix
}
var speedtest = new Api(options);

speedtest.start().then(function(s) {
    console.log("Final test result: ")
    console.log("\tDownload Speed: "+s+" Mbps");
}).catch(function(e) {
    console.error(e.message);
});
