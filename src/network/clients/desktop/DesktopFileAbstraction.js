
const
    Abstraction = require('../../servers/HTTPServer/FileAbstraction'),
    path = require('path'),
    fs = require('fs');

class DesktopFileAbstraction extends Abstraction.FileAbstractionDefault {
    /**
     * Constructs a file abstraction for the MUD's external service
     * @param {string} staticRoot The static root to use
     */
    constructor(staticRoot) {
        super(staticRoot);
    }

    //  TODO: Get/put player reference on the stack based on auth token
    async driverCall(method, callback) {
        return await driver.driverCallAsync(method, async () => {
            return await callback();
        });
    }

    async readDirectory(expr, isMapped = undefined) {
        let [fileName, mapped] = isMapped === true ? [expr, true] : this.resolve(expr);

        if (mapped)
            return super.readDirectory(fileName, true);
        else
            return await this.driverCall('readDirectory', async () => {
                return await driver.fileManager.readDirectoryAsync(fileName);
            });
    }

    async readFile(expr, isMapped = undefined) {
        let [fileName, mapped] = isMapped === true ? [expr, true] : this.resolve(expr);

        if (mapped)
            return super.readFile(fileName, true);
        else
            return await this.driverCall('readFile', async () => {
                return await driver.fileManager.readFile(fileName);
            });
    }

    /**
     * Attempt to read a location for a physical file.
     * @param {string} expr The file expression to stat
     * @param {boolean} isMapped Has the location already been mapped?
     * @param {string} encoding If specified this is the type of encoding to use when parsing the result
     * @returns {Promise<string>} Returns the contents of the file
     */
    async readLocation(expr, isMapped = undefined, encoding = false) {
        let [fileName, mapped] = isMapped === true ? [expr, true] : this.resolve(expr);

        let stat = await this.stat(fileName, mapped);

        if (stat.exists && stat.isDirectory()) {
            let found = false;

            for (let i = 0; i < this.indexFiles.length; i++) {
                let fullPath = path.posix.join(fileName, this.indexFiles[i]);

                stat = await this.readLocation(fullPath, false);

                if (stat.exists && stat.isFile()) {
                    return [fullPath, stat];
                }
            }
        }
        else if (stat.exists && stat.isFile())
            return [fileName, stat];
        return false;
    }

    /**
     * Attempt to stat a file
     * @param {string} expr The file expression to stat
     * @param {boolean} isMapped Has the location already been mapped?
     * @returns {Promise<fs.Stats & { exists: boolean, path: string }>} Return information about a file.
     */
    async stat(expr, isMapped = undefined) {
        if (isMapped !== true) {
            for (let i = 0, m = this.fileMappingNames.length; i < m; i++) {
                let mapName = this.fileMappingNames[i];
                if (expr.startsWith(mapName)) {

                }
            }
        }

        let stat = await driver.driverCallAsync('statAsync', async () => {
            return isMapped ? await super.stat(expr) : await driver.fileManager.statAsync(expr);
        });

        if (stat.exists)
            return stat;
        else
            return await super.stat(expr, isMapped);
    }
}

module.exports = DesktopFileAbstraction;
