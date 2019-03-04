/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: March 3, 2019
 *
 * Description: New and improved? HTTP daemon for KMUD
 */

/** @typedef {{ extension: string, type: string, text: string }} MIMESpec */
const
    KnownMimeTypes = {
        ".aac": {
            "type": "audio/aac",
            "text": "AAC audio"
        },
        ".abw": {
            "type": "application/x-abiword",
            "text": "AbiWord document"
        },
        ".arc": {
            "type": "application/x-freearc",
            "text": "Archive document (multiple files embedded)"
        },
        ".avi": {
            "type": "video/x-msvideo",
            "text": "AVI: Audio Video Interleave"
        },
        ".azw": {
            "type": "application/vnd.amazon.ebook",
            "text": "Amazon Kindle eBook format"
        },
        ".bin": {
            "type": "application/octet-stream",
            "text": "Any kind of binary data"
        },
        ".bmp": {
            "type": "image/bmp",
            "text": "Windows OS/2 Bitmap Graphics"
        },
        ".bz": {
            "type": "application/x-bzip",
            "text": "BZip archive"
        },
        ".bz2": {
            "type": "application/x-bzip2",
            "text": "BZip2 archive"
        },
        ".csh": {
            "type": "application/x-csh",
            "text": "C-Shell script"
        },
        ".css": {
            "type": "text/css",
            "text": "Cascading Style Sheets (CSS)"
        },
        ".csv": {
            "type": "text/csv",
            "text": "Comma-separated values (CSV)"
        },
        ".doc": {
            "type": "application/msword",
            "text": "Microsoft Word"
        },
        ".docx": {
            "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text": "Microsoft Word (OpenXML)"
        },
        ".eot": {
            "type": "application/vnd.ms-fontobject",
            "text": "MS Embedded OpenType fonts"
        },
        ".epub": {
            "type": "application/epub+zip",
            "text": "Electronic publication (EPUB)"
        },
        ".gif": {
            "type": "image/gif",
            "text": "Graphics Interchange Format (GIF)"
        },
        ".htm": {
            "type": "text/html",
            "text": "HyperText Markup Language (HTML)"
        },
        ".html": {
            "type": "text/html",
            "text": "HyperText Markup Language (HTML)"
        },
        ".ico": {
            "type": "image/vnd.microsoft.icon",
            "text": "Icon format"
        },
        ".ics": {
            "type": "text/calendar",
            "text": "iCalendar format"
        },
        ".jar": {
            "type": "application/java-archive",
            "text": "Java Archive (JAR)"
        },
        ".jpg": {
            "type": "image/jpeg",
            "text": "JPEG images"
        },
        ".jpeg": {
            "type": "image/jpeg",
            "text": "JPEG images"
        },
        ".js": {
            "type": "text/javascript",
            "text": "JavaScript"
        },
        ".json": {
            "type": "application/json",
            "text": "JSON format"
        },
        ".mhtm": {
            "type": "text/mud-html",
            "text": "MUD HyperText Markup"
        },
        ".midi": {
            "type": "audio/midi audio/x-midi",
            "text": "Musical Instrument Digital Interface (MIDI)"
        },
        ".mid": {
            "type": "audio/midi audio/x-midi",
            "text": "Musical Instrument Digital Interface (MIDI)"
        },
        ".mjs": {
            "type": "text/javascript",
            "text": "JavaScript module"
        },
        ".mp3": {
            "type": "audio/mpeg",
            "text": "MP3 audio"
        },
        ".mpeg": {
            "type": "video/mpeg",
            "text": "MPEG Video"
        },
        ".mpkg": {
            "type": "application/vnd.apple.installer+xml",
            "text": "Apple Installer Package"
        },
        ".odp": {
            "type": "application/vnd.oasis.opendocument.presentation",
            "text": "OpenDocument presentation document"
        },
        ".ods": {
            "type": "application/vnd.oasis.opendocument.spreadsheet",
            "text": "OpenDocument spreadsheet document"
        },
        ".odt": {
            "type": "application/vnd.oasis.opendocument.text",
            "text": "OpenDocument text document"
        },
        ".oga": {
            "type": "audio/ogg",
            "text": "OGG audio"
        },
        ".ogv": {
            "type": "video/ogg",
            "text": "OGG video"
        },
        ".ogx": {
            "type": "application/ogg",
            "text": "OGG"
        },
        ".otf": {
            "type": "font/otf",
            "text": "OpenType font"
        },
        ".png": {
            "type": "image/png",
            "text": "Portable Network Graphics"
        },
        ".pdf": {
            "type": "application/pdf",
            "text": "Adobe Portable Document Format (PDF)"
        },
        ".ppt": {
            "type": "application/vnd.ms-powerpoint",
            "text": "Microsoft PowerPoint"
        },
        ".pptx": {
            "type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text": "Microsoft PowerPoint (OpenXML)"
        },
        ".rar": {
            "type": "application/x-rar-compressed",
            "text": "RAR archive"
        },
        ".rtf": {
            "type": "application/rtf",
            "text": "Rich Text Format (RTF)"
        },
        ".sh": {
            "type": "application/x-sh",
            "text": "Bourne shell script"
        },
        ".svg": {
            "type": "image/svg+xml",
            "text": "Scalable Vector Graphics (SVG)"
        },
        ".swf": {
            "type": "application/x-shockwave-flash",
            "text": "Small web format (SWF) or Adobe Flash document"
        },
        ".tar": {
            "type": "application/x-tar",
            "text": "Tape Archive (TAR)"
        },
        ".tif": {
            "type": "image/tiff",
            "text": "Tagged Image File Format (TIFF)"
        },
        ".tiff": {
            "type": "image/tiff",
            "text": "Tagged Image File Format (TIFF)"
        },
        ".ttf": {
            "type": "font/ttf",
            "text": "TrueType Font"
        },
        ".txt": {
            "type": "text/plain",
            "text": "Text, (generally ASCII or ISO 8859-n)"
        },
        ".vsd": {
            "type": "application/vnd.visio",
            "text": "Microsoft Visio"
        },
        ".wav": {
            "type": "audio/wav",
            "text": "Waveform Audio Format"
        },
        ".weba": {
            "type": "audio/webm",
            "text": "WEBM audio"
        },
        ".webm": {
            "type": "video/webm",
            "text": "WEBM video"
        },
        ".webp": {
            "type": "image/webp",
            "text": "WEBP image"
        },
        ".woff": {
            "type": "font/woff",
            "text": "Web Open Font Format (WOFF)"
        },
        ".woff2": {
            "type": "font/woff2",
            "text": "Web Open Font Format (WOFF)"
        },
        ".xhtml": {
            "type": "application/xhtml+xml",
            "text": "XHTML"
        },
        ".xls": {
            "type": "application/vnd.ms-excel",
            "text": "Microsoft Excel"
        },
        ".xlsx": {
            "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text": "Microsoft Excel (OpenXML)"
        },
        ".xml": {
            "type": "application/xml if not readable from casual users (RFC 3023, section 3)\n    text/xml if readable from casual users (RFC 3023, section 3)",
            "text": "XML"
        },
        ".xul": {
            "type": "application/vnd.mozilla.xul+xml",
            "text": "XUL"
        },
        ".zip": {
            "type": "application/zip",
            "text": "ZIP archive"
        },
        ".3gp": {
            "type": "video/3gpp\n    audio/3gpp if it doesn't contain video",
            "text": "3GPP audio/video container"
        },
        ".3g2": {
            "type": "video/3gpp2\n    audio/3gpp2 if it doesn't contain video",
            "text": "3GPP2 audio/video container"
        },
        ".7z": {
            "type": "application/x-7z-compressed",
            "text": "7-zip archive"
        },
        /**
         * Search for a MIME entry
         * @param {string} spec Any accepted search criteria
         * @returns {MIMESpec|MIMESpec[]} Information about the MIME type
         */
        resolve: function (spec) {
            let searchFor = spec.trim().toLowerCase();

            if (!spec)
                return undefined;

            if (searchFor.charAt(0) !== '.') {
                let key = `.${searchFor}`;
                if (key in KnownMimeTypes) {
                    return Object.assign({ extension: key }, KnownMimeTypes[key]);
                }
            }
            if (searchFor in KnownMimeTypes) {
                return Object.assign({ extension: searchFor }, KnownMimeTypes[searchFor]);
            }
            let mtypes = Object.keys(KnownMimeTypes)
                .filter(ext => {
                    let mtype = KnownMimeTypes[ext];
                    return mtype.text.toLowerCase().contains(searchFor) ||
                        mtype.type.toLowerCase().contains(searchFor);
                })
                .map(ext => {
                    return Object.assign({ extension: ext }, KnownMimeTypes[ext]);
                });

            if (mtypes.length === 1)
                return mtypes[0];
            else if (mtypes.length > 1)
                return mtypes;
            else
                return undefined;
        }
    };

module.exports = KnownMimeTypes;
