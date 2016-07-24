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

"use strict";
var assert = require('assert');
var caf = require('caf_core');
var app = require('../public/js/app.js');
var caf_comp = caf.caf_components;
var myUtils = caf_comp.myUtils;
var async = caf_comp.async;
var json_rpc = caf.caf_transport.json_rpc;
var APP_SESSION = 'default';
var IOT_SESSION = 'iot';

var isTopicPresent = function(all, topic) {
    return Object.keys(all).some(function(x) {
        return all[x].topic === topic;
    });
};

var filterByTopic = function(all, topic) {
    return Object.keys(all).filter(function(x) {
        return all[x].topic === topic;
    });
};

var wrapTopic = function(prefix, forumPrefix, topic) {
    if (topic.indexOf(forumPrefix) === 0) {
        return topic;
    } else {
        var newTopic = json_rpc.joinName(prefix, topic);
        try {
            json_rpc.splitName(newTopic); // throws if invalid name
            return newTopic;
        } catch(ex) {
            
            json_rpc.splitName(topic);
            return topic;
        }
    }
};

var notifyIoT = function(self, msg) {
    var $$ = self.$.sharing.$;
    var notif = {msg: msg, fromCloud:  $$.fromCloud.dump()};
    self.$.session.notify([notif], IOT_SESSION);
};

var notifyWebApp = function(self, msg) {
    self.$.session.notify([msg], APP_SESSION);
};

exports.methods = {

    // Called by the framework
    
    '__ca_init__' : function(cb) {
        this.state.pinInputsValue = {};
        this.state.pinOutputsValue = {};
        this.state.pinMode = {};
        this.state.bundles = {};
        this.state.listeners = {};
        this.state.iotMethodsMeta = this.$.iot.iotMethodsMeta();
        this.$.session.limitQueue(1, APP_SESSION); // only the last notification
        this.$.session.limitQueue(1, IOT_SESSION); // only the last notification
        this.state.fullName = this.__ca_getAppName__() + '#' +
            this.__ca_getName__();
        this.state.trace__iot_sync__ = 'traceSync';
        this.state.trace__iot_resume__ = 'traceResume';
        this.state.lastBundleIndex = null;
        var rule = this.$.security.newSimpleRule('handleListener'); //anybody
        this.$.security.addRule(rule);
        cb(null);
    },
    '__ca_resume__' : function(cp, cb) {
        // need to recreate, in case the IoT  device implementation changed.
        this.state.iotMethodsMeta = this.$.iot.iotMethodsMeta();
        cb(null);
    },
    '__ca_pulse__' : function(cb) {
        this.$._.$.log && this.$._.$.log.debug('calling PULSE!!!');
        this.$.react.render(app.main, [this.state]);
        cb(null, null);
    },

    // Called by the web app
    
    'hello' : function(key, tokenStr, cb) {
        this.$.react.setCacheKey(key);
        this.$.iot.registerToken(tokenStr);
        this.getState(cb);
    },
    'changePinMode' : function(pin, input, floating, cb) {
        var $$ = this.$.sharing.$;
        var self = this;
        var newMode = (input ?  {
            input: true,
            internalResistor: { pullUp: this.$.props.resistorPullUp }
        } : {
            input: false,
            initialState: { high: this.$.props.initialStateHigh }
        });
        if (floating) {
            delete newMode.initialState;
        }
        
        this.deletePin(pin, function(err) {
            if (err) {
                cb(err);
            } else {
                self.state.pinMode[pin] = newMode;
                $$.fromCloud.set('meta', myUtils.deepClone(self.state.pinMode));
                notifyIoT(self, 'Changed pin mode');
                self.getState(cb);
            }
        });
    },
    'changePinValue' : function(pin, value, cb) {
        if (this.state.pinMode[pin] && !this.state.pinMode[pin].input
            && this.state.pinMode[pin].initialState) {
            var $$ = this.$.sharing.$;
            this.state.pinOutputsValue[pin] = value;
            $$.fromCloud.set('out', myUtils.deepClone(this.state
                                                      .pinOutputsValue));
            notifyIoT(this, 'Changed pin values');
            this.getState(cb);
        } else {
            var error = new Error('Cannot change pin value');
            error.pin = pin;
            error.pinMode = this.state.pinMode[pin];
            error.value = value;
            cb(error);
        }
    },
    'deletePin' : function(pin, cb) {
        var $$ = this.$.sharing.$;
        if (this.state.pinMode[pin]) {
            delete this.state.pinMode[pin];
            $$.fromCloud.set('meta', myUtils.deepClone(this.state.pinMode));
        }
        if (typeof  this.state.pinOutputsValue[pin] === 'boolean') {
            delete this.state.pinOutputsValue[pin];
            $$.fromCloud.set('out', myUtils.deepClone(this.state
                                                      .pinOutputsValue));
        }
        delete this.state.pinInputsValue[pin];
        this.getState(cb);
    },
    'addBundle' : function(name, bundle, cb) {
        this.state.bundles[name] = bundle;
        this.getState(cb);
    },
    'removeBundle' : function(name, cb) {
        delete this.state.bundles[name];
        this.getState(cb);
    },
    'scheduleBundle' : function(name, offset, cb) {
        var bStr = this.state.bundles[name];
        if (bStr) {
            var bundle = this.$.iot.newBundle(this.$.props.margin);
            this.state.lastBundleIndex = this.$.iot
                .sendBundle(bundle.__iot_parse__(bStr), offset);
            notifyIoT(this, 'Bundle scheduled');
            this.getState(cb); 
        } else {
            cb(new Error('bundle ' + name + ' not found')); 
        }
    },
    'triggerEvent' : function(label, offset, cb) {
        try {
            var topic =  wrapTopic(this.__ca_getName__(),
                                   this.$.pubsub.FORUM_PREFIX, label);
            var msg = JSON.stringify({
                time : (new Date()).getTime(),
                offset: offset
            });
            this.$.pubsub.publish(topic, msg);
            this.getState(cb);
        } catch(err) {
            // security check
            cb(err);
        }
    },
    'addListener' : function(id, topic, bundleName, offset,  cb) {
        topic = wrapTopic(this.__ca_getName__(),
                          this.$.pubsub.FORUM_PREFIX, topic);
        var present = isTopicPresent(this.state.listeners, topic);
        this.state.listeners[id] = {
            topic: topic, bundleName: bundleName, offset: offset || 0
        };
        if (!present) {
            this.$.pubsub.subscribe(topic, 'handleListener');
        }
        this.getState(cb);
    },
    'removeListener' : function(id, cb) {
        var topic =  this.state.listeners[id] && this.state.listeners[id].topic;
        if (topic) {
            delete this.state.listeners[id];
            var present =  isTopicPresent(this.state.listeners, topic);
            if (!present) {
                this.$.pubsub.unsubscribe(topic);
            }
        }
        this.getState(cb);
    },
    'getState' : function(cb) {
        this.$.react.coin();
        cb(null, this.state);
    },
    
    //Called by the pubsub plugin

    'handleListener' : function(topic, msg, cb) {
        if (topic.indexOf(this.$.pubsub.FORUM_PREFIX) !== 0) {
            assert(topic.indexOf(this.$.security.getCallerFrom()) === 0,
                   "caller" + this.$.security.getCallerFrom() +
                   " incompatible with topic " + topic);
        }
        
        var self = this;
        var all = filterByTopic(this.state.listeners, topic);
        if (all.length > 0) {
            var action = JSON.parse(msg);
            var baseOffset = action.offset;
            var now = (new Date()).getTime();
            baseOffset = Math.max(baseOffset - (now - action.time), 0);
            
            async.eachSeries(all, function(id, cb1) {
                var listener = self.state.listeners[id];
                var offset = baseOffset;
                if (typeof listener.offset === 'number') {
                    if (listener.offset ===  self.$.iot.NOW) {
                        offset = listener.offset;
                    } else {
                        offset = offset + listener.offset;
                    }
                }
                self.scheduleBundle(listener.bundleName, offset, cb1);
            }, cb);
        } else {
            cb(null);
        }
    },

    // Called by the IoT device
    
    'traceSync' : function(cb) {
        var $$ = this.$.sharing.$;
        var now = (new Date()).getTime();
        this.$.log.debug(this.state.fullName + ':Syncing!!:' + now);
        this.state.pinInputsValue =  myUtils.deepClone($$.toCloud.get('in'));
        notifyWebApp(this, 'New inputs');
        cb(null);
    },
    'traceResume' : function(cb) {
        var now = (new Date()).getTime();
        this.$.log.debug(this.state.fullName + ':Resuming!!:' + now);
        cb(null);
    }
};


caf.init(module);

