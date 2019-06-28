var http = require('http');
var httpsClient = require('https');
var Timer = require('./Timer');
var ApiError = require('./ApiError');
var async = require('async');
Promise = require('bluebird');

var DEFAULT_SPEEDTEST_TIMEOUT = 15000; // ms
var DEFAULT_BUFFER_SIZE = 8;
var MAX_CHECK_INTERVAL = 2000; // ms
var FAST_URL = "https://fast.com/app-8f1bee.js";
var FAST_HTTP_URL = "api.fast.com/netflix/speedtest/";

Array.prototype.fill = Array.prototype.fill || function (val) {
  var i = 0;
  while (i < this.length) {
    this[i] = val;
    i += 1;
  }
  return this;
};

function Api(options) {
  if (!options) {
    throw new Error('You must define options in Api constructor');
  }

  if (!options.token) {
    throw new Error('You must define app token');
  }

  var set_verbose = options.verbose || false;
  var set_timeout = options.timeout || DEFAULT_SPEEDTEST_TIMEOUT;
  var https = options.https == null ? true : Boolean(options.https);
  this.https = https;
  var set_bufferSize = options.bufferSize || DEFAULT_BUFFER_SIZE;

  function average(arr) {
    var arrWithoutNulls = arr.filter(function (e) {
      return e
    });
    if (arrWithoutNulls.length === 0) {
      return 0;
    }
    return arrWithoutNulls.reduce(function (a, b) {
      return a + b
    }) / arrWithoutNulls.length;
  }

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

  function prettyPrintClientData(data) {
    if (data && data.client) {
      console.log("Clients data")
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
      //while (targets.length < api_paramters.ucount) {
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
        resolve(targets.map(function (target) {
          return target.url
        }));
      });
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
        return_values.ucount = line.split("urlCount:")[1]
        resolve(return_values)
      });
    });
  }

  var getSpeed = function (targets) {
    var bytes = 0;
    var requestList = [];

    var timer = new Timer(set_timeout, function () {
      requestList.forEach(function (r) {
        return r.abort()
      });
    });
    var use_https = https
    if (set_verbose) {
      console.log("Current speed test results");
    }
    async.each(targets, (function (target) {
      var ret = get(target, use_https).then(function (ret) {
        var response = ret.response
        var request = ret.request
        requestList.push(request);
        response.on('data', function (data) {
          bytes += data.length;
        });
        response.on('end', function () {
          timer.stop();
        });
      });
    }));
    return new Promise(function (resolve) {
      var i = 0;
      var recents = new Array(set_bufferSize).fill(null); // list of most recent speeds
      var interval = Math.min(set_timeout / set_bufferSize, MAX_CHECK_INTERVAL); // ms
      var refreshIntervalId = setInterval(function () {
        i = (i + 1) % recents.length;
        recents[i] = bytes / (interval / 1000);

        if (set_verbose) {
          var speed_struct = speed_unit(average(recents))
          console.log("\tCurrent speed: " + speed_struct.speed + " " + speed_struct.unit);
        }

        bytes = 0; // reset bytes count
      }, interval);

      timer.addCallback(function () {
        clearInterval(refreshIntervalId);
        resolve(speed_unit(average(recents)).speed);
      });

      timer.start();
    });
  }

  this.start = function () {
    return new Promise(function (resolve) {
      getToken().then(function (api_paramters) {
        if (https == false)
          api_paramters.apiEP = FAST_HTTP_URL
        var target_url = "http://" + api_paramters.apiEP + "?https=" + https + "&token=" + api_paramters.token + "&urlCount=";
        getTargets(target_url, api_paramters.ucount).then(function (targets) {
          getSpeed(targets).then(function (speed) {
            resolve(speed)
          })
        });
      });
    });
  }

}

function speed_unit(rawSpeed) {
  rawSpeed = (rawSpeed * 8);
  if (rawSpeed > 1000000000)
    return {
      speed: (rawSpeed / 1000000000).toFixed(2),
      unit: "Gbps"
    }
  if (rawSpeed > 1000000)
    return {
      speed: (rawSpeed / 1000000).toFixed(2),
      unit: "Mbps"
    }
  if (rawSpeed > 1000)
    return {
      speed: (rawSpeed / 1000).toFixed(2),
      unit: "Kbps"
    }
  return rawSpeed.toFixed(2)
};

module.exports = {
  Api: Api
}