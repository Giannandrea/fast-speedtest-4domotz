var ping = require("net-ping");
var dns = require('dns');
var uri = require('url');
var MAX_ATTEMPT = 15;
var ping_ms = {
    max: 0,
    error: 0,
    min: 0,
    count: 0,
    average: 0,
    total: 0,
};

var pinghost = function (ip, session) {
    return new Promise(function (nested_resolve) {
        session.pingHost(ip, function (error, target, sent, rcvd) {
            var ms = rcvd - sent;
            if (error) {
                ping_ms.error += 1;
            } else {
                ping_ms.total += ms;
                if (ms > ping_ms.max)
                    ping_ms.max = ms;
                if (ms < ping_ms.min || ping_ms.min == 0)
                    ping_ms.min = ms;
            }
            ping_ms.count += 1;
            nested_resolve(ping_ms);
        });
    })
}

var resolve_host = function (url) {
    return new Promise(function (nested_resolve) {
        dns.lookup(uri.parse(url).hostname, function (err, ip) {
            nested_resolve(ip);
        });
    });
}

function Ping(poptions, url) {
    return new Promise(function (resolve) {
        var targets = [];
        var session = ping.createSession(options);
        var options = {};
        options.retries = (poptions && poptions.retries) ? poptions.retries : 3
        options.timeout = (poptions && poptions.timeout) ? poptions.timeout : 2000

        session.on("error", function (error) {
            console.trace(error.toString());
        });


        ping_ms.length = MAX_ATTEMPT;
        resolve_host(url).then(function (ip) {
            console.log(ip)
            for (var i = 0; i < MAX_ATTEMPT; i++) {
                pinghost(ip, session).then(function (res) {
                    if (res.count >= res.length) {
                        res.average = (res.total / res.count).toFixed(2);
                        resolve(res);
                        return;
                    }
                });
            }
        });
    });
}
module.exports = Ping;