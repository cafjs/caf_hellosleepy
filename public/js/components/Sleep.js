var React = require('react');
var rB = require('react-bootstrap');
var cE = React.createElement;
var AppActions = require('../actions/AppActions');

var Sleep = {
    handleSleepDelay: function() {
        AppActions.setLocalState({
            sleepDelay: this.refs.sleepDelay.getValue()
        });
    },
    doUpdate: function() {
        var delay = parseInt(this.refs.sleepDelay.getValue());
        if (isNaN(delay)) {
            AppActions.setError(new Error('Invalid sleep delay:' +
                                          this.refs.sleepDelay.getValue()));
        } else {
            AppActions.changeMaxSleep(delay);
        }
    },
    launchUpdate : function(ev) {
        if (ev.key === 'Enter') {
            this.doUpdate();
        }
    },
    render: function() {
        return  cE(rB.Grid, {fluid: true},
                  cE(rB.Row, null,
                     cE(rB.Col, {sm:4, xs:12},
                        cE(rB.Input, {
                            type: 'text',
                            ref: 'sleepDelay',
                            value: this.props.sleepDelay,
                            onChange: this.handleSleepDelay,
                            onKeyDown: this.launchUpdate,
                            placeholder: 'Max Sleep Time (sec)'
                        })
                       ),
                     cE(rB.Col, {sm:4, xs:12},
                        cE(rB.Button, {onClick: this.doUpdate}, 'Update'))
                    )
                  );
    }
};

module.exports = React.createClass(Sleep);
