var https = require('https');
var http = require('http');
var Timer = require('./Timer');
var ApiError = require('./ApiError');
var async = require('asyncawait/async');
var await = require('asyncawait/await');

var DEFAULT_SPEEDTEST_TIMEOUT = 5000; // ms
var DEFAULT_BUFFER_SIZE = 8;
var MAX_CHECK_INTERVAL = 200; // ms
var FAST_URL = "https://fast.com/app-8f1bee.js";

function Api(options) {
  if (!options) {
    throw new Error('You must define options in Api constructor');
  }

  if (!options.token) {
    throw new Error('You must define app token');
  }

  this.verbose = options.verbose || false;
  this.timeout = options.timeout || DEFAULT_SPEEDTEST_TIMEOUT;
  this.https = options.https == null ? true : Boolean(options.https);
  this.bufferSize = options.bufferSize || DEFAULT_BUFFER_SIZE;

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

  var get = async (function (url, use_https) {
    return new Promise((resolve, reject) => {
      var client = use_https == true ? https : http;
      var request = client.get(url, function (response) {
        if (response.headers['content-type'].includes('application/json') || response.headers['content-type'].includes('application/javascript')) {
          response.setEncoding('utf8');
          var rawData = '';
          response.on('data', (chunk) => {
            rawData += chunk;
          });
          response.on('end', () => {
            if (response.headers['content-type'].includes('json')) {
              var parsedData = JSON.parse(rawData);
              response.data = parsedData;
            } else {
              response.data = rawData;
            }
            resolve({
              response,
              request,
            });
          });
        } else {
          resolve({
            response,
            request,
          });
        }
      }).on('error', (e) => {
        reject(e);
      });
    });
  });

  function prettyPrintClientData(data) {
    console.log("Clients data")
    console.log("\tClient ISP: " + data.client.isp);
    console.log("\tClient Public IP: " + data.client.ip);
    console.log("\tClient Country: " + data.client.location.country);
  }

  function prettyPrintServerData(data) {
    console.log("Targets servers");
    data.map(function (target) {
      console.log("\t" + target.url);
      console.log("\t\t" + target.location.country + ", " + target.location.city)
    });
  }

  this.getTargets = async (function (api_paramters) {
    try {
      var targets = [];
      while (targets.length < api_paramters.ucount) {
        var target_url = `http${this.https ? 's' : ''}://${api_paramters.apiEP}?https=${this.https}&token=${api_paramters.token}&urlCount=${api_paramters.ucount - targets.length}`
        var ret = await (get(target_url, this.https));
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
        targets = targets.concat(response.data.targets);
      }
      if (this.verbose) {
        prettyPrintClientData(response.data)
        prettyPrintServerData(targets);
      }
      return targets.map(function (target) {
        return target.url
      })
    } catch (e) {
      if (e.code === 'ENOTFOUND') {
        if (this.https) {
          throw new ApiError({
            code: ApiError.CODES.UNREACHABLE_HTTPS_API
          });
        } else {
          throw new ApiError({
            code: ApiError.CODES.UNREACHABLE_HTTP_API
          });
        }
      } else {
        throw e;
      }
    }
  });

  this.getToken = async (function () {
    var return_values = {};
    var ret = await (get(FAST_URL, true));
    response = ret.response;
    expr = /apiEndpoint=\"((\w|-)*\.)*.\w*\/(\w*\/)*(\w|-)*\"/;
    var line = expr.exec(response.data)[0];
    return_values.apiEP = line.split("apiEndpoint=")[1].slice(1, -1)
    expr = /token\:\"(\S|-)*\",.*urlCount\:\d{1,3}/;
    line = expr.exec(response.data)[0];
    return_values.token = line.split("token:")[1].split(",")[0].slice(1, -1)
    return_values.ucount = line.split("urlCount:")[1]
    return return_values
  });

  this.getSpeed = async (function () {
    try {
      api_paramters = await (this.getToken());
    } catch (e) {
      throw e;
    }
    var targets = null;
    try {
      targets = await (this.getTargets(api_paramters));
    } catch (e) {
      throw e;
    }
    var bytes = 0;
    var requestList = [];

    var timer = new Timer(this.timeout, () => {
      requestList.forEach(r => r.abort());
    });
    var use_https = this.https
    if (this.verbose) {
      console.log(`Current speed test results`);
    }
    targets.forEach(async (function (target) {
      var ret = await (get(target, use_https));
      var response = ret.response
      var request = ret.request
      requestList.push(request);
      response.on('data', (data) => {
        bytes += data.length;
      });
      response.on('end', () => {
        timer.stop();
      });
    }));
    return new Promise((resolve) => {
      var i = 0;
      var recents = new Array(this.bufferSize).fill(null); // list of most recent speeds
      var interval = Math.min(this.timeout / this.bufferSize, MAX_CHECK_INTERVAL); // ms
      var refreshIntervalId = setInterval(() => {
        i = (i + 1) % recents.length;
        recents[i] = bytes / (interval / 1000);

        if (this.verbose) {
          var speed_struct = speed_unit(average(recents))
          console.log(`\tCurrent speed: ${speed_struct.speed} ${speed_struct.unit}`);
        }

        bytes = 0; // reset bytes count
      }, interval);

      timer.addCallback(() => {
        clearInterval(refreshIntervalId);
        resolve(speed_unit(average(recents)).speed);
      });

      timer.start();
    });
  });

}

function speed_unit(rawSpeed) {
  rawSpeed = (rawSpeed * 8);
  if (rawSpeed > 1000000000)
    return {speed: (rawSpeed/1000000000).toFixed(2), unit: "Gbps"}
  if (rawSpeed > 1000000)
    return {speed: (rawSpeed/1000000).toFixed(2), unit: "Mbps"}
  if (rawSpeed > 1000)
    return {speed: (rawSpeed/1000).toFixed(2), unit: "Kbps"}
  return rawSpeed.toFixed(2)
};

module.exports = {
  Api: Api
}