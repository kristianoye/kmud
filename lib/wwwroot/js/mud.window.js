/**
 * The KMUD Client.  Responsible for providing the core communication with
 * the MUD/WMD server and for coordinating the rendering of game content.
 *
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
var MudOutputWindow = (function ($, parent) {
    function MudOutputWindow(container, state) {
        parent.call(this, 'MudOutputWindow', container, state);
        var self = this;

        function eventDispatcher(event) {
            switch (event.eventType) {
                case 'helpText':
                    return self.eventHelp(event);

                case 'savePreferences':
                    return self.eventPreferenceChange(event.eventData, event.prevData);
            }
        }
        this.client.on('kmud', eventDispatcher);

        this.$window = this.client.buildTemplate('OutputWindowTemplate', [state.id]);
        this.$element.append(this.$window)
            .addClass('mudOutputWindow mudOutputWindow' + state.type);
        this.close = function () {
            this.client.off('kmud', eventDispatcher);
            parent.prototype.close.apply(this, arguments);
        };
        this.container.setTitle(state.title);
        if (state.type === 'chat') {
            this.container.on('tab', function (tab) {
                var $counter = $('<div class="messageCounter" style="display:none;" />');
                tab.element.append($counter);
            });
        }
    }

    MudOutputWindow.prototype = Object.create(parent.prototype);

    MudOutputWindow.prototype.eventChat = function ($chat) {
        this.$window.append($chat);
    }

    MudOutputWindow.prototype.eventHelp = function (help) {

    };

    MudOutputWindow.prototype.eventMigrateChat = function ($chatList) {
        this.$window.append($chatList);
        this.$window.find('.chatHistory').detach()
            .sort(function (a, b) { return $(a).data('timestamp') < $(b).data('timestamp') ? -1 : 1; })
            .appendTo(this.$window);
        return this;
    }

    MudOutputWindow.prototype.eventPreferenceChange = function (prefs, old) {
        if (prefs['comms.chan'] !== old['comms.chan']) {
            var $msgList = this.$window.find('.chatHistory').detach(), self = this;
            if ($msgList.length > 0) this.client.eventMigrateChat($msgList);
            this.close();
        }
    };

    MudOutputWindow.findOrCreate = function (client, type, subType) {
        var id = type + ' ' + subType,
            chatWindow = client.getModulesById('MudOutputWindow', id),
            ts = client.layout.root.getItemsById('console stack');

        if (chatWindow)
            return chatWindow;

        if (ts && ts.length === 1) {
            if (!chatWindow) {
                var child = {
                    type: 'component',
                    componentName: 'MudOutputWindow',
                    componentState: {
                        channels: true,
                        id: id,
                        owner: client,
                        type: type,
                        subType: subType
                    }
                }, state = child.componentState;
                switch (type) {
                    case 'chat':
                        state.title = subType === 'combined' ? 'All Channels' : 'Channel: ' + subType;
                        break;
                }
                ts[0].addChild(child);
                return client.getModulesById('MudOutputWindow', id);
            }
        }
        return false;
    };

    return MudOutputWindow;
})(jQuery, MudClientModule);