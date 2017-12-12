/**
 * The KMUD Client.  Responsible for providing the core communication with
 * the MUD/WMD server and for coordinating the rendering of game content.
 *
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var WizardShell = (function ($, parent) {
    function WizardShell(container, state) {
        parent.call(this, 'wizShell', container, state);
        var client = this.client;

        var $shellView = $('<div class="wizShellView"/>')
            .addClass(state.role);

        switch (state.role) {
            case 'treeView':
                container.setTitle('File Explorer');
                this['_fileCache'] = { '/': { id: '/', text: '/', parent: '#', children: true }};

                var $tree = $('<div class="fileTree" />').data('owner', this), self = this;
                $tree.jstree({
                    'plugins': ["sort", "contextmenu"],
                    'core': {
                        data: function (obj, callback) {
                            var _this = this;

                            if (obj.id === '#') {
                                self.treeDataCallback = callback;
                                callback.call(this, [{ id: '/', text: '/ [root]', parent: '#', children: true }]);
                            }
                            else {
                                client.request({ eventType: 'wizShell.getDir', eventData: obj.id },
                                    function (e) { callback.call(_this, e.eventData); });
                            }
                        }
                    }
                });
                $shellView.append($tree);

                this.$element.addClass('wizShell explorer').append($shellView);
                this.$element.attr('data-clientrole', 'file-explorer');
                this.$treeView = $tree;
                break;

            case 'fileView':
                container.setTitle('*New File*');
                this.$element.attr('data-clientrole', 'file-editor');
                this.$element.addClass('wizShell fileEditor').append($shellView);
                break;
        }
        
    }

    WizardShell.prototype = Object.create(parent.prototype);

    WizardShell.prototype.onClientEvent = function (event) {
        switch (event) {
            case 'connected':
            case 'disconnected':
                break;
        }
    };

    WizardShell.prototype.receiveFiles = function (files) {
        var fc = this['_fileCache'];
        Object.keys(files)
            .map(function (id) {
                fc[id] = files[id];
            });
        this.$treeView.data('jstree').refresh();
    };

    WizardShell.prototype.registerModule = function (client, ws) {
        var T = this;

        Object.defineProperty(this, 'socket', {
            get: function () { return ws; },
            set: function () { },
            enumerable: false
        });

        client.on('wizshell.explorer', function (packet) { T.renderDirectory(packet); });
        client.on('wizshell.editfile', function (packet) { T.editFile(packet); });

        return this;
    };

    return WizardShell;
})(jQuery, MudClientModule);