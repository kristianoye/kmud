const { ExecutionContext, CallOrigin } = require("../ExecutionContext");


class MathHelper {
    /**
     * Decimal adjustment of a number.
     *
     * @param {ExecutionContext} ecc The current callstack
     * @param {String}  type  The type of adjustment.
     * @param {Number}  value The number.
     * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
     * @returns {Number} The adjusted value.
     */
    static decimalAdjust(ecc, type, value, exp) {
        let frame = ecc.push({ file: __filename, method: 'decimalAdjust', callType: CallOrigin.DriverEfun });
        try {
            // If the exp is undefined or zero...
            if (typeof exp === 'undefined' || +exp === 0) {
                return Math[type](value);
            }

            value = +value;
            exp = +exp;

            // If the value is not a number or the exp is not an integer...
            if (value === null || isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
                return NaN;
            }

            // If the value is negative...
            if (value < 0) {
                return -decimalAdjust(type, -value, exp);
            }

            // Shift
            value = value.toString().split('e');
            value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));

            // Shift back
            value = value.toString().split('e');
            return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} value
     * @param {any} exp
     * @returns
     */
    static ceil10(ecc, value, exp) {
        let frame = ecc.push({ file: __filename, method: 'ceil10', callType: CallOrigin.DriverEfun });
        try {
            return MathHelper.decimalAdjust('ceil', value, exp);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} value
     * @param {any} exp
     * @returns
     */
    static floor10(ecc, value, exp) {
        let frame = ecc.push({ file: __filename, method: 'floor10', callType: CallOrigin.DriverEfun });
        try {
            return MathHelper.decimalAdjust('floor', value, exp);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} value
     * @param {any} exp
     * @returns
     */
    static round10(ecc, value, exp) {
        let frame = ecc.push({ file: __filename, method: 'round10', callType: CallOrigin.DriverEfun });
        try {
            return MathHelper.decimalAdjust('round', value, exp);
        }
        finally {
            frame.pop();
        }
    }
}

module.exports = MathHelper;
