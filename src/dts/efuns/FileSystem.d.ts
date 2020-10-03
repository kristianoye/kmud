namespace system {
    namespace FileSystem {
        /** Generic interface for directory-based operations */
        declare class DirectoryOperation {
            /** A function that fires when all operations are completion */
            completion: () => void;

            /** A function that is called each time to confirm an operation */
            confirm: (object: FileSystemObject) => boolean;

            /** Fires every time an operation failure occurs */
            perFailure: (file: FileSystemObject) => void;

            /** Fires every time an operational success occurs */
            perSuccess: (file: FileSystemObject) => void;

            /** Flags to control the operation */
            flags: number;
        }

        /** Statistics returned by a directory operation */
        declare class DirectoryOperationSummary {
            /** Total bytes processed */
            readonly totalBytes: number;

            /** Total directories processed */
            readonly totalDirectories: number;

            /** Total files processed */
            readonly totalFiles: number;
        }
    }
}

namespace Helpers {
    interface DirectoryOperationSummary {
        readonly totalBytes: number;

        readonly totalDirectories: number;

        readonly totalFiles: number;
    }

    /** Various filesystem helpers */
    interface FileSystem {
        /**
         * Appends content to the end of a file
         * @param expr The path expression to write to
         * @param content The content to append to the file
         * @param encoding The optional encoding to use when writing
         */
        appendFileAsync(expr: string, content: string | Buffer, encoding?: string): Promise<boolean>;

        /**
         * Create a copy of an object
         * @param expr The name of the object or an instance to clone
         * @param args Arguments to supply to the constructor and creation process
         */
        cloneObjectAsync(expr: MUDObject | string, ...args: any[]): Promise<MUDObject>;

        /**
         * Create a directory
         * @param expr The path to create
         * @param flags Flags controlling the operation
         */
        createDirectoryAsync(expr: string, flags?: number): Promise<boolean>;

        /**
         * Deletes a directory
         * @param expr The path to delete
         * @param flags Flags controlling the operation
         */
        deleteDirectoryAsync(expr: string, flags?: number): Promise<boolean>;

        /**
         * Deletes a single file from the filesystem
         * @param expr The path to delete
         * @param flags The optional flags controlling the operation
         */
        deleteFileAsync(expr: string, flags?: number): Promise<boolean>;

        /** Flags for directory operations */
        DirFlags: number;

        /**
         * Get a directory object
         * @param {string} expr The directory expression to fetch
         * @param {number} flags Flags to control the operation
         */
        getDirectoryAsync(expr: string, flags?: number): Promise<DirectoryObject>;

        /**
         * Get a file object
         * @param expr The file expression to fetch
         * @param flags Flags to control the operation
         */
        getFileAsync(expr: string, flags?: number): Promise<FileObject>;

        /**
         * Get an object from the filesystem
         * @param expr The expression to fetch
         * @param flags Flags to control the operation
         */
        getObjectAsync(expr: string, flags?: number): Promise<FileSystemObject>;

        /**
         * Check to see if an expression is a directory
         * @param expr The path to check
         */
        isDirectoryAsync(expr: string): Promise<boolean>;

        /**
         * Check to see if the path expression is a regular file
         * @param expr The path to check
         */
        isFileAsync(expr: string): Promise<boolean>;

        /**
         * Attempt to load an object
         * @param expr The path expression to load from
         * @param flags Optional flags to control the operation
         */
        loadObjectAsync(expr: string, flags?: number): Promise<MUDObject>;

        /**
         * Read the contents of a directory
         * @param expr The path to read from
         * @param flags Flags to control the operation
         */
        readDirectoryAsync(expr: string, flags?: number): Promise<string[]>;

        /**
         * Read the contents of a file
         * @param expr The path expression to read from
         * @param encoding The optional encoding to use when reading
         */
        readFileAsync(expr: string, encoding?: string): Promise<string> | Promise<Buffer>;

        /**
        * Read JSON from a stream
        * @param {string} expr The location to read from
        * @returns {Promise<object>} The resulting object
        */
        readJsonAsync(expr: string): Promise<object>;

        /**
         * Attempt to read a file as YAML markup
         * @param expr The file to read
         */
        readYamlAsync(expr: string): Promise<object>;

        /**
         * Stat the filesystem
         * @param expr The path expression to read.
         */
        statAsync(expr: string): Promise<FileSystemObject>;

        /**
         * Writes JSON to a stream
         * @param file The filename to write to
         * @param content The content to write.
         * @param flags Optional flags for the operation
         * @param encoding The encoding to use when writing (defaults to utf8)
         */
        writeJsonAsync(file: string, content: any, flags?: number, encoding?: string): Promise<boolean>;
    }
}
