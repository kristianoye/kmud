const
    SecurityFlags = Object.freeze({
        /** May read the contents of an object */
        P_READ: 1 << 0,
        /** May write/overwrite the object; Also see P_APPEND */
        P_WRITE: 1 << 1,
        /** May delete the object */
        P_DELETE: 1 << 2,
        /** May delete this directory */
        P_DELETEDIR: 1 << 3,
        /** May read the contents of a directory */
        P_LISTDIR: 1 << 4,
        /** May create a file in the directory */
        P_CREATEFILE: 1 << 5,
        /** May create a new directory */
        P_CREATEDIR: 1 << 6,
        /** May change permissions on an object */
        P_CHANGEPERMS: 1 << 7,
        /** May view the permissions on an object */
        P_READPERMS: 1 << 8,
        /** May take ownership of an object */
        P_TAKEOWNERSHIP: 1 << 9,
        /** Can you read the associated metadata? */
        P_READMETADATA: 1 << 10,
        /** Can you write to the associated metadata? */
        P_WRITEMETADATA: 1 << 11,
        /** Can the user read filesystem files? */
        P_VIEWSYSTEMFILES: 1 << 12,
        /** Can the user load types from the file module? */
        P_LOADOBJECT: 1 << 13,
        /** Can the user execute the type as a command? */
        P_EXECUTE: 1 << 14,
        /** Can the user destruct the objects created from the module? */
        P_DESTRUCTOBJECT: 1 << 15,
        /** May append but may not be able to truncate */
        P_APPEND: 1 << 16
    });

module.exports = SecurityFlags;
