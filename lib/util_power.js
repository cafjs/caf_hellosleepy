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

var assert = require('assert');

/*
 * The strategy for power management is to wake up the device regularly, and
 * when the device is up, perform all the actions that do not allow a reboot
 * between them due to timing constraints. Then, wake up on the next action, or
 * after a maximum sleep time. More formally:
 *
 * The time before the next action is `dT`, or infinity if there is no action.
 * The time that takes a full device reboot is `tReboot` = `tStart` + `tStop`.
 * The maximum time between shutdowns, assuming no more actions needed, is
 *  `tMaxSleep`.
 *
 *  When we ask for the next bundle of commands we have three cases:
 *
 *  1) dT < tReboot
 *        Stay up, schedule a bundle that will perform all actions that have
 * less than tReboot between them, then sleep until MIN(tLast + tMaxSleep,
 *                                                      tNext -tStart),
 * where tNext is the time for the next action not in the bundle.
 *
 *  2) dT > tReboot       (always tMaxSleep > tReboot)
 *    a) dT < tMaxSleep
 *       Go to sleep, wake up in dT - tStart
 *
 *    b)  dT > tMaxSleep
 *      Go to sleep, wake up in tMaxSleep - tStart
 *
 *
 * Every time that we return a bundle we also update the `nextUpTime`, where any
 * attempt to schedule an action before `nextUpTime` will fail. `nextUpTime`
 * value is the expected wake up time of the previous cases.
 *
 *
 *
 */

var cleanupLateBlinks = exports.cleanupLateBlinks = function(self, now) {
    self.state.blinks = self.state.blinks.filter(function(x) {
        if (x < now) {
            self.$.log && self.$.log.debug('Late blink at ' + x);
        }
        return (x > now);
    });
};

var normalizeSleep = function(self, sleepInMsec) {
    assert(sleepInMsec > (self.state.margin + self.state.tStart));
    return Math.floor((sleepInMsec - self.state.margin -
                       self.state.tStart)/1000);
};

/*
 *        |____________^_____^__^____^___|           |____...
 *        N            B     B  B    B   H           W
 *
 *    N: now, W: wake up, B: blink, H: halt
 *    startTime = B_0 - N
 *    blinksDelay[i] = B_i - B_(i-1) (always blinksDelay[0] = 0)
 *    sleepDelay = H - B_last
 *    sleepInSec = W - H
 */
var blinksBundle = function(self, startTime, blinksDelay, sleepDelay,
                            sleepInSec) {
    var isFloating = function(x) {
        return ((x.input === false) && !x.initialState);
    };
    var allPins = Object.keys(self.state.pinMode).filter(function(x) {
        return isFloating(self.state.pinMode[x]);
    });


    var bundle = self.$.iot.newBundle(startTime);

    blinksDelay.forEach(function(blinkD, j) {
        var delay = (j > 0 ? Math.max(0, blinkD - self.$.props.blinkDuration) :
                     blinkD);
        allPins.forEach(function(x, i) {
            bundle.setPin((i === 0 ? delay : 0), [x, true]);
        });
        allPins.forEach(function(x, i) {
            bundle.setPin((i === 0 ? self.$.props.blinkDuration : 0),
                          [x, false]);
        });
    });

    bundle.haltAndRestart(sleepDelay, [sleepInSec]);

    return bundle;
};


    // stay up for a while, perform chainable actions, and then halt/restart...
var nextActiveBundle = function(self, now) {
    var blinksInBundle = [];
    var lastBlink = self.state.blinks[0];
    var startTime = lastBlink - now;
    var execTime = 0;
    var result;

    self.state.blinks.some(function(x) {
        var diff = x - lastBlink;
        lastBlink = x;
        if (diff < (self.$.props.blinkDuration + self.state.tReboot +
                    self.state.margin)) {
            execTime = execTime + diff;
            blinksInBundle.push(diff);
            return false;
        } else {
            return true;
        }
    });

    self.state.blinks = self.state.blinks.slice(blinksInBundle.length);
    var tNext = ((self.state.blinks.length > 0) ? self.state.blinks[0] :
                 Number.MAX_SAFE_INTEGER);
    var sleepDelay = self.$.props.blinkDuration;
    var tLast = now + startTime + execTime + sleepDelay;
    var dTNext = tNext -tLast;
    assert(dTNext > 0); // Otherwise it should have been chained

    if (dTNext < self.state.maxSleepInSec*1000) {
         // no extra shutdowns...
        result = blinksBundle(self, startTime, blinksInBundle,
                              sleepDelay, normalizeSleep(self, dTNext));
        self.state.nextUpTime = tNext;
    } else {
        //  regular shutdown/restart
        result = blinksBundle(self, startTime, blinksInBundle, sleepDelay,
                              normalizeSleep(self, 1000*
                                             self.state.maxSleepInSec));
        self.state.nextUpTime = tLast + self.state.maxSleepInSec*1000;
    }
    return result;
};


exports.nextBundle = function(self) {
    var now = (new Date()).getTime();
    cleanupLateBlinks(self, now);
    var nextBlink = ((self.state.blinks.length > 0) ? self.state.blinks[0] :
                     null);
    var result = null;
    var dT = (nextBlink ? (nextBlink - now) : Number.MAX_SAFE_INTEGER);
    if (dT > (self.state.tReboot + self.state.margin)) {
        // no action, just sleep
        if (dT < self.state.maxSleepInSec*1000) {
            // no extra shutdowns...
            result = blinksBundle(self, self.state.margin, [], 0,
                                  normalizeSleep(self, dT));
            self.state.nextUpTime = nextBlink;
        } else {
            // regular shutdown/restart
            result = blinksBundle(self, self.state.margin, [], 0,
                                  normalizeSleep(self, 1000*
                                                 self.state.maxSleepInSec));
            self.state.nextUpTime = now + self.state.maxSleepInSec*1000;
        }
    } else {
        // perform all chainable actions
        result = nextActiveBundle(self, now);
    }

    return result;
};
