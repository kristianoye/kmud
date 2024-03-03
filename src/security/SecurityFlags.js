const
    SecurityFlags = Object.freeze({
        /** May read the contents of an object */
        P_READ: 1 << 0,
        /** May write/overwrite the object */
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
        /** All possible permissions */
        P_ALL: 0xffff,

        permsString: (x) => {
            let result = '';

            if ((x & SecurityFlags.P_LISTDIR) && (x & SecurityFlags.P_READ))
                result += 'R';
            else if ((x & SecurityFlags.P_READ))
                result += 'r';
            else
                result += '-';

            if ((x & SecurityFlags.P_CREATEFILE) && (x & SecurityFlags.P_CREATEDIR))
                result += 'C';
            else if ((x & SecurityFlags.P_CREATEFILE))
                result += 'c';
            else
                result += '-';

            if ((x & SecurityFlags.P_DELETEDIR) && (x & SecurityFlags.P_DELETE))
                result += 'D';
            else if ((x & SecurityFlags.P_DELETE))
                result += 'd';
            else
                result += '-';

            if ((x & SecurityFlags.P_READMETADATA) && (x & SecurityFlags.P_WRITEMETADATA))
                result += 'M';
            else if ((x & SecurityFlags.P_READMETADATA))
                result += 'm';
            else
                result += '-';

            result += (x & SecurityFlags.P_WRITE) > 0 ? 'w' : '-';
            result += (x & SecurityFlags.P_EXECUTE) > 0 ? 'x' : '-';
            result += (x & SecurityFlags.P_TAKEOWNERSHIP) > 0 ? 'O' : '-';
            result += (x & SecurityFlags.P_CHANGEPERMS) > 0 ? 'P' : '-';
            result += (x & SecurityFlags.P_LOADOBJECT) > 0 ? 'L' : '-';
            result += (x & SecurityFlags.P_DESTRUCTOBJECT) > 0 ? 'U' : '-';

            return result;
        }
    });

module.exports = SecurityFlags;
