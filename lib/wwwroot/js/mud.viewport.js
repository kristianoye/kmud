/**
 * The KMUD Client.
 * File: mud.viewport.js
 * Description: Module responsible for rendering bulk of output from game.
 *
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var MudViewport = (function ($, parent) {
    function MudViewport(container, state) {
        parent.call(this, 'MudViewport', container, state);
        var self = this, $template = this.client.buildTemplate('mudViewportTemplate');

        this.$element.addClass('mudConsole mudViewPort').append($template);
        this.$viewport = this.$element.find('.viewport');

        function dispatchEvent(msg) {
            switch (msg.eventType) {
                case 'clearScreen':
                    return self.$element.find('.viewport').empty();

                case 'consoleHtml':
                    return self.renderMessage(msg.eventData, true);

                case 'consoleText':
                    return self.renderMessage(msg.eventData);

                case 'consoleHelp':
                    return self.displayHelp(msg);

                case 'closeSettings':
                    return self.closeSettings();

                case 'helpText':
                    return self.eventHelp(msg);

                case 'loginSplash':
                    if (client.getPreferences('console.showSplash', true)) {
                        return self.renderMessage(msg.eventData, true);
                    }
                    break;

                case 'openSettings':
                    return self.openSettings();

                case 'savePreferences':
                    return self.eventPreferenceChange(msg.eventData, msg.prevData);
            }
        }

        this.client.on('connected', function () {
            container.setTitle('ViewPort');
            self.socket.off('kmud', dispatchEvent)
                .on('kmud', dispatchEvent);
            self.client.on('kmud', dispatchEvent);
        });

        this.client.on('disconnected', function () {
            container.setTitle('ViewPort - *Disconnected*');
            self.socket.off('kmud', dispatchEvent);
            self.client.on('kmud', dispatchEvent);
        });

        this.$element.on('click', '.toggle-settings', function (e) {
            var $sb = $('.top-container > .sidebar');
            e.preventDefault(), dispatchEvent({
                eventType: $sb.hasClass('is-visible') ?
                    'closeSettings' : 'openSettings'
            });
        }).on('click', '.see-also-link', function (e) {
            var $t = $(this),
                $h = $t.closest('.help'),
                topic = $t.data('topic');

            self.socket.emit('kmud', {
                eventType: 'helpQuery',
                eventData: topic,
                eventTarget: $h.attr('id')
            });
        });
        $(document).on('click', '.sidebar .options .apply-settings', function (e) {
            self.saveSettings();
        });
    }

    MudViewport.prototype = Object.create(parent.prototype);

    MudViewport.prototype.closeSettings = function () {
        var $sb = $('.top-container > .sidebar')
            .removeClass('is-visible');
        $('.overlay').remove();
    };

    MudViewport.prototype.eventHelp = function (help) {
        var d = help.eventData, $target = help.eventTarget ? $(`#${help.eventTarget}`) : false,
            $help = this.client.buildTemplate('mudHelpTemplate', {
                id: `help${new Date().getTime()}`,
                text: d.text
            });
        if (d.see instanceof Array) {
            var $topics = d.see.map(function (s) {
                var $a = $('<a class="see-also-link" href="javascript:void(0)" /> ').text(s).attr('data-topic', s);
                return $a;
            });
            $help.find('.see-also').append($topics).show();
        }
        if ($target && $target.length) {
            $target.replaceWith($help);
        } else {
            this.renderMessage($help, true);
        }
        return this.scrollToBottom();
    };

    MudViewport.prototype.eventMigrateChat = function ($chatList) {
        this.$viewport.append($chatList);
        this.$viewport.find('.msg')
            .detach()
            .sort(function (a, b) { return $(a).data('timestamp') < $(b).data('timestamp') ? -1 : 1; })
            .appendTo(this.$viewport);
        return this;            
    }

    MudViewport.prototype.eventPreferenceChange = function (prefs, old) {
        if (prefs['comms.chan'] !== old['comms.chan']) {
            this.client.eventMigrateChat(this.$viewport.find('.chatHistory').detach());
        }
    };

    MudViewport.prototype.openSettings = function () {
        var prefs = this.client.getPreferences();
        $('body').append($('<div class="overlay"/>'));
        var $sb = $('.top-container > .sidebar');

        Object.keys(prefs).forEach(function (pref) {
            var $c = $sb.find('*[name="{0}"]'.fs(pref));
            if ($c.length) {
                console.log('Setting {0} to {1}'.fs(pref, prefs[pref]));
                switch ($c[0].tagName) {
                    case 'INPUT':
                        switch ($c.attr('type')) {
                            case 'text':
                                $c.val(prefs[pref]);
                                break;
                            case 'checkbox':
                                $c.prop('checked', !!prefs[pref]);
                                break;
                        }
                        break;
                    case 'SELECT':
                        $c.find('option[value={0}]'.fs(prefs[pref])).prop('selected', true);
                        break;
                }
            }
        });

        $sb.addClass('is-visible');
        $(document).on('click', '.overlay', function (e) {
            self.closeSettings();
        });
    };

    MudViewport.prototype.eventChat = function ($chat) {
        return this.renderMessage($chat);
    };

    MudViewport.prototype.renderMessage = function (msg, preformatted) {
        var $view = this.$element.find('.viewport'), timestamp = new Date().getTime(), $msg;
        if (msg instanceof jQuery) {
            $msg = $(msg);
        }
        else if (preformatted) {
            $msg = $(this.expandColors(msg));
            $view.append($msg);
        }
        else {
            $msg = $('<div style="white-space: pre; font-family: Courier New;" />').html(this.expandColors(msg.text));
        }
        $view.append($msg.addClass('msg').attr('data-timestamp', timestamp));
        return this.scrollToBottom();
    };

    MudViewport.prototype.saveSettings = function (e) {
        var $sb = $('.top-container .sidebar '),
            oldPrefs = $.extend({}, this.client.getPreferences());

        if ($sb.hasClass('is-visible')) {
            $sb.find('input,select,textarea').each(function (i, ctrl) {
                var $c = $(ctrl), n = $c.attr('name'),
                    tn = $c[0].tagName.toLowerCase(),
                    ct = $c.attr('type') || false, v;
                switch (tn) {
                    case 'input':
                        v = ct === 'checkbox' ? $c.prop('checked') || false : v = $c.val();
                        break;
                    case 'select':
                        v = $c.find('option:selected').val();
                        break;
                    case 'textarea':
                        v = $c.val().trim();
                        break;
                }
                self.client.setPreference(n, v, false);
            });
            this.client.savePreferences(oldPrefs);
            this.closeSettings();
        }
    };

    MudViewport.prototype.scrollToBottom = function () {
        var $view = this.$element.find('.viewport');
        if ($view.length > 0) {
            $view[0].scrollTop = $view[0].scrollHeight;
        }
        return this;
    };

    return MudViewport;
})(jQuery, MudClientModule);
