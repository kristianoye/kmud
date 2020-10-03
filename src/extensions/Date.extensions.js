/*
 * Date utility functions
 */

Date.prototype.addMs = function (value = 0) {
    let result = new Date(this.getTime() + value);
    return result;
};

Date.prototype.addSeconds = function (value = 0) {
    let result = this.addMs(value * 1000);
    return result;
};


Date.prototype.addMinutes = function (value = 0) {
    let result = this.addMs(value * 60 * 1000);
    return result;
};

Date.prototype.addHours = function (value = 0) {
    let result = this.addMs(value * 3600 * 1000);
    return result;
};

Date.prototype.addDays = function (value = 0) {
    let result = this.addMs(value * 24 * 3600 * 1000);
    return result;
};
