// Modifications copyright 2020 Caf.js Labs and contributors
/*!
Copyright 2013 Hewlett-Packard Development Company, L.P.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';
var caf_iot = require('caf_iot');

exports.methods = {
    async __iot_setup__() {
        // value of 'index' from last run downloaded from the cloud
        var lastIndex = this.toCloud.get('index');
        this.state.index = (lastIndex ? lastIndex : 0);
        return [];
    },

    async __iot_loop__() {
        this.$.log && this.$.log.debug('Time offset ' + this.$.cloud.cli
                                       .getEstimatedTimeOffset());
        this.$.log && this.$.log.debug(JSON.stringify(this
                                                      .fromCloud.get('meta')));
        this.$.gpio.setPinConfig(this.fromCloud.get('meta') || {});
        this.$.log && this.$.log.debug(JSON.stringify(this
                                                      .fromCloud.get('out')));
        this.$.gpio.writeMany(this.fromCloud.get('out') || {});
        this.toCloud.set('in', this.$.gpio.readAll());

        this.toCloud.set('index', this.state.index);
        this.state.index = this.state.index + 1;
        var now = (new Date()).getTime();
        this.$.log && this.$.log.debug(now + ' loop:' + this.state.index);

        return [];
    },

    async setPin(pin, value) {
        var now = (new Date()).getTime();
        this.$.log && this.$.log.debug(now + ' setPin:' + pin + ' value:' +
                                       value);
        var pins = {};
        pins[pin] = value;
        this.$.gpio.writeMany(pins);
        return [];
    },

    async haltAndRestart(afterSec) {
        this.$.nap.haltAndRestart(afterSec);
        return [];
    }
};

caf_iot.init(module);
