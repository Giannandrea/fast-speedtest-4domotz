#! /usr/bin/env node
Promise = require('bluebird')
var commandLineArgs = require('command-line-args')
var apis = require("./lib/Api.js");
var Api = apis.Api

var print_help = function() {
    console.log("fast-speedtest [options]");
    console.log("use the options:");
    console.log(" --verbose [-v]: print more logs");
    console.log(" --https [-s]: use https server with secure connections");
    console.log(" --timeout [-t]: change connection timeout");
    console.log(" --min_url_count [-u]: change the number of results returned by fast api");
    console.log(" --bufferSize [-b] set the smooth option number");
    console.log(" --parallel_connections [-p] number of parallel connections in download");
    process.exit();
}

var optionDefinitions = [
    { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
    { name: 'https', alias: 's', type: Boolean, defaultValue: false },
    { name: 'timeout', alias: 't', type: Number, defaultValue: 15000},
    { name: 'min_url_count', alias: 'u', type: Number, defaultValue: 4},
    { name: 'bufferSize', alias: 'b', type: Number, defaultValue: 3},
    { name: 'parallel_connections', alias: 'p', type: Number, defaultValue: 8},
  ]

if (process.argv.indexOf("-h") > -1 || process.argv.indexOf("--help") > -1 ) {
    print_help();
}

var options = commandLineArgs(optionDefinitions)
var speedtest = new Api(options);

speedtest.start().then(function(s) {
    console.log("Final test result: ")
    console.log("\tDownload Speed: "+s.speed+" "+s.unit);
}).catch(function(e) {
    console.error(e.message);
});
