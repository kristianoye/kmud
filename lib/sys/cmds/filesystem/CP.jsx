/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * Updated: April 20, 2024
 */
import { LIB_SHELLCMD } from 'Base';
import ShellCommand from LIB_SHELLCMD;

const
    CopyFlags = efuns.fs.CopyFlags;

export default singleton class CopyCommand extends ShellCommand {
    /**
     * Initialize the command
     */
    protected override create() {
        super.create();
        this.verbs = ['cp', 'copy', 'copy-item'];
        this.command
            .setVerb(...this.verbs)
            .setBitflagBucketName('copyFlags')
            .setDescription('Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY')
            .addOption('-b', 'Like --backup but does not accept an argument', { name: 'backupSimple', sets: CopyFlags.Backup })
            .addOption('--backup <CONTROL:simple|none|off|numbered|t|existing|nil|simple>', 'Make a backup of each existing destination file', { name: 'backupControl', sets: CopyFlags.Backup })
            .addOption('-f, --force', 'If  an existing destination file cannot be opened, remove it and try again (this option is ignored when the -n option is also used)',
                { name: 'force', sets: CopyFlags.Force, clears: CopyFlags.Interactive | CopyFlags.NonClobber })
            .addOption('-i, --interactive', 'Prompt before overwrite (overrides a previous -n option)',
                { name: 'interactive', sets: CopyFlags.Interactive, clears: CopyFlags.Force | CopyFlags.NonClobber })
            .addOption('--one-file-system, -x', 'Stay on this file system', { name: 'sfs', sets: CopyFlags.SingleFilesystem })
            .addOption('-r, --recursive', 'Copy directories recursively', { name: 'recursive', sets: CopyFlags.Recursive })
            .addOption('--remove-destination', 'Remove each existing destination file before attempting to open it (contrast with --force)', { name: 'removeDestination', sets: CopyFlags.RemoveDestination })
            .addOption('--strip-trailing-slashes', 'Remove any trailing slashes from each SOURCE argument', { name: 'stripSlashes', sets: CopyFlags.RemoveSlash })
            .addOption('-S, --suffix <suffix>', 'Override the usual backup suffix', { name: 'backupSuffix' })
            .addOption('-t, --target-directory <targetDirectory>', 'Copy all SOURCE arguments into DIRECTORY', { name: 'targetDirectory', copyTo: 'DEST=targetDirectory' })
            .addOption('-T, --no-target-directory', 'Copy all SOURCE arguments into DIRECTORY', { name: 'noTargetDirectory', sets: CopyFlags.NoTargetDir })
            .addOption('-u, --update', 'Copy only when the SOURCE fbile is newer than the destination file or when the destination file is missing', { name: 'update', sets: CopyFlags.Update })
            .addOption('-v, --verbose', 'Explain what is being done', { name: 'verbose ', sets: CopyFlags.Verbose })
            .addOption('--no-clone', 'Do not use the OS FIClone option even if available', { name: 'noclone', sets: CopyFlags.NoFileClone })
            .addArgument('<SOURCE...> <DEST>')
            .addFiller('SOURCE', () => {
                if (objin) {
                    let results = [];
                    for (const ob of objin) {
                        let filename = typeof ob === 'string' ? ob : ob.fullPath;
                        if (results.findIndex(f => f === filename) === -1)
                            results.push(filename);
                    }
                    return results;
                }
                if (stdin)
                    return stdin.readLines();
                return undefined;
            })
            .complete();
    }

    /**
     * Execute a copy request
     * @param {string} text
     * @param {{ verb: string, args: string[] }} cmdline
     * @returns {Promise<string | number | true>}
     */
    override async cmd(text, cmdline) {
        let options = await this.command.parse(cmdline),
            apiSettings;

        if (!text && !Array.isArray(options.SOURCE))
            return `Usage: ${cmdline.verb} [OPTIONS...] [SOURCE...] [DESTINATION]`;

        if (typeof options !== 'object')
            return options;

        apiSettings = {
            backupControl: options.CONTROL || 'simple',
            backupSuffix: options.suffix || '~',
            destination: false,
            flags: options.copyFlags,
            onCopyComplete: async (verb, source, dest, backup) => {
                if (backup)
                    writeLine(`${verb}: '${source}' -> '${dest}' (backup: '${backup}')`);
                else
                    writeLine(`${verb}: '${source}' -> '${dest}'`);
            },
            onCopyError: (verb, error) => errorLine(`${verb}: ${error}`),
            onCopyInformation: (verb, info) => writeLine(`${verb}: ${info}`),
            onOverwritePrompt: async (verb, filename) => {
                let r = await promptAsync('yes-no', `${verb}: Overwrite '${filename}'? `);
                return r.toLowerCase() === 'yes';
            },
            source: false,
            verb: cmdline.verb,
            workingDirectory: thisPlayer().workingDirectory
        };

        for (const source of options.SOURCE) {
            await efuns.fs.copyAsync(source, options.DEST, apiSettings);
        }

        return true;
    }
}
