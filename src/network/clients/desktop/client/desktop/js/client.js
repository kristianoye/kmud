/// <reference path="jquery-3.3.1.js" />
/// <reference path="ventus.js" />
const { DesktopClientClass } = (function (Ventus) {
    'use strict';

    
    class DesktopClientClass {
        /**
         * Construct a new client
         * @param {string} url The base URL of the MUD to connect to
         */
        constructor(url) {
            this.baseUrl = url;
        }
    }

    return { DesktopClientClass };
})(Ventus);
