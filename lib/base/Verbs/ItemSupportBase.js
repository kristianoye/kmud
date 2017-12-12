(function (pt) {
    var methods = {
        directDropObject: function() {
            if (this.environment !== thisPlayer)
                return 'You do not have the ' + this.displayName + ' to drop';
            return true;
        },
        directGetObject: function () {
            if (this.environment === thisPlayer)
                return 'You already have the ' + this.displayName + '!';
            return true;
        },
        directGetObjectFromObject: function (target, container) {
            return this.environment === container;
        },
        directLookAtObject: function (target) {
            return true;
        },
        directLookAtObjectInObject: function (target, container) {
            return true;
        },
        directPutObjectInObject: function (target, container) {
            return (this.environment !== container);
        }
    };
    Object.keys(methods).forEach(n => {
        if (typeof pt[n] !== 'function') pt[n] = methods[n];
    });
})(PartialType.prototype);
