const
    path = require('path');

function resolvePath(p1, ext) {
    var p2 = path.join(__dirname, '..', p1);
    return p2.endsWith(ext || '.js') ? p2 : p2 + (ext || '.js');
}

module.exports = {
    resolvePath: resolvePath
};
