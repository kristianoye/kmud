/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    { FTYPE } = require('Flags');

var _files = {};

class FileIndex extends MUDObject {
    /**
        * Construct the indexer.
        * @param {MUDCreationContext} ctx
        */
    constructor(ctx) {
        super(ctx);
    }

    create() {
        this.indexFiles('/');
    }

    addDirectory(dir) {
        if (!_files[dir]) {
            _files[dir] = [];
        }
    }

    findFiles(opts) {
        let result = [];

        if (!opts.dir.endsWith('/'))
            opts.dir = opts.dir + '/';

        if (typeof _files[opts.dir] === 'undefined')
            return `${opts.dir}: No such directory`;

        if (typeof opts.regex === 'string' && opts.regex.length > 0) {
            opts.regex = new RegExp(opts.regex);
        }

        let bc = opts.dir.countInstances('/');
        Object.keys(_files).filter(d => d.startsWith(opts.dir)).forEach(d => {
            let tc = d.countInstances('/'), depth = tc - bc;
            if (depth > opts.maxDepth)
                return;
            if (opts.name) {
                var files = _files[d].filter(fi => fi[0] === opts.name).map(fi => d + fi[0]);
                if (files.length > 0) result.push(...files);
            }
            else if (opts.regex) {
                let files = _files[d].map(fi => d + fi[0]).filter(fn => fn.match(opts.regex));
                if (files.length > 0) result.push(...files);
            }
            else {
                let files = _files[d].map(fi => d + fi[0]);
                if (files.length > 0) result.push(...files);
                result.pushDistinct(d);
            }
        });
        return result.sort();
    }

    indexFiles(path) {
        efuns.readDirectory(path, FTYPE.Directory, (files, err) => {
            if (!err) {
                _files[path] = files;
                files.filter(a => a[1] === -2).forEach(f => {
                    var subdir = path + f[0] + '/';
                    this.indexFiles(subdir);
                });
            }
        });
    }

    removeDirectory(dir) {
        delete _files[dir];
    }
}

module.exports = new FileIndex();
