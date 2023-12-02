/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

const
    RmdirRecursive = 1 << 0,
    RmdirVerbose = 1 << 1,
    RmdirParents = 1 << 2;

export default singleton class RmDir extends Command {
    override async cmd(args, cmdline) {
        let player = thisPlayer,
            dirList = [],
            flags = 0;

        for (let i = 0; i < args.length; i++) {
            let opt = args[i];

            if (opt.startsWith('-')) {
                let opts = opt.charAt(1) === '-' ? [opt] : opt.slice(1).split('');

                for (var j = 0, max = opts.length; j < max; j++) {
                    switch (opts[j]) {
                        case 'p': case '--parents':
                            flags |= RmdirParents;
                            break;

                        case 'r': case '--recursive':
                            flags |= RmdirRecursive;
                            break;

                        case 'v': case '--verbose':
                            flags |= RmdirVerbose;
                            break;

                        default:
                            return `Rmdir: Unknown option: ${opts[j]}`;
                    }
                }
            }
            else {
                if ((flags & RmdirParents) > 0) {
                    let parts = opt.split('/');
                    while (parts.length) {
                        dirList.push(efuns.resolvePath(parts.join('/'), player.workingDirectory));
                        parts.pop();
                    }
                }
                else
                    dirList.push(efuns.resolvePath(opt, player.workingDirectory));
            }
        }
        if (dirList.length === 0)
            return 'Rmdir: Missing parameter';
        return await this.removeDirectories(dirList, flags);
    }

    /**
     * Does the work of actually deleting the directories.
     * @param {string[]} dirList
     * @param {number} options
     */
    async removeDirectories(dirList, options) {
        let dir = dirList.shift();

        for (let i = 0; i < dirList.length; i++) {
            if (!await efuns.fs.isDirectoryAsync(dirList[i]))
                return `rmdir: '${dirList[i]}' is not a directory`;

            let success = - await efuns.fs.deleteDirectoryAsync(dirList[i], options);

            if (options & RmdirVerbose)
                writeLine('Rmdir: ' + (success ? `Removed ${dir}` : `Failed: ${error.message}`));
        }
        return true;
    }
}
