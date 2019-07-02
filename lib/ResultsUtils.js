function ResultsUtils(max_elements) {
    var results = []
    var total = 0
    var length = 0
    var max_length = max_elements
    var max_speed = 0;
    var avg_speed = 0;
  
    function remove_element() {
      total = total - results.shift()
    }
    this.add_element = function(elem) {
      length >= max_length? remove_element() : length++;
      results.push(elem);
      total+=elem
      avg_speed = (total / length)
      if (max_speed < avg_speed)
        max_speed = avg_speed
    }
    this.get_average = function() { 
      return avg_speed;
    }
    this.get_max_speed = function() { 
      return speed_unit(max_speed);
    }
    this.get_pretty_average = function() {
      return speed_unit(this.get_average())
    }
    function speed_unit(raw_speed) {
      raw_speed = (raw_speed * 8);
      if (raw_speed > 1000000000)
        return {
          speed: (raw_speed / 1000000000).toFixed(2),
          unit: "Gbps"
        }
      if (avg_speed > 1000000)
        return {
          speed: (raw_speed / 1000000).toFixed(2),
          unit: "Mbps"
        }
      if (raw_speed > 1000)
        return {
          speed: (raw_speed / 1000).toFixed(2),
          unit: "Kbps"
        }
      return {
        speed: raw_speed.toFixed(2),
        unit: "Bps"
      }
    }
  }

  module.exports = ResultsUtils;