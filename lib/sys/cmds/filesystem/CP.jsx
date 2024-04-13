/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from 'Base';
import ShellCommand from LIB_SHELLCMD;

const
    CP_OPT_FORCE = 1,
    CP_OPT_INTERACTIVE = 1 << 1,
    CP_OPT_NONCLOBBER = 1 << 2,
    CP_OPT_RECURSIVE = 1 << 3,
    CP_OPT_UPDATE = 1 << 4,
    CP_OPT_VERBOSE = 1 << 5,
    CP_OPT_SINGLEFS = 1 << 6,
    CP_OPT_RMDEST = 1 << 7,
    CP_OPT_RMSLASH = 1 << 8,
    CP_OPT_BACKUP = 1 << 9,
    CP_OPT_NOTARGETDIR = 1 << 10;

export default singleton class CopyCommand extends ShellCommand {
    protected override create() {
        super.create();
        this.verbs = ['cp', 'copy'];
        this.command
            .setVerb(...this.verbs)
            .setBitflagBucketName('copyFlags')
            .setDescription('Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY')
            .addOption('--b', 'Like --backup but does not accept an argument', { name: 'backupSimple', sets: CP_OPT_BACKUP })
            .addOption('--backup <CONTROL:simple|none|off|numbered|t|existing|nil|simple>', 'Make a backup of each existing destination file', { name: 'backupControl', sets: CP_OPT_BACKUP })
            .addOption('-f, --force', 'If  an existing destination file cannot be opened, remove it and try again (this option is ignored when the -n option is also used)',
                { name: 'force', sets: CP_OPT_FORCE, clears: CP_OPT_INTERACTIVE | CP_OPT_NONCLOBBER })
            .addOption('-i, --interactive', 'Prompt before overwrite (overrides a previous -n option)',
                { name: 'interactive', sets: CP_OPT_INTERACTIVE, clears: CP_OPT_FORCE | CP_OPT_NONCLOBBER })
            .addOption('--one-file-system, -x', 'Stay on this file system', { name: 'sfs', sets: CP_OPT_SINGLEFS })
            .addOption('-r, --recursive', 'Copy directories recursively', { name: 'recursive', sets: CP_OPT_RECURSIVE })
            .addOption('--remove-destination', 'Remove each existing destination file before attempting to open it (contrast with --force)', { name: 'removeDestination', sets: CP_OPT_RMDEST })
            .addOption('--strip-trailing-slashes', 'Remove any trailing slashes from each SOURCE argument', { name: 'stripSlashes', sets: CP_OPT_RMSLASH })
            .addOption('-S, --suffix <suffix>', 'Override the usual backup suffix', { name: 'backupSuffix' })
            .addOption('-t, --target-directory <targetDirectory>', 'Copy all SOURCE arguments into DIRECTORY', { name: 'targetDirectory', copyTo: 'DEST=targetDirectory' })
            .addOption('-T, --no-target-directory', 'Copy all SOURCE arguments into DIRECTORY', { name: 'noTargetDirectory', sets: CP_OPT_NOTARGETDIR })
            .addOption('-u, --update', 'Copy only when the SOURCE fbile is newer than the destination file or when the destination file is missing', { name: 'update ', sets: CP_OPT_UPDATE })
            .addOption('-v, --verbose', 'Explain what is being done', { name: 'verbose ', sets: CP_OPT_VERBOSE })
            .addArgument('<SOURCE...> <DEST>')
            .complete();
    }

    override async cmd(text, cmdline) {
        let options = await this.command.parse(cmdline);

        if (typeof options !== 'object')
            return options;

        options.cwd = thisPlayer().workingDirectory;

        if (options.hasFlag(CP_OPT_NOTARGETDIR))
            return await this.copyNoTargetDir(cmdline.verb, options);

        return true;
    }

    private async copyNoTargetDir(verb, options) {
        if (options.SOURCE.length > 1)
            return `${verb}: Extra operand '${options.source[1]}'`;
        let source = await efuns.fs.getObjectAsync(efuns.resolvePath(options.SOURCE[0], options.cwd)),
            dest = await efuns.fs.getObjectAsync(efuns.resolvePath(options.DEST, options.cwd));

        if (!source.exists)
            return `${verb}: Source file '${options.SOURCE[0]}' does not exist`;
        else if (source.isDirectory && !options.hasFlag(CP_OPT_RECURSIVE))
            return `${verb}: -r not specified; omitting directory '${options.SOURCE[0]}'`;

        if (dest.exists && options.hasFlag(CP_OPT_INTERACTIVE)) {
            if (!await this.promptOverwrite(verb, options.DEST))
                return true;
        }
        await this.performCopy(verb, options, source, options.SOURCE[0], dest, options.DEST);
    }

    private async copyRecursive(verb, options, source, dest) {

    }

    private async getNextBackupName(options, dest, displayDest) {
        let suffix = options.suffix || '~',
            control = options.CONTROL;
    }

    private async performCopy(verb, options, source, sourceDisplay, dest, destDisplay) {
        let backup = '';

        if (options.hasFlag(CP_OPT_UPDATE) && source.mtime <= dest.mtime)) {
            if (options.hasFlag(CP_OPT_VERBOSE)) {
                writeLine(`'${sourceDisplay}' is not newer than '${destDisplay}'; Skipping`);
            }
            return true;
        }

        if (dest.exists) {
            if (options.hasFlag(CP_OPT_INTERACTIVE)) {
                if (!await this.promptOverwrite(verb, options.DEST))
                    return true;
            }
            if (options.hasFlag(CP_OPT_BACKUP)) {
                backup = await this.getNextBackupName(options, dest, destDisplay);
                let suffix = options.suffix || '~';

                switch (options.CONTROL) {
                    case 'never':
                    case 'simple':
                        backup = dest + suffix;
                        break;

                    case 'none':
                    case 'off':
                        break;

                    case 'numbered':
                        break;
                }

                let backupFilename = dest.directory + `/${backup}`;
            }
        }
        if (options.hasFlag(CP_OPT_VERBOSE)) {
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
