/*
 *
 */
const
    { ExecutionContext, CallOrigin, ExecutionFrame } = require('../ExecutionContext'),
    { FileSystemObject, ObjectNotFound, VirtualObjectFile, FileWrapperObject } = require('./FileSystemObject'),
    FileSystemRequest = require('./FileSystemRequest'),
    FileSystemQuery = require('./FileSystemQuery'),
    Cache = require('../Cache'),
    crypto = require('crypto'),
    yaml = require('js-yaml'),
    path = require('path'),
    events = require('events'),
    { FileSystemQueryFlags, CopyFlags, DeleteFlags } = require('./FileSystemFlags'),
    { FileCopyOperation, FileDeleteOperation } = require('./FileOperations');


/**
 * The file manager object receives external requests, creates internal requests,
 * and dispatches those requests to the file and security systems.  It then sends
 * the results back to the user (usually an efuns proxy instance).
 */
class FileManager extends events.EventEmitter {
    /**
     * Construct the file manager
     */
    constructor(fsconfig) {
        super();

        let options = fsconfig.fileManagerOptions || {};
        /** 
         * Contains a cache of previously accessed directories 
         */
        this.cache = new Cache({
            capacity: options.fileCacheSize || 10000,
            key: 'path'
        });

        /** @type {Object.<string,MUDFileSystem>} */
        this.fileSystems = {};

        /** @type {Object.<string,MUDFileSystem>} */
        this.fileSystemsById = {};

        /** @type {string} */
        this.mudlibRoot = driver.config.mudlib.baseDirectory;

        /** @type {string} */
        this.mudlibAbsolute = path.resolve(__dirname, this.mudlibRoot);

        let securityManager = false;

        if (typeof fsconfig.securityManager === 'string') {
            let securityManagerType = fsconfig.securityManager.startsWith('.') ?
                require(path.join(__dirname, '..', fsconfig.securityManager)) : require(fsconfig.securityManager);

            securityManager = new securityManagerType(this, fsconfig.securityManagerOptions);
        }
        else if (typeof fsconfig.securityManager === 'object') {
            /*** @type {{ managerModule: string, managerTypeName?: string }}*/
            let options = fsconfig.securityManager;
            //  Allow for 3rd party managers 
            let moduleImport = require(options.managerModule.startsWith('.') ?
                path.join(__dirname, '..', options.managerModule) : options.managerModule);

            if (driver.efuns.isClass(ExecutionContext.getCurrentExecution(), moduleImport)) {
                securityManager = new moduleImport(this, fsconfig.securityManagerOptions);
            }
            else if (!options.managerTypeName) {
                throw new Error('Config for securityManager is missing required parameter managerTypeName');
            }
            else if (typeof moduleImport === 'object' && driver.efuns.isClass(ExecutionContext.getCurrentExecution(), moduleImport[options.managerTypeName])) {
                let managerType = moduleImport[options.managerTypeName];
                securityManager = new managerType(this, fsconfig.securityManagerOptions);
            }
        }
        this.securityManager = securityManager;
    }

    /**
     * Not needed by default file manager.
     */
    assertValid() {
        if (!this.securityManager)
            throw new Error('Missing required security manager');
        return this;
    }

    /**
     * Ensure the filesystems are all okay.
     * @param {ExecutionContext} ecc The callstack
     * @param {any} fsconfig
     * @returns
     */
    async bootstrap(ecc, fsconfig) {
        const frame = ecc.push({ file: __filename, method: 'bootstrap', isAsync: true, className: FileManager });
        try {
            await fsconfig.eachFileSystem(async (config, index) => await this.createFileSystem(config, index));
            await this.ensureMountPointsExist(frame.context);
            return this;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Bootstrap the security manager
     * @param {object} masterObject
     * @returns
     */
    async bootstrapSecurity(masterObject) {
        await this.securityManager.bootstrap(masterObject);
        return this.securityManager;
    }

    /**
     * Clone an object into existance.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} expr The module to clone
     * @param {any} args Constructor args for clone
     * @returns {MUDWrapper} The wrapped instance.
     */
    async cloneObjectAsync(ecc, expr, args = []) {
        let frame = ecc.push({ file: __filename, method: 'cloneObjectAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            return await this.loadObjectAsync(frame.branch(), expr, args, 2);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Convert a path expression if needed.
     * @param {string} expr The path expression to convert.
     */
    static convertPath(expr) {
        if (path.sep === path.posix.sep)
            return expr;

        // handle the edge-case of Window's long file names
        // See: https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file#short-vs-long-names
        expr = expr.replace(/^\\\\\?\\/, "");

        // convert the separators, valid since both \ and / can't be in a windows filename
        expr = expr.replace(/\\/g, '\/');

        // compress any // or /// to be just /, which is a safe oper under POSIX
        // and prevents accidental errors caused by manually doing path1+path2
        expr = expr.replace(/\/\/+/g, '\/');

        return expr;
    }

    /**
     * Copy file objects
     * @param {FileCopyOperation} opts
     */
    async copyAsync(opts, isSystemRequest = false) {
        let options = opts instanceof FileCopyOperation ? opts : new FileCopyOperation(opts),
            source = await this.getObjectAsync(options.resolvedSource, 0, isSystemRequest === true),
            dest = await this.getObjectAsync(options.resolvedDestination, 0, isSystemRequest === true);

        if (!source.exists())
            throw new Error(`${options.verb}: Source '${options.source}' does not exist`);
        else if (source.isDirectory() && !options.hasFlag(CopyFlags.Recursive))
            throw new Error(`${options.verb}: Recursive flag not specified; omitting directory '${options.source}'`);

        if (source.isDirectory()) {
            if (dest.isFile()) {
                throw new Error(`${options.verb}: Cannot overwrite non-directory '${options.destination} with directory '${options.source}'`);
            }
            else if (!dest.exists()) {
                await dest.createDirectoryAsync(true);
                if (options.hasFlag(CopyFlags.Verbose))
                    options.onCopyComplete(options.verb, options.source, options.destination);
            }
            let sourceFiles = await source.readDirectoryAsync(),
                targetPath = path.posix.join(options.destination, source.name),
                targetPathFull = path.posix.join(options.resolvedDestination, source.name),
                targetDir = await this.getObjectAsync(targetPathFull);

            if (!targetDir.exists())
                await targetDir.createDirectoryAsync(true);

            for (const file of sourceFiles) {
                try {
                    let sourcePath = path.posix.join(options.source, file.name);

                    if (file.isDirectory()) {
                        if (file.fileSystemId !== source.fileSystemId && options.hasFlag(CopyFlags.SingleFilesystem)) {
                            options.onCopyInformation(options.verb, `Omitting directory '${sourcePath}' since it is on a different filesystem`);
                        }
                        let child = options.createChild({
                            source: sourcePath,
                            destination: targetPath
                        });
                        await this.copyAsync(child, isSystemRequest === true);
                    }
                    else if (file.isFile()) {
                        let destPath = path.posix.join(targetPath, file.name);
                        let child = options.createChild({
                            source: sourcePath,
                            destination: destPath
                        });
                        await this.copyAsync(child, isSystemRequest === true);
                    }
                }
                catch (err) {
                    if (options.onCopyError) {
                        options.onCopyError(options.verb, err);
                    }
                    else
                        throw err;
                }
            }
        }
        else if (dest.isDirectory()) {
            let destFullPath = path.posix.join(dest.fullPath, source.name),
                destPath = path.posix.join(options.destination, source.name),
                fo = await this.getObjectAsync(destFullPath, 0, isSystemRequest === true),
                backup = '';

            if (fo.exists()) {
                if (options.hasFlag(CopyFlags.RemoveDestination) && fo.exists()) {
                    await fo.deleteFileAsync();
                }
                if (options.hasFlag(CopyFlags.NonClobber)) {
                    options.onCopyInformation(options.verb, `NoClobber: Omitting file '${options.source}' since it already exists as '${options.destination}'`);
                    return true;
                }
                if (options.hasFlag(CopyFlags.Update) && fo.mtime >= source.mtime) {
                    options.onCopyInformation(options.verb, `Omitting file '${options.source}' since it is not newer than '${destPath}'`);
                    return true;
                }
                if (options.hasFlag(CopyFlags.Interactive)) {
                    if (!await options.onOverwritePrompt(options.verb, destPath))
                        return true;
                }
                if (options.hasFlag(CopyFlags.Backup)) {
                    let backupFile = await driver.efuns.fs.createBackupAsync(dest, options.backupControl, options.backupSuffix),
                        backupName = backupFile && backupFile.name,
                        backupExtension = backupName && backupName.slice(dest.name.length);
                    if (backupName) {
                        backup = options.destination + backupExtension;
                    }
                }
            }
            if (await source.copyAsync(fo, options.flags)) {
                if (options.hasFlag(CopyFlags.Verbose))
                    options.onCopyComplete(options.verb, options.source, destPath, backup);
                driver.efuns.addOutputObject(dest);
                return true;
            }
            return false;
        }
        else if (dest.isFile() || !dest.exists()) {
            let destPath = options.destination,
                backup = '';

            if (dest.exists()) {
                if (options.hasFlag(CopyFlags.RemoveDestination) && dest.exists()) {
                    await dest.deleteAsync();
                }
                if (options.hasFlag(CopyFlags.NonClobber)) {
                    options.onCopyInformation(options.verb, `NoClobber: Omitting file '${options.source}' since it already exists as '${options.destination}'`);
                    return true;
                }
                if (options.hasFlag(CopyFlags.Update) && dest.mtime >= source.mtime) {
                    options.onCopyInformation(options.verb, `Omitting file '${options.source}' since it is not newer than '${options.destination}'`);
                    return true;
                }
                if (options.hasFlag(CopyFlags.Interactive)) {
                    if (!await options.onOverwritePrompt(options.verb, options.destination))
                        return true;
                }
                if (options.hasFlag(CopyFlags.Backup)) {
                    let backupFile = await driver.efuns.fs.createBackupAsync(dest, options.backupControl, options.backupSuffix),
                        backupName = backupFile && backupFile.name,
                        backupExtension = backupName && backupName.slice(dest.name.length);

                    if (backupName) {
                        backup = options.destination + backupExtension;
                    }
                }
            }
            else if (options.hasFlag(CopyFlags.NoTargetDir)) {
                if (await source.copyAsync(dest, options.flags)) {
                    if (options.hasFlag(CopyFlags.Verbose))
                        options.onCopyComplete(options.verb, options.source, destPath, backup);
                    driver.efuns.addOutputObject(dest);
                    return true;
                }
            }
            if (await source.copyAsync(dest, options.flags)) {
                if (options.hasFlag(CopyFlags.Verbose))
                    options.onCopyComplete(options.verb, options.source, destPath, backup);
                driver.efuns.addOutputObject(dest);
                return true;
            }
            return false;
        }
    }

    /**
     * Create a directory asynchronously
     * @param {string} expr The directory to create
     * @param {number} flags Additional flags to control the operation
     */
    async createDirectoryAsync(expr, flags = 0) {
        let request = this.createFileRequest('CreateDirectory', expr, flags);
        return request.valid('validReadDirectory') && await request.fileSystem.createDirectoryAsync(request);
    }

    /**
     * Query the file system
     * @param {any} options
     * @param {any} isSystemRequest
     */
    createFileQuery(options = {}, isSystemRequest = false) {
        let parts = FileSystemQuery.getParts(options.expression),
            fileSystem = this.getFileSystemByMountPoint('/');
        let /** @type {string[]} */ relParts = [],
            /** @type {string[]} */ absPath = [],
            isGlobstar = false;

        // /foo/**/*.js
        for (let i = 0, max = parts.length; i < max; i++) {
            let dir = '/' + parts.slice(0, i + 1).join('/'),
                thisPart = parts[i],
                isLastPart = i + 1 === max;

            //  globstar expression
            if (thisPart === '**') {
                options.expression = parts.slice(i + 1).join('/');
                isGlobstar = true;
                break;
            }
            else if (dir in this.fileSystems) {
                relParts = [];
                fileSystem = this.fileSystems[dir];
            }
            else if (FileSystemQuery.containsWildcard(thisPart)) {
                options.expression = thisPart;
                break;
            }
            else {
                relParts.push(thisPart);
                absPath.push(thisPart);
            }
        }
        return new FileSystemQuery(Object.assign(options, {
            fileManager: this,
            fileSystem: fileSystem,
            isGlobstar: isGlobstar,
            isSystemRequest: isSystemRequest === true,
            relativePath: relParts.join('/'),
            absolutePath: '/' + absPath.join('/')
        }));
    }

    /**
     * Create a request that describes the current operation.
     * 
     * @param {string} op The name of the file operation
     * @param {string} expr THe filename expression being operated on
     * @param {string|number} flags Any numeric flags associated with the operation
     * @param {boolean} [isSystemRequest] THIS SHOULD ONLY BE USED BY DRIVER INTERNALS
     * @returns {FileSystemRequest} The request to be fulfilled.
     */
    createFileRequest(op, expr, flags = 0, isSystemRequest = false) {
        let { fileSystem, relativePath } = this.getFilesystem(expr);

        let result = new FileSystemRequest({
            fs: fileSystem,
            flags: flags,
            op: op || '',
            expr,
            relativePath,
            isSystemRequest
        });
        return result;
    }

    /**
     * Delete files and directories
     * @param {FileDeleteOperation} opts
     * @param {boolean} isSystemRequest
     */
    async deleteAsync(opts, isSystemRequest = false) {
        let options = opts instanceof FileDeleteOperation ? opts : new FileDeleteOperation(opts);

        for (const [displayPath, resolvedPath] of Object.entries(options.filesResolved)) {
            if (options.aborted)
                return false;
            try {
                let target = await this.getObjectAsync(resolvedPath, isSystemRequest === true);

                if (!target.exists()) {
                    if (options.onDeleteFailure)
                        options.onDeleteFailure(options.verb, displayPath, `Cannot remove '${displayPath}': Does not exist`);
                    continue;
                }
                else if (target.isDirectory()) {
                    if (!options.hasFlag(DeleteFlags.Recursive)) {
                        if (options.onDeleteFailure)
                            options.onDeleteFailure(options.verb, displayPath, `Cannot remove '${displayPath}': It is a directory`);
                        continue;
                    }
                    if (options.hasFlag(DeleteFlags.RemoveEmpty) && !await target.isEmpty()) {
                        if (options.onDeleteFailure)
                            options.onDeleteFailure(options.verb, displayPath, `Cannot remove '${displayPath}': Directory is not empty`);
                        continue;
                    }
                    let files = await target.readDirectoryAsync();
                    for (const file of files) {
                        let displayChild = path.posix.join(displayPath, file.name);
                        try {

                            if (file.isDirectory()) {
                                if (options.hasFlag(DeleteFlags.SingleFilesystem) && file.fileSystemId !== target.fileSystemId) {
                                    if (options.hasFlag(DeleteFlags.Verbose)) {
                                        options.onDeleteInformation(options.verb, `Skipping '${displayChild}': Different filesystem`);
                                    }
                                    continue;
                                }
                                if (options.hasFlag(DeleteFlags.Interactive)) {
                                    try {
                                        if (!await options.onConfirmDelete(options.verb, displayChild, true)) {
                                            options.onDeleteInformation(options.verb, `Skipping directory '${displayChild}'`);
                                            continue;
                                        }
                                    }
                                    catch (err) {
                                        options.abort();
                                        return false;
                                    }
                                }
                                let childRequest = options.createChild({ files: [displayChild] });
                                await this.deleteAsync(childRequest, isSystemRequest === true);
                                if (childRequest.aborted)
                                    return false;
                            }
                            else if (file.isFile()) {
                                if (options.hasFlag(DeleteFlags.Interactive)) {
                                    try {
                                        if (!await options.onConfirmDelete(options.verb, displayChild)) {
                                            options.onDeleteInformation(options.verb, `Skipping file '${displayChild}'`);
                                            continue;
                                        }
                                    }
                                    catch (err) {
                                        options.abort();
                                        return false;
                                    }
                                    if (await file.deleteAsync()) {
                                        await options.onDeleteComplete(options.verb, displayChild, file);
                                    }
                                }
                            }
                            else if (!file.exists())
                                continue;
                            else {
                                options.onDeleteFailure(options.verb, `Unable to delete ${displayChild}: Unhandled file type`);
                            }
                        }
                        catch (err) {
                            if (options.onDeleteFailure)
                                options.onDeleteFailure(options.verb, `Unable to delete ${displayChild}: ${err}`);
                            else
                                throw err;
                        }
                    }
                    files = await target.readDirectoryAsync();
                    if (files.length === 0) {
                        if (options.hasFlag(DeleteFlags.Interactive)) {
                            try {
                                if (!await options.onConfirmDelete(options.verb, displayPath, true)) {
                                    options.onDeleteInformation(options.verb, `Skipping directory '${displayPath}'`);
                                    continue;
                                }
                            }
                            catch (err) {
                                options.aborted = true;
                                return false;
                            }
                        }
                        if (!target.deleteAsync()) {
                            options.onDeleteFailure(options.verb, displayPath, `Unable to delete directory '${displayPath}'`);
                        }
                        else {
                            await options.onDeleteComplete(options.verb, displayPath, target);
                        }
                    }
                    else {
                        options.onDeleteFailure(options.verb, displayPath, `Cannot remove '${displayPath}': Directory is not empty`);
                    }
                }
                else if (target.isFile()) {
                    if (options.hasFlag(DeleteFlags.Interactive)) {
                        try {
                            if (!await options.onConfirmDelete(options.verb, displayPath)) {
                                options.onDeleteInformation(options.verb, `Skipping file '${displayPath}'`);
                                continue;
                            }
                        }
                        catch (err) {
                            options.aborted = true;
                            return false;
                        }
                    }
                    if (await target.deleteAsync()) {
                        await options.onDeleteComplete(options.verb, displayPath, target);
                    }
                }
                else
                    throw new Error(`${options.verb}: Unexpected file type: ${displayPath}`);
            }
            catch (err) {
                if (options.onDeleteFailure)
                    options.onDeleteFailure(options.verb, displayPath, err);
                else
                    throw err;
            }
        }
    }

    /**
     * Ensure each, non-root filesystem has a valid mount point on the MUD fs
     */
    async ensureMountPointsExist(ecc) {
        const
            frame = ecc.push({ file: __filename, method: 'ensureMountPointsExist', className: FileManager });

        try {
            await this.eachFileSystemAsync(async (fs, mp) => {
                if (mp !== '/') {
                    const parentPath = path.posix.resolve(mp, '..'),
                        parentDir = await this.getObjectAsync(frame.context, parentPath, undefined, true),
                        mountDir = await this.getObjectAsync(frame.context, mp, undefined, true);

                    if (!parentDir.isDirectory())
                        throw new Error(`Invalid mount point for ${mp}: ${parentDir.fullPath} is not a directory`);
                    if (!mountDir.exists()) {
                        console.log(`\tEnsuring mount point ${mp} exists`);
                        await mountDir.createDirectoryAsync({ createAsNeeded: true });
                    }
                    else if (!mountDir.isDirectory()) {
                        throw new Error(`Invalid mount point for ${mp}; Target is not a directory`);
                    }
                }
            });
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Construct a filesystem query object
     * @param {FileSystemQuery} options
     * @returns {Promise<FileSystemObject[]>}
     */
    queryFileSystemAsync(options = {}, isSystemRequest = false) {
        if (typeof options === 'string') {
            return this.queryFileSystemAsync({ path: options }, isSystemRequest === true);
        }
        return new Promise(async (resolve, reject) => {
            try {
                let parts = FileSystemQuery.getParts(options.path || options.expression),
                    fileSystem = this.getFileSystemByMountPoint('/');
                let query = new FileSystemQuery(Object.assign({}, options, {
                    isSystemRequest: isSystemRequest === true,
                    fileManager: this,
                    fileSystem: fileSystem
                }));
                const prepResult = /** @param {FileSystemObject|FileSystemObject[]} res */ (res, sr) => {
                    if (sr === true)
                        return res;
                    else
                        return this.wrapFileObject(res);
                };

                let /** @type {string[]} */ relParts = [],
                    /** @type {string[]} */ absPath = [];

                for (let i = 0, max = parts.length; i < max; i++) {
                    let dir = '/' + parts.slice(0, i + 1).join('/'),
                        thisPart = parts[i],
                        isLastPart = i + 1 === max;

                    //  globstar expression
                    if (thisPart === '**') {
                        let request = new FileSystemQuery(
                            Object.assign({}, query, {
                                expression: false,
                                flags: query.flags | FileSystemQueryFlags.Recursive,
                                isSystemRequest: isSystemRequest === true,
                                relativePath: relParts.join('/')
                            }));
                        let expr = isLastPart ? false : FileSystemQuery.buildRegexExpression(parts.slice(i + 1).join('/'), false);
                        let results = await fileSystem.queryFileSystemAsync(request);
                        let thisDir = '/' + parts.slice(0, i).join('/');

                        if (expr)
                            results = results.filter(f => f.getRelativePath && expr.test(f.getRelativePath(thisDir)));

                        return resolve(prepResult(results, isSystemRequest));
                    }
                    else if (dir in this.fileSystems) {
                        relParts = [];
                        fileSystem = this.fileSystems[dir];
                    }
                    else if (FileSystemQuery.containsWildcard(thisPart)) {
                        let request = new FileSystemQuery(
                            Object.assign({}, query, {
                                expression: FileSystemQuery.buildRegexExpression(thisPart),
                                flags: isLastPart ? query.flags : query.flags | FileSystemQueryFlags.IgnoreFiles,
                                isSystemRequest: isSystemRequest === true,
                                relativePath: relParts.join('/')
                            }));
                        let result = await fileSystem.queryFileSystemAsync(request, isSystemRequest === true);

                        if (isLastPart) {
                            return resolve(prepResult(result, isSystemRequest));
                        }
                        else if (!query.atMaxDepth) {
                            let rightExpression = parts.slice(i + 1);
                            let results = [];

                            //  Iterate through subdirectories
                            for (let j = 0; j < result.length; j++) {
                                let subDir = '/' + parts.slice(0, i).join('/') + '/' + result[j].name;

                                if (query.hasFlag(FileSystemQueryFlags.SingleFileSystem) && this.isMountPoint(subDir))
                                    continue;

                                let subQuery = new FileSystemQuery(
                                    Object.assign({}, query, {
                                        expression: subDir + '/' + rightExpression,
                                        flags: isLastPart ? query.flags : query.flags | FileSystemQueryFlags.IgnoreFiles,
                                        isSystemRequest: isSystemRequest === true,
                                        queryDepth: query.queryDepth + 1,
                                        relativePath: relParts.join('/')
                                    }));

                                //  TODO: Add parallelism here?
                                await this.queryFileSystemAsync(subQuery, isSystemRequest === true)
                                    .catch(err => {
                                        if (query.onError)
                                            query.onError(err, subDir, subDir + '/' + rightExpression);
                                    })
                                    .then(result => {
                                        results = results.concat(result);
                                    });
                            }
                            return resolve(prepResult(results, isSystemRequest));
                        }
                        else
                            return resolve([]);
                    }
                    else if (true === isLastPart) {
                        relParts.push(thisPart);
                        let request = new FileSystemQuery(
                            Object.assign({}, query, {
                                isSystemRequest: isSystemRequest === true,
                                relativePath: relParts.join('/')
                            }));

                        await fileSystem.queryFileSystemAsync(request)
                            .then(fso => resolve(prepResult(fso, isSystemRequest)))
                            .catch(err => reject(err));
                    }
                    else {
                        relParts.push(thisPart);
                        absPath.push(thisPart);
                    }
                }
            }
            catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Create the specified filesystem.
     * @param {MudlibFileMount} fsconfig The filesystem to mount.
     * @param {number} index The position of the filesystem in the collection
     */
    async createFileSystem(fsconfig, index) {
        try {
            let fileSystemModulePath = path.join(__dirname, '..', fsconfig.type),
                fileSystemType = require(fileSystemModulePath),
                systemId = crypto.createHash('md5').update(fsconfig.mountPoint).digest('hex'),
                fileSystem = new fileSystemType(this, Object.assign({ systemId }, fsconfig.options), fsconfig.mountPoint);

            if (index === 0 && fsconfig.mountPoint !== '/')
                throw new Error('First mounted filesystem must be root (mountPoint = "/")');
            this.fileSystems[fsconfig.mountPoint] = fileSystem;
            this.fileSystemsById[systemId] = fileSystem;

            return fileSystem;
        }
        catch (err) {
            console.log(`Error in FileManager.createFileSystem(): ${err.message}`);
            throw err;
        }
    }

    async createSecurityManager() {
        return true;
    }

    /**
     * Iterate over the filesystems and perform an action for each.
     * @param {function(FileSystem,string):any[]} callback
     * @returns {any[]} The result of all the actions taken, one element for each filesystem.
     */
    eachFileSystem(callback) {
        return Object.keys(this.fileSystems)
            .map(id => callback(this.fileSystems[id], id));
    }

    /**
     * Iterate over the filesystems and perform an action for each.
     * @param {function(FileSystem,string,number):any[]} callback
     * @returns {any[]} The result of all the actions taken, one element for each filesystem.
     */
    async eachFileSystemAsync(callback) {
        let keys = Object.keys(this.fileSystems);
        for (let i = 0; i < keys.length; i++) {
            let id = keys[i];
            await callback(this.fileSystems[id], id, i);
        }
    }

    /**
     * Get a directory object
     * @param {string} expr The directory expression to fetch
     * @param {number} flags Flags to control the operation
     * @returns {Promise<FileSystemObject>} Returns a directory object.
     * @deprecated
     */
    async getDirectoryAsync(expr, flags = 0) {
        return new Promise(async (resolve, reject) => {
            try {
                let req = this.createFileRequest('getDirectoryAsync', expr, flags),
                    result = this.cache.get(req.fullPath);

                if (!result) {
                    await req.fileSystem.getObjectAsync(req)
                        .then(fso => {
                            if (fso.isDirectory())
                                this.cache.store(fso);
                            resolve(fso);
                        })
                }
                else
                    resolve(result);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Get a file object
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} expr The file path to get
     * @param {number} flags Flags associated with the request
     * @returns {Promise<FileObject>}
     */
    async getFileAsync(ecc, expr, flags = 0, isSystemRequest = false) {
        let frame = ecc.push({ file: __filename, method: 'getFileAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let request = this.createFileRequest('getFileAsync', expr, flags);
            let fso = await request.fileSystem.getObjectAsync(frame.branch(), request);
            return isSystemRequest ? fso : new FileWrapperObject(fso);
        }
        finally {
            frame.pop(true);
        }
    }

    /**
     * Locate the filesystem for the specified absolute path
     * @param {string} expr The directory expression
     * @returns {{fileSystem:FileSystem, relativePath:string}} Returns a filesystem or a filesystem and relative path if withRelativePath is true
     */
    getFilesystem(expr) {
        let parts = expr.split('/'),
            fileSystem = this.fileSystems['/'] || false;
        let /** @type {string[]} */ relParts = [],
            relativePath = '/';

        while (parts.length) {
            let dir = parts.length === 1 && !parts[0] ? '/' : parts.join('/');
            if (dir in this.fileSystems) {
                relativePath = relParts.join('/');
                fileSystem = this.fileSystems[dir];
                break;
            }
            relParts.unshift(parts.pop());
        }

        if (!fileSystem)
            throw new Error('Fatal: Could not locate filesystem');
        return { fileSystem, relativePath };
    }

    /**
     * Get a filesystem based on its system id
     * @param {string} id The ID to fetch
     */
    getFileSystemById(id) {
        return id in this.fileSystemsById === true && this.fileSystemsById[id];
    }

    /**
     * Get a filesystem by its location in the direactory hierarchy.
     * @param {any} mp
     * @returns {MUDFileSystem}
     */
    getFileSystemByMountPoint(mp) {
        let fileSystem = this.fileSystems[mp] || false;
        if (!mp)
            throw new Error(`FATAL: Mount point ${mp} does not exist`);
        return fileSystem;
    }

    /**
     * This method MUST ALWAYS return a filesystem object.  If the object does
     * not exist or an error occurs this method should return a ObjectNotFound
     * FileSystem object.
     * @param {ExecutionContext} ecc The callstack
     * @param {string | IFileSystemQuery} expr The path expression to fetch
     * @param {number} flags Filesystem flags to control the operation
     * @param {boolean} [isSystemRequest] THIS SHOULD ONLY BE USED BY DRIVER INTERNALS
     * @returns {Promise<FileSystemObject>}
     */
    async getObjectAsync(ecc, expr, flags = 0, isSystemRequest = false) {
        let frame = ecc.push({ file: __filename, lineNumber: __line, method: 'getObjectAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (typeof expr === 'object') {
                isSystemRequest = expr.isSystemRequest === true;
                flags = expr.flags || 0;
                expr = expr.file;
            }
            else if (typeof flags === 'boolean') {
                isSystemRequest = flags;
                flags = 0;
            }
            const request = this.createFileRequest('getObjectAsync', expr, flags, isSystemRequest),
                response = await request.fileSystem.getObjectAsync(frame.context, request),
                result = isSystemRequest === true ? response : new FileWrapperObject(response);

            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Check to see if the specified path is a mount point
     * @param {string} dir The directory to check
     * @returns True if the path specified is a mount point
     */
    isMountPoint(dir) {
        if (!dir.startsWith('/'))
            throw new Error(`Path must be absolute: ${dir}`);
        else if (dir.endsWith('/'))
            dir = dir.slice(0, dir.length - 2);

        return dir in this.fileSystems;
    }

    /**
     * SHOULD NEVER BE EXPOSED TO THE MUDLIB
     * Fetches a system file to be used within the driver.
     * @param {string} expr The file to load
     */
    async readSystemFileAsync(expr) {
        let request = this.createFileRequest('readSystemFileAsync', expr);
        return await request.fileSystem.readSystemFileAsync(request);
    }

    /**
     * Locate file objects based on the given patterns.
     * The expressions should always start from the root and contain:
     *   - Double asterisk wildcard for recursive blooms
     *   - Single asterisk wildcards
     *   - Question marks for single characters
     * @param {Glob} options
     * @param {...string} expr One or more expressions to evaluate
     * @returns {FileSystemObject[]} Returns a collection of filesystem objects
     */
    async glob(options = 0, ...expr) {
        /** @type {string[]} */
        let args = [].slice.apply(arguments);
        /** @type {FileSystemObject[]} */
        let results = [];

        if (typeof args[0] === 'number')
            options = args.shift();

        //  For each expression provided...
        for (let i = 0, mi = args.length; i < mi; i++) {
            //  Split into directory parts...
            let parts = args[i].split('/'), opts = options;

            // for each part:
            for (let j = 0, mj = parts.length; j < mj; j++) {
                let pj = parts[j],
                    dir = j > 0 ? parts.slice(0, j - 1).join('/') : '/',
                    { fileSystem, relativePath } = this.getFilesystem(dir);

                if (pj === '**') {
                    //  At this point, get all files at or below this point of the tree
                    //  and convert the remaining file tokens into a regex
                    opts |= Glob.Recursive;

                    /** An additional list of directories to fetch content for
                     * @type {FileSystemObject[]} */
                    let dirStack = [];

                    let subset = await fileSystem.glob(relativePath, '*', opts);
                }
                else if (pj.indexOf('**') > -1)
                    throw new Error('Double asterisk must be a standalone token in expression');

                await fileSystem.glob(relativePath, pj, opts);
            }
        }
        return results;
    }

    /**
     * Helper method to check if an expression is a directory.
     * @param {string} expr The path expression to evaluate.
     * @returns {Promise<boolean>} Returns true if the expression is a directory.
     */
    isDirectoryAsync(expr) {
        return new Promise(async resolve => {
            try {
                let directory = await this.getObjectAsync(expr)
                    .catch(err => resolve(false));
                resolve(directory && directory.exists() && directory.isDirectory());
            }
            catch (err) { resolve(false); }
        });
    }

    /**
     * Check to see if the given expression is a file,
     * @param {string} expr The path expression to evaluate.
     * @param {number} flags Additional flags for the operation
     * @returns {Promise<boolean>} True if the expression is a file.
     */
    isFileAsync(expr, flags = 0) {
        return new Promise(async resolve => {
            try {
                let request = this.createFileRequest('isFileAsync', expr, flags);
                /** @type {DirectoryObject} */
                let directory = await this.getDirectoryAsync(request.directory)
                    .catch(err => resolve(false));
                let file = await directory.getObjectAsync(request.name);
                resolve(file.exists() && file.isFile());
            }
            catch (err) { resolve(false); }
        });
    }

    /**
     * Load an object from disk.
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} expr Information about what is being requested.
     * @param {any} args Data to pass to the constructor.
     * @param {number} flags Flags to control the operation
     * @returns {IMUDObject} The loaded object... hopefully
     */
    async loadObjectAsync(ecc, expr, args, flags = 0) {
        let frame = ecc.push({ file: __filename, method: 'loadObjectAsync', isAsync: true, callType: CallOrigin.Driver });
        try {
            let request = this.createFileRequest('loadObjectAsync', expr, flags);
            let exts = driver.compiler.supportedExtensions,
                pattern = new RegExp(driver.compiler.extensionPattern),
                result = false;
            let fileParts = driver.efuns.parsePath(frame.context, request.fullPath),
                { file, extension, type, objectId, defaultType } = fileParts,
                module = driver.cache.get(file);

            if (module) {
                let instance = module.getInstanceWrapper(fileParts);
                if (instance)
                    return instance;
                else if ((flags & 2) === 2 && !objectId) {
                    instance = await module.createInstanceAsync(frame.branch(), type, undefined, args);
                    return instance || false;
                }
            }

            let targetFile = extension && await this.getObjectAsync(frame.branch(), file);

            if (extension && pattern.test(targetFile.fullPath)) {
                result = await targetFile.loadObjectAsync(frame.branch(), request.flags, args, fileParts);
            }
            else if (extension) {
                throw new Error(`loadObjectAsync(): Invalid file extension: ${extension}`);
            }
            else {
                //  Extension was not specified... try them all
                for (let i = 0; i < exts.length; i++) {
                    let fileWithExtension = await this.getObjectAsync(frame, { file: file + exts[i], flags });

                    if (fileWithExtension.exists()) {
                        result = await fileWithExtension.loadObjectAsync(frame, request.flags, args);
                        break;
                    }
                }
                if (!result) {
                    //  Try virtual
                    targetFile = new VirtualObjectFile(FileSystemObject.createDummyStats(request), request);
                    result = await targetFile.loadObjectAsync(frame.branch(), request, args);
                }
            }

            if (!result)
                throw new Error(`loadObjectAsync(): Could not find suitable file to load: ${request.fullPath}`);
            return result;
        }
        catch (err) {
            throw err;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Read a directory expression
     * @param {string} expr The expression to parse
     * @param {number} [flags] Flags associated with the operation
     */
    readDirectoryAsync(expr, flags = 0) {
        return new Promise(async (resolve, reject) => {
            let request = this.createFileRequest('readDirectoryAsync', expr, flags),
                pathParts = expr.split('/'),
                initialDirectory = '/',
                wildCardTest = /[\*\?]+/,
                fileExpression = pathParts.last();

            for (let i = 0, m = pathParts.length; i < m; i++) {
                if (wildCardTest.test(pathParts[i])) {
                    initialDirectory = pathParts.slice(0, i).join('/');
                    fileExpression = pathParts.slice(i).join('/');
                    break;
                }
            }

            let directory = await this.getDirectoryAsync(initialDirectory);
            if (!directory.exists() || !directory.isDirectory())
                return reject(`Path ${initialDirectory} is not a directory.`);
            return resolve(await directory.readAsync(fileExpression));
        });
    }

    /**
     * Reads a file from the filesystem.
     * @param {string} expr The file to try and read.
     * @param {FileOptions} options 
     * @returns {string} The content from the file.
     */
    async readFileAsync(expr, options = { encoding: 'utf8', flags: 0 }) {
        let request = this.createFileRequest('readFileAsync', expr);
        return new Promise(async (resolve, reject) => {
            try {
                /** @type {FileObject} */
                let fileObject = await request.fileSystem.getObjectAsync(request);
                if (fileObject.exists()) {
                    let result = fileObject.readAsync(options.encoding, options.flags)
                        .catch(err => reject(err));
                    resolve(result);
                }
                else
                    reject(`File not found: ${request.fullPath}`)
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Stat a file
     * @param {any} expr
     * @param {any} flags
     */
    async statAsync(expr, flags = 0) {
        let request = this.createFileRequest('stat', expr, flags),
            result;
        if (!request.valid('validStatFile'))
            return request.deny();
        else {
            try {
                result = await request.fileSystem.statAsync(request);
            }
            catch (err) {
                result = FileSystemObject.createDummyStats(request, err);
            }
            result = Object.freeze(result);
            return result;
        }
    }

    /**
     * Converts a real path into a virtual MUD path.
     * @param {string} expr The absolute file path to translate.
     * @returns {string} The virtual MUD path or false if not in the virtual filesystem.
     */
    toMudPath(expr) {
        let fsn = Object.keys(this.fileSystems);
        for (let i = 0; i < fsn.length; i++) {
            let fso = this.fileSystems[fsn[i]],
                result = fso.getVirtualPath(expr);
            if (result)
                return result;
        }
        return false;
    }

    /**
     * Translates a virtual path into an absolute path (if filesystem supported)
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} exprIn The virtual directory to translate.
     * @returns {string} The absolute path.
     */
    toRealPath(ecc, exprIn) {
        /** @type {[ExecutionFrame, string]} */
        let [frame, expr] = ExecutionContext.tryPushFrame(arguments, { file: __filename, method: 'toRealPath', callType: CallOrigin.Driver });
        try {
            let req = this.createFileRequest('toRealPath', expr);
            return req.fileSystem.getRealPath(frame?.branch(), req.relativePath);
        }
        finally {
            frame?.pop();
        }
    }

    /**
     * Create a suitable wrapper object
     * @param {FileSystemObject | FileSystemObject[]} fso The object(s) to wrap
     */
    wrapFileObject(fso) {
        if (Array.isArray(fso)) {
            return fso.map(f => this.wrapFileObject(f));
        }
        return new FileWrapperObject(fso);
    }

    /**
     * Write to a file asyncronously.
     * @param {string} expr The file to write to.
     * @param {string|Buffer} content The content to write to file.
     * @param {string} flags Flags controlling the operation.
     * @param {string} encoding The optional encoding to use
     * @returns {Promise<boolean>} The promise for the operation.
     */
    writeFileAsync(expr, content, flags, encoding) {
        return new Promise(async (resolve, reject) => {
            try {
                let request = this.createFileRequest('writeFileAsync', expr, flags || 'w');
                let directory = await this.getDirectoryAsync(request.directory);
                let file = await directory.getObjectAsync(request.name);
                resolve(await file.writeFileAsync(content, flags, encoding));
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * 
     * @param {string} expr The location to write data to
     * @param {string} content The block of JSON data to write
     * @returns {Promise<boolean>} An indication of success or failure
     */
    async writeJsonAsync(expr, content, flags = 0) {
        let request = this.createFileRequest('writeJsonAsync', expr, false, 0, null);
        return request.valid('validWriteFile') && await request.fileSystem.writeJsonAsync(request, content);
    }
}

module.exports = FileManager;
