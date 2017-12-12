(function (pt) {
    var methods = {
        getItem: function (item) {
            var items = this.getProperty('senses', {});
            if (item in items) {
                return items[item];
            }
            return false;
        }
    };
    Object.keys(methods).forEach(n => {
        if (typeof pt[n] !== 'function') pt[n] = methods[n];
    });
})(PartialType.prototype);
