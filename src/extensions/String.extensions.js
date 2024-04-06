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

String.prototype.fs = function (...args) {
    let s = this.slice(0);

    for (let i = 0; i < args.length; i++) {
        let re =  /\{(?<index>[\d]+)(?<format>[\:\,][^\}]+){0,1}\}/g,
            m = re.exec(s);

        while (m !== null) {
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

                s = s.slice(0, m.index) + valueString + s.slice(m.index + matchLen);
            }
            m = re.exec(s);
        }
    }
    return s;
};

String.prototype.splitLines = function () {
    let str = this.slice(0);
    return str.split(/\r?\n/);
};
String.prototype.stripColors = function () {
    let str = this.slice(0);
    str = str.replace(/(\%\^[A-Z]+\%\^)/g, '');
    return str;
};
String.prototype.ucfirst = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

Object.seal(String.prototype);
