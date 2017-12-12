/**
 * The KMUD Client.  Responsible for providing the core communication with
 * the MUD/WMD server and for coordinating the rendering of game content.
 *
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var WizardEditor = (function ($, parent) {
    function WizardEditor(container, state) {
        parent.call(this, 'WizardEditor', container, state);

        var client = this.client, self = this, id = 'editor' + new Date().getTime(), _editor = null,
            $shellView = client.buildTemplate('wizShellEditorTemplate', [id, state.language]);

        this.editorLanguage = state.language;
        this.editorText = state.source;
        this.fileName = state.fileName;
        this.fullPath = state.fullPath;
        this.source = state.source;
        this.unsaved = false;

        Object.defineProperties(this, {
            editor: {
                set: function (inst) {
                    if (_editor) {
                        throw new Error('Cannot re-set the editor instance!');
                    }
                    inst.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, function () { self.save(); });
                    inst.onDidChangeModelContent(function () {
                        container.setTitle(self.fileName + '*');
                        self.unsaved = true;
                        self.$element.find('.btn-save').show();
                    });
                    _editor = inst;
                },
                get: function () {
                    return _editor;
                }
            }
        });

        this.$element
            .addClass('mudModule wizEditor')
            .append($shellView);

        this.client.on('kmud', function (event) {
            switch (event.eventType) {
                case 'savePreferences':
                    if (_editor) {
                        var prefs = event.eventData;
                        monaco.editor.setTheme(
                            'wiz.editor.colors' in prefs ?
                                prefs['wiz.editor.colors'] : 'vs')
                    }
                    break;
            }
        });

        this.$element.on('click', '.btn-save', function (e) { self.save(); });
        this.$element.on('click', '.btn-close', function (e) { self.close(); });

        container.on('tab', function (tab) {
            tab
                .closeElement
                .off('click')
                .click(function () {
                    self.close();
                });
        });
        container.setTitle(this.fileName + (state.newFile ? ' [new file]' : ''));
    }

    WizardEditor.prototype = Object.create(parent.prototype);

    WizardEditor.prototype.addDTS = function (dts) {
        var $src = $('div[id="dts-{0}"]'.fs(dts)),
            packages = $('body').data('dts-packages') || {},
            defined = packages[dts] || false;

        if (!defined) {
            $.ajax('/dts/' + dts, {
                cache: false,
                method: 'GET'
            })
            .done(function (content) {
                monaco.languages.typescript.javascriptDefaults.addExtraLib(content);
                packages[dts] = content;
            })
        }
    };

    WizardEditor.prototype.close = function () {
        if (this.unsaved) {
            if (!confirm(this.fullPath + ' has unsaved changes; Are you sure')) return;
        }
        this.container.close();
    };

    WizardEditor.prototype.getSource = function () {
        return this.source;
    };

    WizardEditor.prototype.getTheme = function () {
        return this.client.getPreferences('wiz.editor.colors', 'vs');
    }

    WizardEditor.prototype.save = function () {
        this.source = this.editor.getValue();
        this.socket.emit('kmud', {
            eventType: 'wizShell.save',
            eventData: {
                filename: this.fullPath,
                content: this.source
            }
        });
        this.container.setTitle(this.fileName);
        this.$element.find('.btn-save').hide();
        this.unsaved = false;
    };

    return WizardEditor;
})(jQuery, MudClientModule);

