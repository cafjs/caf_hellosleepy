var React = require('react');
var rB = require('react-bootstrap');
var cE = React.createElement;
var AppActions = require('../actions/AppActions');

var Blinks = {
    handleBlinkDelay: function() {
        AppActions.setLocalState({
            blinkDelay: this.refs.blinkDelay.getValue()
        });
    },
    doUpdate: function() {
        var delay = parseInt(this.refs.blinkDelay.getValue());
        if (isNaN(delay)) {
            AppActions.setError(new Error('Invalid blink delay:' +
                                          this.refs.blinkDelay.getValue()));
        } else {
            AppActions.blink(delay);
        }
    },
    doReset: function() {
        AppActions.resetBlinks();
    },
    launchUpdate : function(ev) {
        if (ev.key === 'Enter') {
            this.doUpdate();
        }
    },
    render: function() {
        return  cE(rB.Grid, null,
                  cE(rB.Row, null,
                     cE(rB.Col, {sm:4, xs:12},
                        cE(rB.Input, {
                            type: 'text',
                            ref: 'blinkDelay',
                            value: this.props.blinkDelay,
                            onChange: this.handleBlinkDelay,
                            onKeyDown: this.launchUpdate,
                            placeholder: 'Blink Delay (sec)'
                        })
                       ),
                     cE(rB.Col, {sm:4, xs:12},
                        cE(rB.Button, {onClick: this.doUpdate}, 'Update')
                       ),
                      cE(rB.Col, {sm:4, xs:12},
                         cE(rB.Button, {onClick: this.doReset}, 'Reset')
                        )
                    ),
                   cE(rB.Row, null,
                       cE(rB.Col, {sm:12, xs:12},
                          cE(rB.ListGroup, null,
                             this.props.blinks.map(function(x, i) {
                                 var d = new Date(x);
                                 return cE(rB.ListGroupItem, {key: i},
                                           d.toString());
                             }))
                         )
                     )
                  );
    }

};

module.exports = React.createClass(Blinks);
