/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from 'Base';
import ShellCommand from LIB_SHELLCMD;

const
    CopyFlags = efuns.fs.CopyFlags;

export default singleton class CopyCommand extends ShellCommand {
    protected override create() {
        super.create();
        this.verbs = ['cp', 'copy'];
        this.command
            .setVerb(...this.verbs)
            .setBitflagBucketName('copyFlags')
            .setDescription('Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY')
            .addOption('--b', 'Like --backup but does not accept an argument', { name: 'backupSimple', sets: CopyFlags.Backup })
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
            .addOption('-u, --update', 'Copy only when the SOURCE fbile is newer than the destination file or when the destination file is missing', { name: 'update ', sets: CopyFlags.Update })
            .addOption('-v, --verbose', 'Explain what is being done', { name: 'verbose ', sets: CopyFlags.Verbose })
            .addArgument('<SOURCE...> <DEST>')
            .complete();
    }

    override async cmd(text, cmdline) {
        let options = await this.command.parse(cmdline),
            apiSettings = {
                destination: false,
                flags: options.copyFlags,
                onCopyComplete: false,
                onCopyError: (verb, error) => errorLine(`${verb}: ${error}`),
                onCopyInformation: (verb, info) => writeLine(`${verb}: ${info}`),
                onOverwritePrompt: false,
                source: false,
                verb: cmdline.verb,
                workingDirectory: thisPlayer().workingDirectory
            };

        if (typeof options !== 'object')
            return options;

        options.cwd = thisPlayer().workingDirectory;

        if (options.hasFlag(CopyFlags.NoTargetDir))
            return await this.copyNoTargetDir(cmdline.verb, options);
        else {
            if (options.hasFlag(CopyFlags.Interactive)) {
                apiSettings.onOverwritePrompt = async (verb, filename) => {
                    let r = await promptAsync('yes-no', `${verb}: Overwrite '${filename}'? `);
                    return r.toLowerCase() === 'yes';
                };
            }
            if (options.hasFlag(CopyFlags.Verbose)) {
                apiSettings.onCopyComplete = async (verb, source, dest, backup) => {
                    if (backup)
                        writeLine(`${verb}: '${source}' -> '${dest}' (backup: '${backup}')`);
                    else
                        writeLine(`${verb}: '${source}' -> '${dest}'`);
                };
            }
            for (const source of options.SOURCE) {
                await efuns.fs.copyAsync(source, options.DEST, apiSettings);
            }
        }

        return true;
    }

    private async copyNoTargetDir(verb, options) {
        if (options.SOURCE.length > 1)
            return `${verb}: Extra operand '${options.source[1]}'`;
        let source = await efuns.fs.getObjectAsync(efuns.resolvePath(options.SOURCE[0], options.cwd)),
            dest = await efuns.fs.getObjectAsync(efuns.resolvePath(options.DEST, options.cwd));

        if (!source.exists)
            return `${verb}: Source file '${options.SOURCE[0]}' does not exist`;
        else if (source.isDirectory && !options.hasFlag(CopyFlags.Recursive))
            return `${verb}: -r not specified; omitting directory '${options.SOURCE[0]}'`;

        if (dest.exists && options.hasFlag(CopyFlags.Interactive)) {
            if (!await this.promptOverwrite(verb, options.DEST))
                return true;
        }
        await this.performCopy(verb, options, source, options.SOURCE[0], dest, options.DEST);
    }

    private async copyRecursive(verb, options, source, dest) {

    }

    /**
     * Determine the backup filename to use
     * 
     * @param {any} options
     * @param {FileSystemObject} dest
     * @param {string} displayDest
     * @returns {[string,string]} Returns the full path and displayPath of the new backup file, or false,false
     */
    private async getNextBackupName(options, dest, displayDest) {
        let suffix = options.suffix || '~',
            existing;

        switch (options.CONTROL) {
            case 'never':
            case 'simple':
                return [dest.fullPath, displayDest].map(s => s + suffix);

            case 'none':
            case 'off':
                return [false,false];

            case 'numbered':
            case 't':
                existing = await efuns.fs.queryFileSystemAsync(`${dest.fullPath}.~*~`);
                if (existing && existing.length > 0) {
                    let maxId = existing
                        .map(fo => fo.extension.slice(1))
                        .filter(ext => !!ext)
                        .map(ext => parseInt(ext.split('~')[1]))
                        .filter(n => !isNaN(n) && n > 0)
                        .sort()
                        .pop();
                    return [dest.fullPath, displayDest].map(s => `${s}.~${(maxId + 1)}~`);
                }
                else
                    return [dest.fullPath, displayDest].map(s => `${s}.~1~`);

            case 'existing':
                existing = await efuns.fs.queryFileSystemAsync(`${dest.fullPath}.~*`);
                if (existing && existing.length > 0) {
                    let maxId = existing
                        .map(fo => fo.extension.slice(1))
                        .filter(ext => !!ext)
                        .map(ext => parseInt(ext.split('~')[1]))
                        .filter(n => !isNaN(n) && n > 0)
                        .sort()
                        .pop();
                    if (maxId > 0) 
                        return [dest.fullPath, displayDest].map(s => `${s}.~${(maxId + 1)}~`);
                }
                return [dest.fullPath, displayDest].map(s => s + suffix);
        }
    }

    /**
     * Copy a single file
     * 
     * @param {string} verb The command verb used to invoke this action
     * @param {any} options
     * @param {FileSystemObject} source The source file
     * @param {string} sourceDisplay The display filename to use as for verbose output
     * @param {FileSystemObject} dest The destination location
     * @param {string} destDisplay The display filename to use as for verbose output
     * @returns {boolean} True on success
     */
    private async performCopy(verb, options, source, sourceDisplay, dest, destDisplay) {
        let backup = '';

        if (options.hasFlag(CopyFlags.Update) && source.mtime <= dest.mtime) {
            if (options.hasFlag(CopyFlags.Verbose)) {
                writeLine(`'${sourceDisplay}' is not newer than '${destDisplay}'; Skipping`);
            }
            return true;
        }

        if (dest.exists) {
            if (options.hasFlag(CopyFlags.Interactive)) {
                if (!await this.promptOverwrite(verb, options.DEST))
                    return true;
            }
            if (options.hasFlag(CopyFlags.Backup)) {
                let [fullPath, displayPath] = await this.getNextBackupName(options, dest, destDisplay),
                    backupTarget = fullPath && await efuns.fs.getObjectAsync(fullPath);

                if (displayPath) {
                    backup = displayPath;
                }
            }
        }
        if (options.hasFlag(CopyFlags.Verbose)) {
            if (backup)
                writeLine(`'${options.SOURCE[0]}' -> '${options.DEST}' (backup: '${backup}')`);
            else
                writeLine(`'${options.SOURCE[0]}' -> '${options.DEST}'`);
        }
    }

    private async promptOverwrite(verb, file) {
        let r = await promptAsync('yes-no', `${verb}: Overwrite '${file}'? `);
        return r === 'yes';
    }
}
