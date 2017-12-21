const
    path = require('path');

class ConfigUtil {
    assertType(val, key, ...typeList) {
        for (let i = 0, myType = typeof val; i < typeList.length; i++) {
            if (val === typeList[i]) return true;
        }
        throw new Error(`Setting for ${key} has invalid type; Expected ${typeList.join('|')} but got ${myType}`);
    }

    resolvePath(p1, ext) {
        var p2 = path.join(__dirname, '..', p1);
        return p2.endsWith(ext || '.js') ? p2 : p2 + (ext || '.js');
    }
}

function assertType(val, key, ...typeList) {
    for (let i = 0, myType = typeof val; i < typeList.length; i++) {
        if (val === typeList[i]) return true;
    }
    throw new Error(`Setting for ${key} has invalid type; Expected ${typeList.join('|')} but got ${myType}`);
}

function resolvePath(p1, ext) {
    var p2 = path.join(__dirname, '..', p1);
    return p2.endsWith(ext || '.js') ? p2 : p2 + (ext || '.js');
}

module.exports = {
    assertType, resolvePath,
    ConfigUtil: new ConfigUtil()
};
