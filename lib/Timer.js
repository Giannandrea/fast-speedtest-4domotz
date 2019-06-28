function Timer(delay, callback) {
    if (delay == null) {
      throw new Error('delay parameter must be defined');
    }

    if (!typeof delay == 'number') {
      throw new Error('delay parameter must be an integer');
    }

    if (callback && typeof callback !== 'function') {
      throw new Error('callback parameter must be a function');
    }

    // set properties
    this_callbacks = callback ? [callback] : [];
    this_delay = delay;
    this_remaining = delay;
    this_startTime = null;
    this_timerId = null;
    this_started = false;

  this.addCallback = function (callback) {
    this_callbacks.push(callback);
  }

  this.start = function() {
    this.resume();
  }

  this.resume = function() {
    this_startTime = new Date();
    clearTimeout(this_timerId);
    this_timerId = setTimeout(this.stop.bind(this), this_remaining);
    this_started = true;
  }

  this.pause = function() {
    clearTimeout(this_timerId);
    this_remaining -= new Date() - this_startTime;
  }

  this.stop = function() {
    if (this_started) {
      this.clear();
      this_callbacks.forEach(function(callback) {callback()});
    }
  }

  this.clear = function() {
    if (this_started) {
      clearTimeout(this_timerId);
      this_remaining = this_delay;
      this_started = false;
    }
  }
}

module.exports = Timer;
