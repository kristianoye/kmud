/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Date: August 8, 2024
 */
const fs = require('fs'),
    Module = require('module');

/**
 * 
 * @param {string} ext The file extension to configure the loader for
 * @param {function(string, Module): boolean} checkExclude Callback to see if we should defer to the original loader
 * @returns 
 */
function configureExtensionLoader(ext = '.js', checkExclude = false) {
    const
        originalRequire = Module._extensions[ext];

    /**
     * 
     * @param {string} filename The file being processed
     * @param {string} contentIn The content of the file
     */
    function preprocess(filename, contentIn) {
        const
            ext = filename.slice(filename.lastIndexOf('.')),
            content = contentIn.split('\n').map((line, index) => {
                line = line.replace(/__line/g, index + 1);
                line = line.replace(/__ext/g, ext);
                return line;

            }).join('\n');
        //  TODO: Add support for __class, __methodName, etc
        return content;
    }

    /**
     * Load a module
     * @param {Module} module 
     * @param {string} filename The module file to load
     */
    Module._extensions[ext] = function (module, filename) {
        const
            excluded = checkExclude && checkExclude(filename, module);

        if (!excluded) {
            const content = fs.readFileSync(filename, 'utf8');
            const preprocessedContent = preprocess(filename, content);
            module._compile(preprocessedContent || content, filename);
        }
        else
            return originalRequire(module, filename);
    };

    return true;
}

/**
 * Configure the preprocessor for a list of extensions.
 * @param {string[]} extensionList The list of extensions to configure
 * @param {function(string, Module): boolean} checkExclude A callback that can exclude modules from preprocessing
 */
module.exports = function (extensionList = ['.js'], checkExclude) {
    for (ext of extensionList) {
        configureExtensionLoader(ext, checkExclude);
    }
}