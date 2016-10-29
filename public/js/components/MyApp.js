var React = require('react');
var rB = require('react-bootstrap');
var cE = React.createElement;
var AppStore = require('../stores/AppStore');
var AppActions = require('../actions/AppActions');
var Pins = require('./Pins');
var Sleep = require('./Sleep');
var AppStatus = require('./AppStatus');
var DisplayError = require('./DisplayError');
var Blinks = require('./Blinks');

var MyApp = {
    getInitialState: function() {
        return AppStore.getState();
    },
    componentDidMount: function() {
        AppStore.addChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        AppStore.removeChangeListener(this._onChange);
    },
    _onChange : function(ev) {
        this.setState(AppStore.getState());
    },
    render: function() {
        return cE("div", {className: "container-fluid"},
                  cE(DisplayError, {
                      error: this.state.error
                  }),
                  cE(rB.Panel, {
                      header: cE(rB.Grid, {fluid: true},
                                 cE(rB.Row, null,
                                    cE(rB.Col, {sm:1, xs:1},
                                       cE(AppStatus, {
                                           isClosed: this.state.isClosed
                                       })
                                      ),
                                    cE(rB.Col, {
                                        sm: 5,
                                        xs:10,
                                        className: 'text-right'
                                    }, "IoT Example"),
                                    cE(rB.Col, {
                                        sm: 5,
                                        xs:11,
                                        className: 'text-right'
                                    }, this.state.fullName)
                                   )
                                )
                  },
                     cE(rB.Panel, {
                         header: 'Offline for at most ' +
                             this.state.maxSleepInSec + ' seconds'
                     },
                        cE(Sleep, {
                            maxSleepInSec : this.state.maxSleepInSec,
                            sleepDelay : this.state.sleepDelay
                        })),
                     cE(rB.Panel, {header: 'Pins'},
                        cE(Pins, {
                            pinNumber: this.state.pinNumber,
                            pinMode: this.state.pinMode,
                            pinOutputsValue: this.state.pinOutputsValue,
                            pinInputsValue: this.state.pinInputsValue
                        })),
                     cE(rB.Panel, {header: 'Blinks'},
                        cE(Blinks, {
                            blinks: this.state.blinks,
                            blinkDelay: this.state.blinkDelay
                        }))
                    )
                 );
    }
};

module.exports = React.createClass(MyApp);
