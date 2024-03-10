/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: March 9, 2024
 */
import { LIB_COMMAND } from 'Base';
import { COMMAND_D } from 'Daemon';
import Command from LIB_COMMAND;

export default singleton class Rehash extends Command {
    async override cmd(str, cmdline) {
        if (!str)
            return 'Usage: rehash [dir] [dir2, dir3, ...]';

        let cwd = thisPlayer().workingDirectory,
            directoriesToRehash = [];

        for (let i = 0; i < cmdline.args.length; i++) {
            let resolved = efuns.resolvePath(cmdline.args[i], cwd),
                dir = await efuns.fs.getObjectAsync(resolved);

            if (dir.isDirectory) {
                directoriesToRehash.push(dir.fullPath);
            }
            else {
                errorLine(`Rehash: ${resolved}: is not a directory`);
            }
        }

        if (directoriesToRehash.length === 0)
            return 'Rehash: Nothing to do';

        if (directoriesToRehash.length === 0)
            return 'Rehash: Nothing to do';

        for (const dir of directoriesToRehash) {
            try {
                write(`Rehashing ${dir}... `);
                await COMMAND_D->hashCommandDirectory(dir);
                writeLine("[Ok]");
            }
            catch (err) {
                writeLine(`[${err}]`);
            }
        }


        return true;
    }
}