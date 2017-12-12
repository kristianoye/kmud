/**
 * The KMUD Client.  Responsible for providing the core communication with
 * the MUD/WMD server and for coordinating the rendering of game content.
 *
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var WizardExplorer = (function ($, parent) {
    function WizardExplorer(container, state) {
        parent.call(this, 'WizardExplorer', container, state);

        var client = this.client,
            self = this,
            id = 'explorer' + new Date().getTime(),
            $explorer = client.buildTemplate('wizExplorerTemplate', [id]);

        this.$element
            .addClass('mudModule wizExplorerWindow')
            .append($explorer);

        try {
            this.$tree = $explorer.find('.fileTree');
            this.$tree.jstree({
                'plugins': ["sort", "contextmenu"],
                'contextmenu': {
                    items: function (node) {
                        return self.getContextMenu(node);
                    }
                },
                'core': {
                    data: function (obj, callback) {
                        var _this = this;

                        if (obj.id === '#') {
                            self.treeDataCallback = callback;
                            callback.call(this, [{ id: '/', text: '/ [root]', parent: '#', children: true }]);
                        }
                        else {
                            setTimeout(function () {
                                client.request({
                                    eventType: 'wizShell.getDir',
                                    eventData: {
                                        directory: obj.id,
                                        syncCwd: self.client.getPreferences('wiz.syncCwd', false)
                                    }
                                },
                                function (e) {
                                    callback.call(_this, e.eventData);
                                });
                            }, 100);
                        }
                    }
                }
            });
        }
        catch (e) {
            try {
                container.close();
            }
            catch (e) {
                self.client.destroyModuleInstance(self);
            }
        }
        this.tree = this.$tree.data('jstree');
        container.setTitle('Explorer');
        this.addTreeData(state.initialEvent);
    }

    WizardExplorer.prototype = Object.create(parent.prototype);

    WizardExplorer.prototype.addTreeData = function (event) {
        var fd = event.eventData.result,
            list = Object.keys(fd).sort(function (a, b) {
                var ap = a.split('/').length,
                    bp = b.split('/').length;
                if (ap.length < bp.length) return 1;
                else if (ap.length > bp.length) return -1;
                else return a.length < b.length ? -1 : 1;
            }),
            tree = this.tree,
            self = this;

        setTimeout(function () {
            self.openDirectory(list.pop());
        }, 150);
    };

    WizardExplorer.prototype.cloneItem = function (node) {

    };

    WizardExplorer.prototype.deleteItem = function (node) {
        if (confirm('Are you sure you want to delete ' + node.id)) {
            this.client.with('MudConsole', function (con) {
                con.issueCommand('rmx ' + node.id);
            });
        }
    };

    WizardExplorer.prototype.editItem = function (node) {
        this.client.with('MudConsole', function (con) {
            con.issueCommand('edit ' + node.id);
        });
    };

    WizardExplorer.prototype.getContextMenu = function (node) {
        var self = this,
            pp = (node.parent || '').split('/').map(function (s) { return s.toLowerCase() }),
            fn = (node.text || '').toLowerCase(),
            items = {
                deleteItem: {
                    label: 'Delete ' + node.text,
                    action: function () { return self.deleteItem(node); }
                },
                editItem: {
                    label: 'Edit ' + node.text,
                    action: function () { return self.editItem(node); }
                },
                renameItem: {
                    label: 'Rename ' + node.text + ' to...',
                    action: function () { return self.renameItem(node); }
                }
            }, $node = $(node);

        if ($node.hasClass('folder')) {
            delete items['editItem'];
        }

        if (node.icon === "fs-ext-js") {
            var areaKeywords = ['area', 'rooms', 'room', 'workroom.js'],
                noClones = ['base', 'lib', 'cmds', 'daemon', 'include', 'src'],
                isRoom = false, isNoClone = false;

            for (var i = 0; i < areaKeywords.length; i++) {
                if (pp.filter(function (s) { return s.indexOf(areaKeywords[i]) > -1; }).length || fn.indexOf(areaKeywords[i]) > -1) {
                    items.gotoItem = {
                        label: 'Goto ' + node.text,
                        action: function () { self.gotoItem(node) }
                    };
                    isRoom = true;
                    break;
                }
            }
            if (!isRoom) {
                for (var i = 0; i < noClones.length; i++) {
                    if (pp.filter(function (s) { return s.indexOf(noClones[i]) > -1; }).length || fn.indexOf(noClones[i]) > -1) {
                        isNoClone = true;
                        break;
                    }
                }
                if (!isNoClone)
                {
                    items.cloneItem = {
                        label: 'Clone ' + node.text,
                        actions: function () { self.cloneItem(node) }
                    }
                }
            }
            items.updateItem = {
                label: 'Update ' + node.text,
                action: function () { self.updateItem(node) }
            };
        }

        return items;
    }

    WizardExplorer.prototype.gotoItem = function (node) {
        this.client.with('MudConsole', function (con) {
            con.issueCommand('goto ' + node.id);
        });
    };

    WizardExplorer.prototype.openDirectory = function (data) {
        if (typeof data === 'string') {
            var parts = data.split('/'),
                tree = this.tree;

            function openDir(i) {
                if (i <= parts.length) {
                    var dir = parts.slice(0, i + 1).join('/') + '/',
                        node = tree.get_node(dir);
                    if (node) {
                        tree.open_node(dir, function () { openDir(i + 1); });
                    }
                    else if (i < parts.length)
                        openDir(i + 1);
                }
            }
            openDir(0);
            return;
        }
        return this.addTreeData(data);
    };

    WizardExplorer.prototype.renameItem = function (data) {

    };

    WizardExplorer.prototype.updateItem = function (node) {
        this.client.with('MudConsole', function (con) {
            con.issueCommand('update ' + node.id);
        });
    };

    return WizardExplorer;
})(jQuery, MudClientModule);
