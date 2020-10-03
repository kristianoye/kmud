Number.prototype.clearFlag = function (flag) {
    let returnValue = this.valueOf() & ~flag;
    return returnValue;
};

Number.prototype.hasAnyFlag = function (flag) {
    return (this.valueOf() & flag) > 0;
};

Number.prototype.hasFlag = function (flag) {
    return (this.valueOf() & flag) === flag;
};

Number.prototype.setFlag = function (flag) {
    let returnValue = this.valueOf() | flag;
    return returnValue;
};
