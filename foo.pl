const fs = require('fs');
console.log(fs.realpathSync(process.argv[2]));
