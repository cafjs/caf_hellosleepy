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
var caf = require('caf_core');
var app = require('../public/js/app.js');
var caf_comp = caf.caf_components;
var myUtils = caf_comp.myUtils;
var util_power = require('./util_power');

var APP_SESSION = 'default';
var IOT_SESSION = 'iot';

var notifyIoT = function(self, msg) {
    var $$ = self.$.sharing.$;
    var notif = {msg: msg, fromCloud: $$.fromCloud.dump()};
    self.$.session.notify([notif], IOT_SESSION);
};

var notifyWebApp = function(self, msg) {
    self.$.session.notify([msg], APP_SESSION);
};

exports.methods = {

    // Called by the framework

    async __ca_init__() {
        this.state.pinInputsValue = {};
        this.state.pinOutputsValue = {};
        this.state.pinMode = {};
        this.state.iotMethodsMeta = this.$.iot.iotMethodsMeta();
        this.$.session.limitQueue(1, APP_SESSION); // only the last notification
        this.$.session.limitQueue(1, IOT_SESSION); // only the last notification
        this.state.fullName = this.__ca_getAppName__() + '#' +
            this.__ca_getName__();
        this.state.trace__iot_sync__ = 'traceSync';
        this.state.trace__iot_resume__ = 'traceResume';
        this.state.blinks = [];
        this.state.maxSleepInSec = this.$.props.maxSleepInSec;
        this.state.margin = this.$.props.margin;
        this.state.tStart = this.$.props.tStart;
        this.state.tReboot = this.$.props.tReboot;
        this.state.nextUpTime = (new Date()).getTime();
        if (this.state.tReboot > this.state.maxSleepInSec*1000) {
            var err = new Error('Time to reboot greater than sleep time');
            err.tReboot = this.state.tReboot;
            err.maxSleepInSec = this.state.maxSleepInSec;
            return [err];
        } else {
            return [];
        }
    },
    async __ca_resume__(cp) {
        // need to recreate, in case the IoT  device implementation changed.
        this.state.iotMethodsMeta = this.$.iot.iotMethodsMeta();
        return [];
    },
    async __ca_pulse__() {
        this.$.log && this.$.log.debug('calling PULSE!!!');
        var now = (new Date()).getTime();
        var n = this.state.blinks.length;
        util_power.cleanupLateBlinks(this, now);
        if (this.state.blinks.length !== n) {
            notifyWebApp(this, 'Blink list update');
        }
        this.$.react.render(app.main, [this.state]);
        return [];
    },

    // Called by the web app

    async hello(key, tokenStr) {
        this.$.react.setCacheKey(key);
        this.$.iot.registerToken(tokenStr);
        return this.getState();
    },
    async changePinMode(pin, input, floating) {
        var $$ = this.$.sharing.$;
        var newMode = (input ? {
            input: true,
            internalResistor: { pullUp: this.$.props.resistorPullUp }
        } : {
            input: false,
            initialState: { high: this.$.props.initialStateHigh }
        });
        if (floating) {
            delete newMode.initialState;
        }
        try {
            await this.deletePin(pin);
            this.state.pinMode[pin] = newMode;
            $$.fromCloud.set('meta', myUtils.deepClone(this.state.pinMode));
            notifyIoT(this, 'Changed pin mode');
            return this.getState();
        } catch (err) {
            return [err];
        }
    },
    async changePinValue(pin, value) {
        if (this.state.pinMode[pin] && !this.state.pinMode[pin].input
            && this.state.pinMode[pin].initialState) {
            var $$ = this.$.sharing.$;
            this.state.pinOutputsValue[pin] = value;
            $$.fromCloud.set('out', myUtils.deepClone(this.state
                                                      .pinOutputsValue));
            notifyIoT(this, 'Changed pin values');
            return this.getState();
        } else {
            var error = new Error('Cannot change pin value');
            error.pin = pin;
            error.pinMode = this.state.pinMode[pin];
            error.value = value;
            return [error];
        }
    },
    async deletePin(pin) {
        var $$ = this.$.sharing.$;
        if (this.state.pinMode[pin]) {
            delete this.state.pinMode[pin];
            $$.fromCloud.set('meta', myUtils.deepClone(this.state.pinMode));
        }
        if (typeof this.state.pinOutputsValue[pin] === 'boolean') {
            delete this.state.pinOutputsValue[pin];
            $$.fromCloud.set('out', myUtils.deepClone(this.state
                                                      .pinOutputsValue));
        }
        delete this.state.pinInputsValue[pin];
        return this.getState();
    },
    async changeMaxSleep(sleepInSec) {
        if (this.state.tReboot > sleepInSec*1000) {
            var err = new Error('Time to reboot greater than sleep time');
            err.tReboot = this.state.tReboot;
            err.maxSleepInSec = sleepInSec;
            return [err];
        } else {
            this.state.maxSleepInSec = sleepInSec;
            return this.getState();
        }
    },
    async blink(afterSec) {
        var now = (new Date()).getTime();
        var blinkTime = now + 1000*afterSec;
        if (blinkTime < this.state.nextUpTime) {
            var delay = Math.ceil((this.state.nextUpTime - now)/1000);
            var err = new Error('Cannot schedule, try in ' + delay +
                                ' seconds');
            err.now = now;
            err.afterSec = afterSec;
            err.nextUpTime = this.state.nextUpTime;
            return [err];
        } else {
            this.state.blinks.push(blinkTime);
            util_power.cleanupLateBlinks(this, now);
            this.state.blinks.sort(); //slow, assumed few elements in list
            return this.getState();
        }
    },
    async resetBlinks() {
        this.state.blinks = [];
        return this.getState();
    },
    async getState() {
        this.$.react.coin();
        return [null, this.state];
    },

    // Called by the IoT device

    async traceSync() {
        var $$ = this.$.sharing.$;
        var now = (new Date()).getTime();
        this.$.log.debug(this.state.fullName + ':Syncing!!:' + now);
        this.state.pinInputsValue = myUtils.deepClone($$.toCloud.get('in'));
        notifyWebApp(this, 'New inputs');
        return [];
    },
    async traceResume() {
        var now = (new Date()).getTime();
        this.$.log.debug(this.state.fullName + ' now: ' + now +
                         ' estimation was: '+ this.state.nextUpTime);
        var bundle = util_power.nextBundle(this);
        this.$.iot.sendBundle(bundle);
        notifyIoT(this, 'Bundle scheduled');
        return [];
    }
};

caf.init(module);
