/*
 * Extensions to the String object
 */

String.prototype.contains = function (word, ignoreCase = false) {
    if (typeof word !== 'string')
        word = (word || '').toString();
    if (ignoreCase)
        return this.toLowerCase().indexOf(word.toLowerCase()) > -1;
    else
        return this.indexOf(word) > -1;
};

String.prototype.countInstances = function (word, ignoreCase = false) {
    let substrings = ignoreCase ? this.toLowerCase().split(word.toLowerCase()) : this.split(word);
    return substrings.length - 1;
};

if (typeof String.prototype.fs !== 'function')
String.prototype.fs = function (...args) {
    let s = this.slice(0), result = '', pos = 0;

    for (let i = 0; i < args.length; i++) {
        let re =  /\{(?<index>[\d]+)(?<format>[\:\,][^\}]+){0,1}\}/g,
            m = re.exec(s);

        while (m !== null) {
            result += s.slice(pos, m.index);

            let index = parseInt(m.groups.index);

            if (index === i && index < args.length) {
                let valueString = args[i],
                    matchLen = m[0].length;

                if (valueString === undefined)
                    valueString = '[undefined]';
                else if (valueString === null)
                    valueString = 'NULL';
                else
                    valueString = args[i].toString();

                if (m.groups.format) {
                    let format = m.groups.format.slice(1);
                    let len = valueString.stripColors().length;
                    let n = parseInt(format);

                    if (!isNaN(n)) {
                        let width = Math.abs(n),
                            paddingNeeded = width - len;
                        if (paddingNeeded > 0) {
                            valueString = n < 0 ? valueString + ' '.repeat(paddingNeeded) : ' '.repeat(paddingNeeded) + valueString;
                        }
                    }
                    if (format.startsWith('CENTER(')) {
                        let m = /CENTER\((?<width>\d+)\)/.exec(format),
                            width = parseInt(m.groups.width),
                            left = Math.floor((width - len) / 2),
                            right = Math.max(0, width - len - left);

                        if (left > 0) {
                            valueString = ' '.repeat(left) + valueString + ' '.repeat(right);
                        }
                    }
                }

                result += valueString;
                pos = m.index + matchLen;
            }
            m = re.exec(s);
        }
    }
    if (pos < s.length)
        result += s.slice(pos);
    return result;
};

String.prototype.splitLines = function () {
    let str = this.slice(0);
    return str.split(/\r?\n/);
};

if (typeof String.prototype.padLeft !== 'function') {
    String.prototype.padLeft = function (len, paddingChar=' ') {
        let s = this.slice(0),
            n = parseInt(len);

        if (isNaN(n))
            return s;
        else {
            let paddingNeeded = n - s.length;
            if (paddingNeeded > 0) {
                if (paddingChar.length > 1)
                    return paddingChar.repeat(paddingNeeded).slice(0, paddingNeeded) + s;
                else
                    return paddingChar.repeat(paddingNeeded) + s;
            }
            else
                return s;
        }
    };
}
if (typeof String.prototype.padRight !== 'function') {
    String.prototype.padRight = function (len, paddingChar = ' ') {
        let s = this.slice(0),
            n = parseInt(len);

        if (isNaN(n))
            return s;
        else {
            let paddingNeeded = n - s.length;
            if (paddingNeeded > 0) {
                if (paddingChar.length > 1)
                    return s + paddingChar.repeat(paddingNeeded).slice(0, paddingNeeded);
                else
                    return s + paddingChar.repeat(paddingNeeded);
            }
            else
                return s;
        }
    };
}

String.prototype.stripColors = function () {
    let str = this.slice(0);
    str = str.replace(/(\%\^[A-Z]+\%\^)/g, '');
    return str;
};
String.prototype.ucfirst = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

Object.seal(String.prototype);
