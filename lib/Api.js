var http = require('http');
var httpsClient = require('https');
var Url = require("url")
var path = require("path")
var MultipartDownload = require('multipart-download');
var async = require('async');
Promise = require('bluebird');

var Timer = require('./Timer');
var ApiError = require('./ApiError');
var ResultsUtils = require('./ResultsUtils');
var getPing = require('./Ping');

var DEFAULT_SPEEDTEST_TIMEOUT = 15000; // ms
var DEFAULT_BUFFER_SIZE = 8;
var MAX_CHECK_INTERVAL = 250; // ms
var PARALLEL_CONNECTIONS = 8
var FAST_URL = "https://fast.com/app-8f1bee.js";
var FAST_HTTP_URL = "api.fast.com/netflix/speedtest/";

function Api(options) {
  if (!options) {
    throw new Error('Option are required');
  }

  var set_verbose = options.verbose || false;
  var set_timeout = options.timeout || DEFAULT_SPEEDTEST_TIMEOUT;
  var https = options.https == null ? true : Boolean(options.https);
  this.https = https;
  var set_bufferSize = options.bufferSize || DEFAULT_BUFFER_SIZE;
  var min_url_count = options.min_url_count
  var parallel_connections = options.parallel_connections || PARALLEL_CONNECTIONS

  var includes = function (str, match) {
    return (str.indexOf(match) >= 0);
  }

  var get = function (url, use_https) {
    return new Promise(function (resolve, reject) {
      var client = http
      if (url.split(":")[0] == "https") {
        client = httpsClient;
      }
      var request = client.get(url, function (response) {
        if (includes(response.headers['content-type'], 'application/json') || includes(response.headers['content-type'], 'application/javascript')) {
          response.setEncoding('utf8');
          var rawData = '';
          response.on('data', function (chunk) {
            rawData += chunk;
          });
          response.on('end', function () {
            if (includes(response.headers['content-type'], 'json')) {
              var parsedData = JSON.parse(rawData);
              response.data = parsedData;
            } else {
              response.data = rawData;
            }
            resolve({
              response: response,
              request: request
            });
          });
        } else {
          resolve({
            response: response,
            request: request
          });
        }
      }).on('error', function (e) {
        reject(e);
      });
    });
  }

  var getMTD = function (target_url) {
    return new Promise(function (resolve, reject) {
      var rawData = ''
      var downloader = new MultipartDownload();
      downloader.start(target_url, {
        numOfConnections: parallel_connections
      })
      downloader.on('error', function (e) {
        reject(e);
      })
      resolve(downloader);
    });
  }

  function prettyPrintClientData(data) {
    if (data && data.client) {
      console.log("Client data")
      console.log("\tClient ISP: " + data.client.isp);
      console.log("\tClient Public IP: " + data.client.ip);
      console.log("\tClient Country: " + data.client.location.country);
    }
  }

  function prettyPrintServerData(data) {
    console.log("Targets servers");
    data.map(function (target) {
      console.log("\t" + target.url);
      if (target.location)
        console.log("\t\t" + target.location.country + ", " + target.location.city)
    });
  }

  var getTargets = function (target_url, api_paramters_ucount) {
    return new Promise(function (resolve, reject) {
      var targets = [];
      async.whilst(function test() {
          return targets.length < api_paramters_ucount;
        },
        function iter(callback) {
          target_url = target_url + (api_paramters_ucount - targets.length);
          get(target_url, https).then(function (ret) {
            var response = ret.response
            var request = ret.request
            if (response.statusCode !== 200) {
              if (response.statusCode === 403) {
                throw new ApiError({
                  code: ApiError.CODES.BAD_TOKEN
                });
              }
              throw new ApiError({
                code: ApiError.CODES.UNKNOWN
              });
            }
            targets = response.data.targets ? targets.concat(response.data.targets) : targets.concat(response.data)
            if (set_verbose) {
              prettyPrintClientData(response.data)
              prettyPrintServerData(targets);
            }
            callback(null, targets);
          });
        },
        function (nil, nil) {
          var elemArray = []
          for (var k = 0; k < min_url_count; k++) {
            elemArray.push(targets[k].url)
          }
          resolve(elemArray);
        })
    });
  }

  var getToken = function () {
    return new Promise(function (resolve, reject) {
      var return_values = {};
      var ret = get(FAST_URL, true).then(function (ret) {
        response = ret.response;
        expr = /apiEndpoint=\"((\w|-)*\.)*.\w*\/(\w*\/)*(\w|-)*\"/;
        var line = expr.exec(response.data)[0];
        return_values.apiEP = line.split("apiEndpoint=")[1].slice(1, -1)
        expr = /token\:\"(\S|-)*\",.*urlCount\:\d{1,3}/;
        line = expr.exec(response.data)[0];
        return_values.token = line.split("token:")[1].split(",")[0].slice(1, -1)
        return_values.ucount = min_url_count && min_url_count > 0 ? min_url_count : line.split("urlCount:")[1]
        resolve(return_values)
      });
    });
  }

  var getSpeed = function (targets) {
    var bytes = 0;
    var requestList = [];
    var interval = MAX_CHECK_INTERVAL;
    var interval_ms = MAX_CHECK_INTERVAL / 1000.00;
    var max_speed = 0;
    var results = new ResultsUtils(set_bufferSize);

    var timer = new Timer(set_timeout, function () {
      requestList.forEach(function (r) {
        //return r.abort()
      });
    });
    var use_https = https
    if (set_verbose) {
      console.log("Current speed test results");
    }
    async.each(targets, (function (target) {
      var ret = getMTD(target).then(function (response) {
        requestList.push(response);
        response.on('data', function (data, offeset) {
          bytes += data.length;
        });
        response.on('end', function () {
          timer.stop();
        });
      });
    }));
    return new Promise(function (resolve) {
      var queue = []
      var refreshIntervalId = setInterval(function () {
        results.add_element(bytes / interval_ms)
        if (set_verbose) {
          var speed_struct = results.get_pretty_average()
          console.log("\tCurrent speed: " + speed_struct.speed + " " + speed_struct.unit);
        }
        bytes = 0; // reset bytes count
      }, interval);

      timer.addCallback(function () {
        clearInterval(refreshIntervalId);
        resolve(results.get_max_speed());
      });
      timer.start();
    });
  }

  var getClientInfo = function (url, https) {
    return new Promise(function (resolve, reject) {
      if (https) {
        resolve(null);
        return;
      }
      var ret = get(url + "3", true).then(function (ret) {
        response = ret.response;
        resolve(response.data);
      });
    });
  }

  this.start = function () {
    return new Promise(function (resolve) {
      var results = {};
      getToken().then(function (api_paramters) {
        var target_url = "https://" + api_paramters.apiEP + "?https=true&token=" + api_paramters.token + "&urlCount=3";
        getClientInfo(target_url, https).then(function (ret) {
          https ? null : prettyPrintClientData(response.data);
          if (https == false)
            api_paramters.apiEP = FAST_HTTP_URL
          target_url = "http://" + api_paramters.apiEP + "?https=" + https + "&token=" + api_paramters.token + "&urlCount=";
          getTargets(target_url, api_paramters.ucount).then(function (targets) {
            getSpeed(targets).then(function (speed) {
              results.dspeed = speed;
              getPing(null, targets[0]).then(function (ping) {
                results.ping = ping;
                resolve(results);
              });
            })
          });
        });
      });
    });
  }
}

module.exports = {
  Api: Api
}