function ApiError(options) {
    console.log("api error: "+options.code)
    if (options && options.code) {
      const codeKey = Object.keys(ApiError.CODES).find(function(key) { return ApiError.CODES[key] === options.code});
      console.error(codeKey+": "+(options.message || options.code));
      this.code = codeKey;
    } else if (options && options.message) {
      console.error(options.message);
    } else {
      console.error("Generic error");
    }
}

ApiError.CODES = {
  BAD_TOKEN: 'Unknown app token',
  UNREACHABLE_HTTPS_API: 'Fast api is unreachable with https, try with http',
  UNREACHABLE_HTTP_API: 'Fast api is unreachable, check your network connection',
  UNKNOWN: 'Unknown error',
};

module.exports = ApiError;
