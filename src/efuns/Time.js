const { ExecutionContext, CallOrigin } = require("../ExecutionContext");


class TimeHelper {
    /**
     * Returns the number of seconds since the epoch
     * @returns {number} The number of seconds
     */
    static get now() {
        return Math.floor(new Date().getTime() / 1000);
    }

    /**
     * Returns the number of milliseconds since the epoch
     * @returns {number} The number of seconds
     */
    static get nowMS() {
        return new Date().getTime();
    }

    /**
     * Parse an expression as a timespan and convert to milliseconds
     * @param {string} timespanStringIn The expression to convert.
     * @returns {number} The number of seconds (or false if parsing failed)
     */
    static timespan(ecc, timespanStringIn) {
        let [frame, timespanString] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'timespan', callType: CallOrigin.DriverEfun });
        try {
            let std = timespanString
                .trim()
                .split(':');

            if (std.length > 1) {
                let result = 0, re = /(\d+\.{0,1}\d*)([\w]*)?/;
                let failure = std
                    .map(s => s.trim())
                    .reverse()
                    .map((s, i) => {
                        let m = re.exec(s);
                        if (m) {
                            if (m[2]) {
                                result += TimeHelper.timespan(s);
                            }
                            else if (m[1]) {
                                switch (i) {
                                    case 0: // seconds
                                        result += parseFloat(m[1]) * 1000;
                                        break;

                                    case 1: // minutes
                                        result += parseInt(m[1]) * 60000;
                                        break;

                                    case 2: // hours
                                        result += parseInt(m[1]) * 60000 * 60;
                                        break;

                                    case 3: // days
                                        result += parseInt(m[1]) * 60000 * 60 * 24;
                                        break;

                                    case 4: // weeks
                                        result += parseInt(m[1]) * 7 * 60000 * 60 * 24;
                                        break;

                                    default:
                                        return false;
                                }
                                return true;
                            }
                        }
                        return false;
                    })
                    .filter(f => f === false);

                return failure.length === 0 ? result : false;
            }
            else {
                let result = 0, re = /(([\d]+)([a-z]+))/,
                    parts = timespanString
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '')
                        .split(re)
                        .filter(s => s.length > 0);

                parts.forEach(s => {
                    let m = re.exec(s);
                    if (m && m.length === 4) {
                        let n = parseFloat(m[2]);
                        switch (m[3].toLowerCase()) {
                            case 's': case 'second': case 'seconds':
                                result += n * 1000;
                                break;
                            case 'm': case 'minute': case 'minutes':
                                result += n * 1000 * 60;
                                break;
                            case 'h': case 'hour': case 'hours':
                                result += n * 1000 * 60 * 60;
                                break;
                            case 'd': case 'day': case 'days':
                                result += n * 1000 * 60 * 60 * 24;
                                break;
                            case 'w':
                                result += n * 1000 * 60 * 60 * 24 * 7;
                                break;
                        }
                    }
                });
                return result;
            }
        }
        finally {
            frame?.pop();
        }
    }
}

module.exports = TimeHelper;
